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
    schemaVersion: 3,
    items: [
      app('notepad', 'C:/Windows/System32/notepad.exe'),
      app('calc', 'C:/Windows/System32/calc.exe'),
      app('explorer', 'C:/Windows/explorer.exe'),
      { id: 'sep', type: 'separator' },
      app('cmd', 'C:/Windows/System32/cmd.exe'),
      { id: 'trash', type: 'trash' },
    ],
    settings: { position, material: 'acrylic', theme: 'glass-dark' },
    widgets: [],
  }),
)

const port = 9333 + Math.floor(Math.random() * 500)
const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { stdio: 'ignore' })
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
    window.__rec = { t: [], sizes: [], violations: 0 }
    const horizontal = ${horizontal}
    const tick = (now) => {
      const icons = [...document.querySelectorAll('.dock-icon')]
      const surface = document.querySelector('.dock__surface').getBoundingClientRect()
      window.__rec.t.push(now)
      window.__rec.sizes.push(icons.map(e => horizontal ? e.getBoundingClientRect().width : e.getBoundingClientRect().height))
      for (const e of icons) {
        const r = e.getBoundingClientRect()
        const slack = 1.5
        if (r.left < surface.left - slack || r.right > surface.right + slack || r.top < surface.top - slack || r.bottom > surface.bottom + slack) { window.__rec.violations++; break }
      }
      window.__rec.raf = requestAnimationFrame(tick)
    }
    window.__rec.raf = requestAnimationFrame(tick)
  })()`)

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
  const rec = await evaluate('JSON.stringify({ t: window.__rec.t, sizes: window.__rec.sizes, violations: window.__rec.violations })')
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
  const report = {
    position,
    frames: data.t.length,
    frameMs: { median: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), max: +dts[dts.length - 1].toFixed(1) },
    peakIconPx: +peak.toFixed(1),
    jitterReversalsWhileResting: reversals,
    framesWithIconOutsideGlass: data.violations,
  }
  console.log(JSON.stringify(report))
  const failures = []
  if (report.frameMs.p95 > 25) failures.push('p95 frame time above 25 ms')
  if (reversals > 0) failures.push('icons jitter while the pointer rests')
  if (report.peakIconPx > 84.5) failures.push('icons overshoot the configured magnified size')
  if (report.framesWithIconOutsideGlass > 0) failures.push('icons poke out of the glass')
  ws.close()
  if (failures.length) {
    console.error('FAILED:', failures.join('; '))
    process.exitCode = 1
  }
} finally {
  stop()
}
