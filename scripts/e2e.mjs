// End-to-end smoke test: runs the built app with a throw-away profile and drives it through the same IPC
// the UI uses (over the DevTools protocol). Needs `npx vite build` and the helper built. Run: node scripts/e2e.mjs
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import electronPath from 'electron'

const profile = mkdtempSync(join(tmpdir(), 'dock-e2e-'))
const win = (p) => p.replaceAll('/', String.fromCharCode(92))
const windir = process.env.SystemRoot ?? 'C:/Windows'
writeFileSync(
  join(profile, 'config.json'),
  JSON.stringify({
    items: [
      { id: 'explorer', type: 'app', targetPath: win(`${windir}/explorer.exe`), label: 'explorer', order: 0 },
      { id: 'dl', type: 'folder', targetPath: win(`${windir}/System32`), label: 'System32', order: 1 },
      { id: 'grp', type: 'group', label: 'Group', children: [win(`${windir}/System32/notepad.exe`), win(`${windir}/System32/calc.exe`)], order: 2 },
      { id: 'wheel1', type: 'wheel', label: 'Denetim', order: 3 },
      { id: 'power1', type: 'power', label: 'Güç', order: 4 },
      { id: 'trash', type: 'trash', order: 999 },
    ],
    settings: {},
  }),
)

const port = 9900 + Math.floor(Math.random() * 90)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: '1' } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stop = () => spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === 'page')

async function until(check, label, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const v = await check(); if (v) return v } catch { /* retry */ }
    await sleep(400)
  }
  throw new Error(`timed out: ${label}`)
}

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m) }
  return {
    ws,
    call: async (expr) => {
      const n = ++id
      const reply = await new Promise((resolve) => { pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })) })
      if (reply.result.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? 'evaluate failed')
      return reply.result.result.value
    },
  }
}

const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', `${name}: ${e.message.split('\n')[0]}`]) }
}

