// Starts the built app with a throw-away profile, drives the dock with synthetic mouse moves over the
// DevTools protocol and measures what a person would see: frame times, jitter once the pointer rests,
// overshoot, and whether icons ever poke out of the glass. Needs `npx vite build` first.
// Usage: node scripts/perf-dock.mjs [bottom|top|left|right] [--shot=path.png]
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const position = process.argv.find((a) => ['bottom', 'top', 'left', 'right'].includes(a)) ?? 'bottom'
const profile = mkdtempSync(join(tmpdir(), 'dock-perf-'))
const win = (p) => p.replaceAll('/', String.fromCharCode(92))
const app = (name, p) => ({ id: name, type: 'app', targetPath: win(p), label: name })
writeFileSync(
  join(profile, 'config.json'),
  JSON.stringify({
    schemaVersion: 5,
    items: [
      app('notepad', 'C:/Windows/System32/notepad.exe'),
      app('calc', 'C:/Windows/System32/calc.exe'),
      app('explorer', 'C:/Windows/explorer.exe'),
      { id: 'sep', type: 'separator' },
      app('cmd', 'C:/Windows/System32/cmd.exe'),
      { id: 'trash', type: 'trash' },
    ],
    settings: { position, material: 'none', theme: 'glass-dark' },
    widgets: [],
  }),
)

const port = 9333 + Math.floor(Math.random() * 500)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore', env: { ...process.env, FLY_DOCK_HEADLESS: process.argv.some((a) => a.startsWith('--shot=') || a.startsWith('--film=')) ? '0' : '1' } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stop = () => spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })

async function findDock() {
  for (let i = 0; i < 60; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const dock = pages.find((p) => p.url.includes('#/dock'))
      if (dock) return dock
    } catch { /* not up yet */ }
    await sleep(500)
  }
  throw new Error('dock window did not appear')
}

