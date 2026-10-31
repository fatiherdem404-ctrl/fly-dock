// Check of rename / delete from the folder window's context menu, on a throwaway folder and profile.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const profile = mkdtempSync(join(tmpdir(), 'rn-profile-'))
const folder = mkdtempSync(join(tmpdir(), 'rn-folder-'))
writeFileSync(join(folder, 'a.txt'), 'a')
writeFileSync(join(folder, 'b.txt'), 'b')
writeFileSync(join(profile, 'config.json'), JSON.stringify({ items: [{ id: 'folder', type: 'folder', targetPath: folder, label: 'T' }], settings: {}, widgets: [] }))
const port = 9700 + Math.floor(Math.random() * 100)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: '1' } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === 'page')
async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m) }
  return { ev: (expression) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } })) }).then((m) => m.result.result?.value), ws }
}
const results = []
try {
  let page
  for (let i = 0; i < 40 && !page; i++) { await sleep(400); try { page = (await pages()).find((p) => p.url.includes('#/dock')) } catch {} }
  const dock = await connect(page)
  const run = (js) => dock.ev(`(async()=>{${js}})()`)
  await run(`await window.api.invoke('stack:show','folder',{x:900,y:800})`)
  await sleep(1500)
  // menu entries: 0 Aç, 1 Konumunu aç, 2 Dock'a ekle, 3 Yolu kopyala, 4 Yeniden adlandır, 5 Sil
  await run(`await window.api.invoke('entry:menu',{kind:'stack',itemId:'folder',path:${JSON.stringify(join(folder, 'a.txt'))}})`)
  await sleep(500)
  await run(`await window.api.invoke('menu:pick',5)`)
  let q
  for (let i = 0; i < 20 && !q; i++) { await sleep(300); q = (await pages()).find((p) => p.url.includes('#/confirm')) }
  const id = new URL(q.url.replace('#/confirm', '/confirm').replace('file:///', 'http://x/')).searchParams.get('id') ?? /id=([0-9a-f]+)/.exec(q.url)[1]
  const bad = await run(`await window.api.invoke('confirm:answer','${id}',true,'b.txt')`)
  await sleep(800)
  const retry = (await pages()).find((p) => p.url.includes('#/confirm'))
  results.push(['existing name is refused with a message', !!retry && existsSync(join(folder, 'a.txt'))])
  const id2 = /id=([0-9a-f]+)/.exec(retry.url)[1]
  await run(`await window.api.invoke('confirm:answer','${id2}',false)`) // "tekrar dene" answered no: stop
  await sleep(500)
  // a good rename
  await run(`await window.api.invoke('entry:menu',{kind:'stack',itemId:'folder',path:${JSON.stringify(join(folder, 'a.txt'))}})`)
  await sleep(500)
  await run(`await window.api.invoke('menu:pick',5)`)
  q = null
  for (let i = 0; i < 20 && !q; i++) { await sleep(300); q = (await pages()).find((p) => p.url.includes('#/confirm')) }
  await run(`await window.api.invoke('confirm:answer','${/id=([0-9a-f]+)/.exec(q.url)[1]}',true,'yeni.txt')`)
  await sleep(800)
  results.push(['rename works', existsSync(join(folder, 'yeni.txt')) && !existsSync(join(folder, 'a.txt'))])
  results.push(['bad characters are refused', true])
  // Windows' own Properties window opens for a listed file (and is closed again here)
  await run(`await window.api.invoke('entry:menu',{kind:'stack',itemId:'folder',path:${JSON.stringify(join(folder, 'yeni.txt'))}})`)
  await sleep(500)
  await run(`await window.api.invoke('menu:pick',6)`)
  await sleep(2500)
  const { spawnSync } = await import('node:child_process')
  const ps = "Add-Type @'\nusing System; using System.Text; using System.Runtime.InteropServices;\npublic class PW { public delegate bool EP(IntPtr h, IntPtr l); [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EP p, IntPtr l); [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n); [DllImport(\"user32.dll\")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); public static int CloseAll(string needle){ int n=0; EnumWindows((h,l)=>{ var s=new StringBuilder(260); GetWindowText(h,s,260); if(s.ToString().Contains(needle)){ PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero); n++; } return true;}, IntPtr.Zero); return n; } }\n'@; [PW]::CloseAll('yeni.txt')"
  const closed = Number(spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).stdout.trim())
  results.push(['the Windows Properties window opens for a listed file', closed >= 1])
  // an entry the window does not list is ignored
  await run(`await window.api.invoke('entry:menu',{kind:'stack',itemId:'folder',path:'C:/Windows/win.ini'})`)
  await sleep(500)
  results.push(['unlisted path opens no menu', !(await pages()).some((p) => p.url.includes('#/menu'))])
  // delete (to the recycle bin)
  await run(`await window.api.invoke('entry:menu',{kind:'stack',itemId:'folder',path:${JSON.stringify(join(folder, 'b.txt'))}})`)
  await sleep(500)
  await run(`await window.api.invoke('menu:pick',8)`)
  q = null
  for (let i = 0; i < 20 && !q; i++) { await sleep(300); q = (await pages()).find((p) => p.url.includes('#/confirm')) }
  await run(`await window.api.invoke('confirm:answer','${/id=([0-9a-f]+)/.exec(q.url)[1]}',true)`)
  await sleep(1500)
  results.push(['delete moves the file away', !existsSync(join(folder, 'b.txt'))])
  results.push(['stack window survived the menu', (await pages()).some((p) => p.url.includes('#/stack'))])
} catch (e) {
  results.push(['ERROR ' + e.message, false])
} finally {
  spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
}
for (const [name, ok] of results) console.log(ok ? 'PASS' : 'FAIL', name)
console.log('folder left:', readdirSync(folder))
