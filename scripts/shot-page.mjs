// Screenshots one window of the real app without putting anything on the user's screen (headless profile,
// DevTools Page.captureScreenshot). Usage:
//   node scripts/shot-page.mjs <route> <out.png> [--tab=N] [--setting=key:value ...] [--size=WxH] [--wait=ms]
// <route> is a substring of the page URL: "#/settings", "#/dock", "#/stack", "#/menu".
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const [route, out] = process.argv.slice(2)
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const settingPairs = process.argv.filter((a) => a.startsWith('--setting=')).map((a) => a.slice(10).split(':'))
const settings = Object.fromEntries(settingPairs.map(([k, v]) => [k, v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v)]))
const [width, height] = (arg('size') ?? '1100x760').split('x').map(Number)

const profile = mkdtempSync(join(tmpdir(), 'dock-shot-'))
const win = (p) => p.replaceAll('/', String.fromCharCode(92))
const windir = process.env.SystemRoot ?? 'C:/Windows'
const app = (name, p) => ({ id: name, type: 'app', targetPath: win(p), label: name })
writeFileSync(join(profile, 'config.json'), JSON.stringify({
  items: [{ id: 'start', type: 'start', label: 'Başlat' }, app('notepad', `${windir}/System32/notepad.exe`), app('calc', `${windir}/System32/calc.exe`), app('explorer', `${windir}/explorer.exe`), { id: 'folder', type: 'folder', targetPath: win(`${windir}/Fonts`), label: 'Fonts' }, { id: 'trash', type: 'trash' }],
  settings,
  widgets: [],
}))

const port = 9500 + Math.floor(Math.random() * 400)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: '1' } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stop = () => spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === 'page')

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m) }
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
  if (route.includes('settings')) await dock.evaluate("window.api.invoke('app:open-settings')")
  if (route.includes('menu')) await dock.evaluate("window.api.invoke('menu:show', { kind: 'icon', itemId: 'folder' })")
  if (route.includes('stack')) await dock.evaluate("window.api.invoke('stack:show', 'folder', { x: 900, y: 800 })")
  let target
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(300)
    target = (await pages()).find((p) => p.url.includes(route))
  }
  if (!target) throw new Error(`no page matching ${route}`)
  const view = target === page ? dock : await connect(target)
  await view.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const tab = arg('tab')
  if (tab) await view.evaluate(`document.querySelectorAll('.st-tab')[${Number(tab)}]?.click()`)
  await sleep(Number(arg('wait') ?? 900))
  const shot = await view.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`saved ${out}`)
  view.ws.close()
} finally {
  stop()
}
