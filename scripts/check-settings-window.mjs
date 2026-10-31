// Real-window check of the settings window: it opens without a system frame at the default size, the title-bar
// buttons work, and the size is remembered after closing. Runs a second copy of the app on a throwaway profile, so your
// own dock stays untouched; a window flashes on screen for a few seconds.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const profile = mkdtempSync(join(tmpdir(), 'sw-profile-'))
writeFileSync(join(profile, 'config.json'), JSON.stringify({ items: [], settings: { autoHide: true }, widgets: [] }))
const port = 9900 + Math.floor(Math.random() * 80)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === 'page')
async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m) }
  return (js) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression: `(async()=>{${js}})()`, returnByValue: true, awaitPromise: true } })) }).then((m) => m.result.result?.value)
}
const waitFor = async (find, tries = 50) => { for (let i = 0; i < tries; i++) { try { const r = await find(); if (r) return r } catch { /* not up yet */ } await sleep(300) } return null }
const results = []
try {
  const dock = await connect(await waitFor(async () => (await pages()).find((p) => p.url.includes('#/dock'))))
  await dock(`await window.api.invoke('app:open-settings')`)
  let settings = await waitFor(async () => (await pages()).find((p) => p.url.includes('#/settings')))
  let page = await connect(settings)
  await waitFor(async () => page(`return !!document.querySelector('.st-title')`))
  results.push(['settings opens with our own title bar', await page(`return !!document.querySelector('.st-title__buttons') && !!document.querySelector('.st-nav')`)])
  const size = () => page(`return [window.outerWidth, window.outerHeight]`)
  const [w0, h0] = await size()
  results.push(['default size is about 1100 x 760', Math.abs(w0 - 1100) < 40 && Math.abs(h0 - 760) < 60])
  await page(`await window.api.invoke('window:control','maximize')`)
  await sleep(700)
  results.push(['maximize button maximizes', (await page(`return await window.api.invoke('window:is-maximized')`)) === true])
  await page(`await window.api.invoke('window:control','maximize')`)
  await sleep(700)
  results.push(['a second click restores', (await page(`return await window.api.invoke('window:is-maximized')`)) === false])
  // the window is closed from the title bar; it must come back at the remembered size
  void page(`await window.api.invoke('window:control','close')`)
  await sleep(900)
  results.push(['close button closes the window', !(await pages()).some((p) => p.url.includes('#/settings'))])
  await dock(`await window.api.invoke('app:open-settings')`)
  settings = await waitFor(async () => (await pages()).find((p) => p.url.includes('#/settings')))
  page = await connect(settings)
  await waitFor(async () => page(`return !!document.querySelector('.st-title')`))
  const [w1, h1] = await size()
  results.push(['it reopens at the remembered size', Math.abs(w1 - w0) <= 2 && Math.abs(h1 - h0) <= 2])
  void page(`await window.api.invoke('window:control','close')`)
} catch (e) {
  results.push(['ERROR ' + e.message, false])
} finally {
  spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
}
for (const [name, ok] of results) console.log(ok ? 'PASS' : 'FAIL', name)
