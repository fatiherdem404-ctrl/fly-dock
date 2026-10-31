// Screenshots one window of the real app without putting anything on the user's screen (headless profile,
// DevTools Page.captureScreenshot). Usage:
//   node scripts/shot-page.mjs <route> <out.png> [--tab=N] [--setting=key:value ...] [--size=WxH] [--wait=ms]
// <route> is a substring of the page URL: "#/settings", "#/dock", "#/stack", "#/menu".
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const [route, out] = process.argv.slice(2)
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const settingPairs = process.argv.filter((a) => a.startsWith('--setting=')).map((a) => { const s = a.slice(10); const i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)] })
const settings = Object.fromEntries(settingPairs.map(([k, v]) => [k, v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v)]))
const [width, height] = (arg('size') ?? '1100x760').split('x').map(Number)

const profile = mkdtempSync(join(tmpdir(), 'dock-shot-'))

// --texture=sample stores a generated 96x96 test image (diagonal stripes with a dot) as the custom desk texture
function samplePng(hue = 0, W = 96) {
  const raw = Buffer.alloc(W * (W * 4 + 1))
  for (let y = 0; y < W; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++) {
      const stripe = ((x + y) % 24) < 12
      const dot = (x - 48) ** 2 + (y - 48) ** 2 < 100
      if (W > 200) { raw.set([(Math.random() * 255) | 0, (Math.random() * 255) | 0, (Math.random() * 255) | 0, 255], y * (W * 4 + 1) + 1 + x * 4); continue }
      const px = dot ? [255, 255, 255, 255] : stripe ? [(210 + hue * 3) % 256, (120 + hue * 5) % 256, (60 + hue * 7) % 256, 255] : [(120 + hue * 3) % 256, (60 + hue * 5) % 256, (30 + hue * 7) % 256, 255]
      raw.set(px, y * (W * 4 + 1) + 1 + x * 4)
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
if (arg('texture') === 'sample' || arg('texture') === 'big') {
  const png = samplePng(0, arg('texture') === 'big' ? 1500 : 96)
  const file = createHash('sha1').update(png).digest('hex').slice(0, 16) + '.png'
  mkdirSync(join(profile, 'textures'), { recursive: true })
  writeFileSync(join(profile, 'textures', file), png)
  settings.deskTexFile = file
}
// --icons=sample puts 16 generated pictures in a folder and adds it to the icon library
if (arg('icons') === 'sample') {
  const dir = join(profile, 'sample-icons')
  mkdirSync(dir, { recursive: true })
  const names = ['chrome', 'notepad', 'calc', 'explorer', 'folder', 'trash', 'start', 'power', 'game', 'music', 'photo', 'mail', 'code', 'chat', 'maps', 'clock']
  names.forEach((n, i) => writeFileSync(join(dir, n + '.png'), samplePng(i * 22)))
  settings.iconFolders = [dir]
}
const win = (p) => p.replaceAll('/', String.fromCharCode(92))
const windir = process.env.SystemRoot ?? 'C:/Windows'
const app = (name, p) => ({ id: name, type: 'app', targetPath: win(p), label: name })
// --defaults: a brand-new profile (no stored items or settings), to see what a fresh install looks like
if (!arg('defaults')) writeFileSync(join(profile, 'config.json'), JSON.stringify({
  schemaVersion: 8,
  items: [{ id: 'start', type: 'start', label: 'Başlat' }, app('notepad', `${windir}/System32/notepad.exe`), app('calc', `${windir}/System32/calc.exe`), app('explorer', `${windir}/explorer.exe`), { id: 'sep1', type: 'separator' }, { id: 'folder', type: 'folder', targetPath: win(arg('folder') ?? `${windir}/Fonts`), label: 'Fonts' }, { id: 'wheel1', type: 'wheel', label: 'Denetim' }, { id: 'power1', type: 'power', label: 'Güç' }, { id: 'trash', type: 'trash' }],
  settings,
  widgets: (arg('widgets') ?? '').split(',').filter(Boolean).map((type, i) => ({ id: `w-${type}`, type, x: 40 + i * 20, y: 40 + i * 20, options: Object.fromEntries((arg('wopts') ?? '').split(',').filter(Boolean).map((p) => p.split('=')).map(([k, v]) => [k, v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v)])) })),
}))

const port = 9500 + Math.floor(Math.random() * 400)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: '1', ...(route.includes('confirm') ? { FLY_DOCK_TEST_CONFIRM: arg('input') ? 'input' : '1' } : {}) } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stop = () => spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === 'page')

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) pending.get(m.id)(m)
    else if (m.method === 'Runtime.exceptionThrown') console.log('PAGE ERROR:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  }
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  return { send, evaluate: async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result?.value, ws }
}

try {
  let page
  for (let i = 0; i < 50 && !page; i++) {
    await sleep(400)
    try { page = (await pages()).find((p) => p.url.includes('#/dock')) } catch { /* not up */ }
  }
  if (!page) throw new Error('app did not start')
  const dock = await connect(page)
  if (arg('pre')) await dock.evaluate(arg('pre'))
  if (route.includes('wallpaper')) await new Promise((r) => setTimeout(r, 1500))
  if (route.includes('settings')) await dock.evaluate("window.api.invoke('app:open-settings')")
  if (route.includes('wheel')) await dock.evaluate("window.api.invoke('items:activate', 'wheel1')")
  if (route.includes('power')) await dock.evaluate("window.api.invoke('items:activate', 'power1')")
  if (route.includes('iconpick')) await dock.evaluate("window.api.invoke('iconpick:show', 'notepad')")
  if (route.includes('menu') && !arg('pre')) await dock.evaluate("window.api.invoke('menu:show', { kind: 'icon', itemId: 'folder' })")
  if (route.includes('stack')) await dock.evaluate("window.api.invoke('stack:show', 'folder', { x: 900, y: 800 })")
  let target
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(300)
    target = (await pages()).find((p) => p.url.includes(route))
  }
  if (!target) throw new Error(`no page matching ${route}`)
  const view = target === page ? dock : await connect(target)
  await view.send('Runtime.enable')
  await view.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const tab = arg('tab')
  if (tab) await view.evaluate(`document.querySelectorAll('.st-tab')[${Number(tab)}]?.click()`)
  for (const click of process.argv.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8))) {
    await view.evaluate(`document.querySelectorAll(${JSON.stringify(click)}).forEach((b) => b.click())`)
    await sleep(250)
  }
  const evalExpr = arg('eval')
  if (evalExpr) console.log('EVAL:', JSON.stringify(await view.evaluate(evalExpr)).slice(0, 400))
  await sleep(Number(arg('wait') ?? 900))
  const shot = await view.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`saved ${out}`)
  view.ws.close()
} finally {
  stop()
}