try {
  const page = await findDock()
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  }
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value

  await sleep(2500)
  const geometry = await evaluate(`(() => ({ w: innerWidth, h: innerHeight, icons: [...document.querySelectorAll('.dock-icon')].map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }) }))()`)
  const horizontal = position === 'bottom' || position === 'top'
  const centres = geometry.icons.map(([x, y]) => (horizontal ? x : y))
  const crossAt = horizontal ? geometry.icons[0][1] : geometry.icons[0][0]

  // frame recorder: icon sizes and containment violations on every animation frame
  await evaluate(`(() => {
    window.__rec = { t: [], sizes: [], insets: [] }
    const horizontal = ${horizontal}
    const tick = (now) => {
      const icons = [...document.querySelectorAll('.dock-icon')]
      const surface = document.querySelector('.dock__desk').getBoundingClientRect()
      window.__rec.t.push(now)
      window.__rec.sizes.push(icons.map(e => horizontal ? e.getBoundingClientRect().width : e.getBoundingClientRect().height))
      // how far the glass reaches past the union of all icons, per side
      const rects = icons.map(e => e.getBoundingClientRect())
      const u = { l: Math.min(...rects.map(r => r.left)), r: Math.max(...rects.map(r => r.right)), t: Math.min(...rects.map(r => r.top)), b: Math.max(...rects.map(r => r.bottom)) }
      window.__rec.insets.push([u.l - surface.left, surface.right - u.r, u.t - surface.top, surface.bottom - u.b])
      window.__rec.raf = requestAnimationFrame(tick)
    }
    window.__rec.raf = requestAnimationFrame(tick)
  })()`)

  // --film=path: capture the bottom-centre of the real screen every 110 ms while the pointer sweeps in and out
  // (bottom dock only), stacked into one image
  const film = process.argv.find((a) => a.startsWith('--film='))?.slice(7)
  if (film) {
    const script = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name W -Namespace D
[D.W]::SetProcessDPIAware() | Out-Null
$n = 14; $w = 1000; $h = 150
$sheet = New-Object System.Drawing.Bitmap $w, ($h * $n)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
for ($i = 0; $i -lt $n; $i++) {
  $g.CopyFromScreen([int](($b.Width - $w) / 2), $b.Height - $h - 60, 0, $i * $h, (New-Object System.Drawing.Size $w, $h))
  Start-Sleep -Milliseconds 110
}
$sheet.Save('${film}')`
    spawn('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
    await sleep(600)
  }
  const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: horizontal ? x : y, y: horizontal ? y : x })
  const first = centres[0]
  const last = centres[centres.length - 1]
  // sweep across the dock at a human speed, then rest on the last icon, then leave
  const SWEEP_MS = 1200
  const start = Date.now()
  while (Date.now() - start < SWEEP_MS) {
    const f = (Date.now() - start) / SWEEP_MS
    await move(first + (last - first) * f, crossAt)
    await sleep(8)
  }
  const restFrom = (await evaluate('window.__rec.t.length'))
  await move(last, crossAt)
  await sleep(900)
  const restTo = (await evaluate('window.__rec.t.length'))
  const peak = await evaluate('Math.max(...window.__rec.sizes.flat())')
  const shot = process.argv.find((a) => a.startsWith('--shot='))?.slice(7)
  if (shot) {
    // whole-screen capture while the pointer rests on the last icon (the real compositor, acrylic included)
    const script = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name W -Namespace D
[D.W]::SetProcessDPIAware() | Out-Null
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
[System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save('${shot}')`
    spawnSync('powershell', ['-NoProfile', '-Command', script])
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -50, y: -50 })
  await sleep(900)
  const rec = await evaluate('JSON.stringify({ t: window.__rec.t, sizes: window.__rec.sizes, insets: window.__rec.insets })')
  const data = JSON.parse(rec)

  const dts = data.t.slice(1).map((t, i) => t - data.t[i]).filter((d) => d < 200)
  dts.sort((a, b) => a - b)
  const pct = (p) => dts[Math.min(dts.length - 1, Math.floor(dts.length * p))]
  // jitter: after the pointer stops an icon may turn around once (it still carries momentum from the sweep),
  // but never oscillate: a second turn counts as jitter
  let reversals = 0
  for (let icon = 0; icon < data.sizes[0].length; icon++) {
    let direction = 0
    let turns = 0
    for (let f = restFrom + 1; f < restTo; f++) {
      const d = data.sizes[f][icon] - data.sizes[f - 1][icon]
      if (Math.abs(d) < 0.2) continue
      const sign = Math.sign(d)
      if (direction && sign !== direction) turns++
      direction = sign
    }
    if (turns > 1) reversals++
  }
  // The glass is drawn from the same numbers as the icons, so it must hug them with the same padding on every
  // frame: 10 px along the dock, 8 px across it. Reported separately for pointer-in, resting and pointer-out.
  const expected = horizontal ? [10, 10, 8, 8] : [8, 8, 10, 10]
  const worst = (from, to) => Math.max(0, ...data.insets.slice(from, to).flatMap((row) => row.map((v, i) => Math.abs(v - expected[i]))))
  const alignment = {
    pointerIn: +worst(0, restFrom).toFixed(2),
    resting: +worst(restFrom, restTo).toFixed(2),
    pointerOut: +worst(restTo, data.insets.length).toFixed(2),
  }
  const report = {
    position,
    frames: data.t.length,
    frameMs: { median: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), max: +dts[dts.length - 1].toFixed(1) },
    peakIconPx: +peak.toFixed(1),
    jitterReversalsWhileResting: reversals,
    glassAlignmentMaxErrorPx: alignment,
  }
  console.log(JSON.stringify(report))
  const failures = []
  if (report.frameMs.p95 > 25) failures.push('p95 frame time above 25 ms')
  if (reversals > 0) failures.push('icons jitter while the pointer rests')
  if (report.peakIconPx > 84.5) failures.push('icons overshoot the configured magnified size')
  for (const [phase, err] of Object.entries(alignment)) if (err >= 1) failures.push(`glass drifts from the icons while ${phase} (${err}px)`)
  ws.close()
  if (failures.length) {
    console.error('FAILED:', failures.join('; '))
    process.exitCode = 1
  }
} finally {
  stop()
}
