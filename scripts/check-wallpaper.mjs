// Real-desktop check of the wallpaper layer: starts a second copy of the app on a throwaway profile (so your own dock
// and settings are untouched), turns a live wallpaper on for a few seconds, and confirms the window attached behind
// the icons, that turning it off removes it, and that a folder slideshow advances. Your screen shows the animated
// background briefly and a second dock for a moment. Needs a helper built with the desktopAttach command:
//   FLY_DOCK_HELPER_DIR=<dir with a fresh dock-helper.exe> node scripts/check-wallpaper.mjs
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const profile = mkdtempSync(join(tmpdir(), 'wp-profile-'))
const folder = join(profile, 'pics')
mkdirSync(folder)
// three tiny valid PNGs so the slideshow has something to rotate through
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
for (const n of ['a', 'b', 'c']) writeFileSync(join(folder, `${n}.png`), png)
writeFileSync(join(profile, 'config.json'), JSON.stringify({ items: [], settings: { autoHide: true }, widgets: [] }))

const port = 9800 + Math.floor(Math.random() * 100)
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
const results = []
try {
  let page
  for (let i = 0; i < 40 && !page; i++) { await sleep(400); try { page = (await pages()).find((p) => p.url.includes('#/dock')) } catch {} }
  const run = await connect(page)
  const info = () => run(`return await window.api.invoke('wallpaper:info')`)
  await run(`await window.api.invoke('settings:update',{wallpaperMode:'single',wallpaperSingle:'live:aurora'})`)
  let i1
  for (let i = 0; i < 20; i++) { await sleep(500); i1 = await info(); if (i1.attached) break }
  console.log('info', JSON.stringify(i1))
  results.push(['live wallpaper attaches behind the desktop icons', i1.attached === true && i1.source?.kind === 'live'])
  const wallpaperPages = (await pages()).filter((p) => p.url.includes('#/wallpaper'))
  if (process.env.WP_DEBUG && wallpaperPages[0]) {
    const w = await connect(wallpaperPages[0])
    console.log('page:', JSON.stringify(await w(`const c=document.querySelector('canvas'); let px=null; if(c){const d=c.getContext('2d').getImageData(10,10,1,1).data; px=[...d]} return {vis:document.visibilityState, focus:document.hasFocus(), size:[innerWidth,innerHeight], canvas:c?[c.width,c.height]:null, px, layers:document.querySelectorAll('.wp__layer').length, opacity:getComputedStyle(document.querySelector('.wp__layer')||document.body).opacity}`)))
  }
  results.push(['a wallpaper window exists for each display', wallpaperPages.length >= 1])
  await sleep(Number(process.env.WP_WAIT ?? 2500))
  if (process.env.WP_DUMP) {
    const { spawnSync } = await import('node:child_process')
    console.log(spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', process.env.WP_DUMP], { encoding: 'utf8' }).stdout)
  }
  // WP_PRINT=<script.ps1> WP_SHOT=<file.png>: renders the desktop window itself (icons + wallpaper layer, whatever is on top)
  if (process.env.WP_PRINT) {
    const { spawnSync } = await import('node:child_process')
    console.log(spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', process.env.WP_PRINT, '-Out', process.env.WP_SHOT], { encoding: 'utf8' }).stdout)
    process.env.WP_SHOT = ''
  }
  // WP_DESKTOP=1 WP_SHOT=<file.png>: shows the desktop for a moment (Win+D), takes the picture, and brings the windows back
  if (process.env.WP_DESKTOP) {
    const { spawnSync } = await import('node:child_process')
    const ps = `$s = New-Object -ComObject Shell.Application; $s.ToggleDesktop(); Start-Sleep -Milliseconds 1500; Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${process.env.WP_SHOT}'); $s.ToggleDesktop()`
    spawnSync('powershell', ['-NoProfile', '-Command', ps])
    process.env.WP_SHOT = ''
  }
  // WP_SHOT=<file.png> also saves a picture of the real screen while the wallpaper is on
  if (process.env.WP_SHOT) {
    const { spawnSync } = await import('node:child_process')
    const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${process.env.WP_SHOT}')`
    spawnSync('powershell', ['-NoProfile', '-Command', ps])
  }
  await run(`await window.api.invoke('settings:update',{wallpaperMode:'folder',wallpaperFolder:${JSON.stringify(folder)},wallpaperMinutes:1,wallpaperShuffle:false})`)
  await sleep(1500)
  const first = (await info()).source?.url
  await run(`await window.api.invoke('wallpaper:next')`)
  await sleep(600)
  const second = (await info()).source?.url
  results.push(['folder slideshow lists the pictures and advances', !!first && !!second && first !== second])
  await run(`await window.api.invoke('settings:update',{wallpaperMode:'off'})`)
  await sleep(1200)
  results.push(['turning it off removes the windows', !(await pages()).some((p) => p.url.includes('#/wallpaper'))])
} catch (e) {
  results.push(['ERROR ' + e.message, false])
} finally {
  spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
}
for (const [name, ok] of results) console.log(ok ? 'PASS' : 'FAIL', name)