try {
  const dockPage = await until(async () => (await pages()).find((p) => p.url.includes('#/dock')), 'dock window')
  const dock = await connect(dockPage)
  const invoke = (channel, ...args) => dock.call(`window.api.invoke(${JSON.stringify(channel)}, ...${JSON.stringify(args)})`)
  await sleep(1500)

  await check('config from an older schema is migrated and loads', async () => {
    const s = await invoke('settings:get')
    assert.equal(s.showRunningApps, true)
    const items = await invoke('items:get')
    assert.ok(items.some((i) => i.id === 'explorer') && items.some((i) => i.type === 'trash'))
    assert.ok(!items.some((i) => 'order' in i), 'legacy order field is gone')
  })

  await check('shell icons come back as PNG data URLs', async () => {
    const icon = await invoke('items:icon', 'explorer')
    assert.match(icon, /^data:image\/png;base64,/)
    assert.ok(icon.length > 2000)
  })

  await check('running programs that are not pinned get temporary icons after a separator', async () => {
    const items = await until(async () => { const v = await invoke('items:get'); return v.some((i) => i.id.startsWith('run:')) && v }, 'running items')
    const sep = items.findIndex((i) => i.id === 'running-separator')
    assert.ok(sep > 0 && items[sep + 1].id.startsWith('run:'))
    assert.equal(items[items.length - 1].type, 'trash', 'trash stays last')
  })

  await check('adding files and folders by path (drop) pins them before the trash', async () => {
    const before = (await invoke('items:get')).filter((i) => !i.id.startsWith('run:') && i.id !== 'running-separator').length
    await invoke('items:add-paths', [win(`${windir}/System32/notepad.exe`), win(`${windir}/System32/drivers/etc/hosts`), win(`${windir}/Fonts`)], 1)
    const after = (await invoke('items:get')).filter((i) => !i.id.startsWith('run:') && i.id !== 'running-separator')
    assert.equal(after.length, before + 3)
    assert.deepEqual(after.slice(1, 4).map((i) => i.type), ['app', 'file', 'folder'])
    assert.equal(after[after.length - 1].type, 'trash')
  })

  await check('reordering keeps ids and drops unknown ones', async () => {
    const items = (await invoke('items:get')).filter((i) => !i.id.startsWith('run:') && i.id !== 'running-separator')
    const reversed = [items[1], items[0], ...items.slice(2), { id: 'ghost', type: 'app', targetPath: 'x' }]
    const next = await invoke('items:set', reversed)
    assert.equal(next[0].id, items[1].id)
    assert.ok(!next.some((i) => i.id === 'ghost'))
  })

  await check('removing an item works and the trash cannot be removed', async () => {
    const items = await invoke('items:get')
    const removable = items.find((i) => i.type === 'file')
    const after = await invoke('items:remove', removable.id)
    assert.ok(!after.some((i) => i.id === removable.id))
    const afterTrash = await invoke('items:remove', 'trash')
    assert.ok(afterTrash.some((i) => i.type === 'trash'))
  })

  await check('a folder can be shown as a stack and its popup lists entries', async () => {
    const entries = await invoke('stack:list', 'dl')
    assert.ok(entries.length > 10 && entries[0].isDirectory, 'folders are listed first')
    await invoke('stack:show', 'dl', { x: 800, y: 900 })
    await until(async () => (await pages()).find((p) => p.url.includes('#/stack/dl')), 'stack window')
  })

  await check('stack icons render in the popup', async () => {
    const stackPage = (await pages()).find((p) => p.url.includes('#/stack/dl'))
    const stack = await connect(stackPage)
    const loaded = await until(async () => stack.call(`document.querySelectorAll('.stack__entry img').length`), 'stack icons')
    assert.ok(loaded > 5)
    stack.ws.close()
  })

  await check('an app group lists its children and accepts dropped files', async () => {
    const before = await invoke('stack:list', 'grp')
    assert.equal(before.length, 2)
    const items = await invoke('group:add', 'grp', [win(`${windir}/System32/cmd.exe`), win(`${windir}/System32/calc.exe`)])
    assert.equal(items.find((i) => i.id === 'grp').children.length, 3, 'duplicates are ignored')
  })

  await check('the stack window closes on Escape after its closing animation', async () => {
    await invoke('stack:show', 'grp', { x: 800, y: 900 })
    const page = await until(async () => (await pages()).find((p) => p.url.includes('#/stack/grp')), 'group window')
    const conn = await connect(page)
    await until(async () => conn.call("!!document.querySelector('.stack')"), 'stack rendered')
    await sleep(300) // listeners attach right after the first render
    await conn.call("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
    await until(async () => !(await pages()).some((p) => p.url.includes('#/stack/grp')), 'stack closed', 20)
    conn.ws.close()
  })

  await check('the context menu opens with icons and runs the picked entry', async () => {
    await invoke('menu:show', { kind: 'icon', itemId: 'explorer' })
    const page = await until(async () => (await pages()).find((p) => p.url.includes('#/menu')), 'menu window')
    const conn = await connect(page)
    const count = await until(async () => conn.call("document.querySelectorAll('.menu__item svg').length"), 'menu entries')
    assert.ok(count >= 5, `every entry has an icon (got ${count})`)
    await conn.call("document.querySelector('.menu__item').click()")
    await until(async () => !(await pages()).some((p) => p.url.includes('#/menu')), 'menu closed', 20)
    conn.ws.close()
  })

  await check('a second launch does not open a second dock', async () => {
    const second = spawn(electronPath, ['.', `--user-data-dir=${profile}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: '1' } })
    const code = await new Promise((resolve) => { second.on('exit', resolve); setTimeout(() => resolve('still running'), 12000) })
    if (code === 'still running') spawn('taskkill', ['/T', '/F', '/PID', String(second.pid)], { stdio: 'ignore' })
    assert.notEqual(code, 'still running', 'the second instance exits by itself')
    const docks = (await pages()).filter((p) => p.url.includes('#/dock'))
    assert.equal(docks.length, 1)
  })

  await check('the gear menu opens as a dock window, lists tools and only runs known ids', async () => {
    await invoke('items:activate', 'wheel1')
    const page = await until(async () => (await pages()).find((p) => p.url.includes('#/wheel')), 'gear window')
    const conn = await connect(page)
    const count = await until(async () => conn.call("document.querySelectorAll('.dw .stack__entry').length"), 'gear entries')
    assert.ok(count >= 10, `catalogue is shown (got ${count})`)
    assert.equal(await conn.call("!!document.querySelector('.dw__close') && !!document.querySelector('.dw__head h2')"), true, 'same title bar and close button as every dock window')
    assert.equal(await conn.call("document.querySelectorAll('.wheel__icon svg, .wheel__icon img').length === document.querySelectorAll('.dw .stack__entry').length"), true, 'every entry has an icon')
    // typing filters the grid
    await conn.call("(() => { const i = document.querySelector('.dw__search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'ses'); i.dispatchEvent(new Event('input', { bubbles: true })) })()")
    await until(async () => (await conn.call("document.querySelectorAll('.dw .stack__entry').length")) < count, 'search filters')
    assert.equal(await invoke('wheel:run', 'not-in-the-list; calc.exe'), false, 'unknown ids never run')
    conn.ws.close()
    await invoke('stack:close')
  })

  await check('ready-made places are added once, before the recycle bin', async () => {
    const before = (await invoke('places:list')).find((p) => p.id === 'network')
    assert.equal(before.added, false, 'network is not in the test dock yet')
    await invoke('places:add', 'network')
    const items = await invoke('places:add', 'network')
    const net = items.filter((i) => i.targetPath === 'shell:NetworkPlacesFolder')
    assert.equal(net.length, 1, 'asking twice adds it once')
    assert.ok(items.findIndex((i) => i.id === net[0].id) < items.findIndex((i) => i.type === 'trash'), 'it goes before the recycle bin')
    await invoke('items:remove', net[0].id)
    assert.equal(typeof (await invoke('places:icon', 'network')), 'string', 'it has a picture')
  })

  await check('the power menu is a full-screen overlay and asks twice before ending the session', async () => {
    await invoke('items:activate', 'power1')
    const page = await until(async () => (await pages()).find((p) => p.url.includes('#/power')), 'power window')
    const conn = await connect(page)
    assert.equal(await until(async () => conn.call("document.querySelectorAll('.power__btn').length"), 'power buttons'), 5)
    await conn.call("document.querySelector('.power__btn--danger').click()")
    assert.equal(await conn.call("document.querySelector('.power__btn--danger').classList.contains('power__btn--armed')"), true, 'first click only arms the button')
    assert.match((await invoke('power:run', 'shutdown')).message, /dry run/, 'tests never touch the machine')
    conn.ws.close()
    await invoke('power:close')
  })

  await check('tweaks are listed with their current state (nothing is changed here)', async () => {
    const list = await invoke('tweaks:list')
    assert.ok(list.length >= 5 && list.every((t) => typeof t.enabled === 'boolean' && t.name))
    assert.deepEqual((await invoke('tweaks:set', 'no-such-tweak', true)).ok, false)
  })

  await check('moving the dock to the left resizes its window to a tall, narrow shape', async () => {
    await invoke('settings:update', { position: 'left' })
    await sleep(800)
    const size = await dock.call('({ w: innerWidth, h: innerHeight })')
    assert.ok(size.h > size.w, `expected portrait window, got ${size.w}x${size.h}`)
    await invoke('settings:update', { position: 'bottom' })
  })

  await check('edge offset and position along the edge move the dock window', async () => {
    const at = async (settings) => {
      await invoke('settings:update', settings)
      await sleep(500)
      return dock.call('({ x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight })')
    }
    const start = await at({ alignment: 0, edgeOffset: 6 })
    const end = await at({ alignment: 100 })
    assert.ok(end.x - start.x > 200, `sliding along the edge moves the window (${start.x} -> ${end.x})`)
    const near = await at({ alignment: 50, edgeOffset: 6 })
    const far = await at({ edgeOffset: 120 })
    assert.ok(near.y + near.h - (far.y + far.h) >= 100, 'a bigger offset lifts the dock off the bottom edge')
    await at({ alignment: 50, edgeOffset: 6 })
  })

  await check('the dock can sit above, among, or below other windows', async () => {
    const state = async (layer) => {
      await invoke('settings:update', { layer })
      await sleep(400)
      return (await invoke('dock:state')).onTop
    }
    assert.equal(await state('normal'), false, 'normal: other windows may cover the dock')
    assert.equal(await state('below'), false, 'below: not on top either (and pushed under the rest)')
    assert.equal(await state('above'), true, 'above: always on top')
  })

  await check('widgets can be added, render and be removed', async () => {
    const list = await invoke('widgets:add', 'clock')
    const widget = list.find((w) => w.type === 'clock')
    const page = await until(async () => (await pages()).find((p) => p.url.includes(`#/widget/${widget.id}`)), 'widget window')
    const conn = await connect(page)
    const text = await until(async () => conn.call(`document.querySelector('.wg-clock__time')?.textContent`), 'clock text')
    assert.match(text, /\d{2}:\d{2}/)
    conn.ws.close()
    const after = await invoke('widgets:remove', widget.id)
    assert.ok(!after.some((w) => w.id === widget.id))
  })

  await check('every widget kind renders, scales its window and follows its style', async () => {
    for (const type of ['analog', 'calendar', 'weather', 'system', 'media', 'battery', 'note']) {
      const list = await invoke('widgets:add', type)
      const widget = list[list.length - 1]
      assert.equal(widget.type, type)
      const page = await until(async () => (await pages()).find((p) => p.url.includes(`#/widget/${widget.id}`)), `${type} window`)
      const conn = await connect(page)
      await until(async () => conn.call(`!!document.querySelector('.widget--${type}')`), `${type} card`)
      const before = await conn.call('[window.innerWidth, window.innerHeight]')
      await invoke('widgets:update', widget.id, { style: 'accent', scale: 1.5 })
      await until(async () => conn.call(`document.querySelector('.widget').classList.contains('widget--accent')`), 'style applied')
      const after = await until(async () => { const s = await conn.call('[window.innerWidth, window.innerHeight]'); return s[0] > before[0] ? s : null }, 'window grows with the scale')
      assert.ok(after[0] > before[0] * 1.3 && after[1] > before[1] * 1.3, `${type} grows (${before} -> ${after})`)
      conn.ws.close()
      await invoke('widgets:remove', widget.id)
    }
  })

  await check('system stats are real numbers', async () => {
    const s = await invoke('widgets:system')
    assert.ok(s.ram > 0 && s.ram <= 100 && s.disk > 0)
  })

  await check('themes: built-ins listed, switching theme is stored', async () => {
    const themes = await invoke('themes:list')
    assert.ok(['glass-dark', 'frost-light', 'neon-night'].every((id) => themes.some((t) => t.id === id)))
    const next = await invoke('settings:update', { theme: 'frost-light' })
    assert.equal(next.theme, 'frost-light')
    await sleep(500)
    const accent = await dock.call(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`)
    assert.equal(accent, '#1e6fe0')
  })

  await check('recycle bin state is reported by the helper', async () => {
    const t = await invoke('trash:get')
    assert.ok(Number.isInteger(t.items) && t.items >= 0)
  })

  await check('auto-hide hides the dock until the pointer reaches the edge', async () => {
    await invoke('settings:update', { autoHide: true })
    await sleep(900)
    const hiddenClass = await dock.call(`document.querySelector('.dock').classList.contains('dock--hidden')`)
    assert.equal(hiddenClass, true)
    await invoke('settings:update', { autoHide: false })
    await sleep(500)
    assert.equal(await dock.call(`document.querySelector('.dock').classList.contains('dock--hidden')`), false)
  })

  dock.ws.close()
} catch (e) {
  results.push(['FAIL', `setup: ${e.message}`])
} finally {
  stop()
}

for (const [status, name] of results) console.log(`${status}  ${name}`)
const failed = results.filter(([s]) => s === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exitCode = failed ? 1 : 0
