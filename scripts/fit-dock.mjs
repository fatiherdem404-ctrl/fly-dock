// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Checks that nothing is ever cut off by the dock window: for every edge, several extreme settings and several
// display scale factors, the pointer sweeps the whole dock and on every animation frame every icon, label and
// the desk must lie inside the window. Run after `npx vite build`:  node scripts/fit-dock.mjs [--scales=1,1.25,1.5,2]
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'

const scales = (process.argv.find((a) => a.startsWith('--scales='))?.slice(9) ?? '1,1.25,1.5,2').split(',').map(Number)
const win = (p) => p.replaceAll('/', String.fromCharCode(92))
const windir = process.env.SystemRoot ?? 'C:/Windows'
const exe = (name, file, label) => ({ id: name, type: 'app', targetPath: win(`${windir}/System32/${file}`), label })
const items = [
  exe('a', 'notepad.exe', 'A rather long application name for the first icon'),
  exe('b', 'calc.exe', 'Calculator'),
  { id: 'sep', type: 'separator' },
  exe('c', 'cmd.exe', 'Command prompt'),
  exe('d', 'mspaint.exe', 'Paint'),
  exe('e', 'write.exe', 'WordPad'),
  { id: 'trash', type: 'trash' },
]

const SCENARIOS = [
  { name: 'defaults', settings: {} },
  { name: 'huge icons, 3x growth, wide radius', settings: { iconSize: 72, maxScale: 2.4, magnificationRadius: 4, labelMode: 'always', labelSize: 20 } },
  { name: '3D wood desk, deep, big paddings', settings: { deskStyle: 'wood', deskDepth: 60, deskPadTop: 40, deskPadBottom: 40, deskPadLeft: 48, deskPadRight: 48, labelMode: 'always' } },
  { name: 'wave + mirror + bouncy spring', settings: { hoverAnimation: 'wave', deskStyle: 'mirror', deskDepth: 40, animationCurve: 'bounce', maxScale: 2.4, labelMode: 'always', labelSize: 16 } },
  { name: '3D glass with a thick front face and no bottom padding', settings: { deskStyle: 'glass3d', deskDepth: 50, deskEdge: 30, deskPadBottom: 0, deskPadTop: 0, labelMode: 'always' } },
  { name: 'square shelf with different corner radii', settings: { deskStyle: 'metal', deskDepth: 40, deskEdge: 16, deskRadTL: 0, deskRadTR: 30, deskRadBL: 20, deskRadBR: 0, labelMode: 'always' } },
  { name: 'lift, shelf fixed, no labels', settings: { hoverAnimation: 'lift', shelfGrows: false, labelMode: 'never', iconSpacing: 0, maxScale: 2.5 } },
]
// every scenario starts from the same defaults so one scenario's settings never leak into the next
const BASE = {
  theme: 'glass-dark', showRunningApps: false, showTrash: true,
  iconSize: 48, maxScale: 1.75, magnificationRadius: 2, magnification: true, falloff: 'cosine', iconSpacing: 8,
  deskStyle: 'glass', deskDepth: 0, deskEdge: 0, deskOpacity: 1, deskRadTL: 60, deskRadTR: 60, deskRadBL: 60, deskRadBR: 60, shelfGrows: true,
  deskPadTop: 10, deskPadBottom: 10, deskPadLeft: 16, deskPadRight: 16, deskPadLinked: false,
  hoverAnimation: 'zoom', animationCurve: 'spring', labelMode: 'hover', labelSize: 12,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0

for (const scale of scales) {
  const profile = mkdtempSync(join(tmpdir(), 'dock-fit-'))
  writeFileSync(join(profile, 'config.json'), JSON.stringify({ schemaVersion: 6, items, settings: BASE, widgets: [] }))
  const port = 9300 + Math.floor(Math.random() * 500)
  const child = spawn(electronPath, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, `--force-device-scale-factor=${scale}`], {
    stdio: 'ignore',
    env: { ...process.env, FLY_DOCK_HEADLESS: '1' },
  })
  const stop = () => spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
  try {
    let page
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(400)
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((p) => p.url.includes('#/dock')) } catch { /* starting */ }
    }
    if (!page) throw new Error('dock window did not appear')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((r) => (ws.onopen = r))
    let id = 0
    const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m) }
    const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result?.value
    await sleep(2000)

    for (const position of ['bottom', 'top', 'left', 'right']) {
      for (const scenario of SCENARIOS) {
        await evaluate(`window.api.invoke('settings:update', ${JSON.stringify({ ...BASE, ...scenario.settings, position })})`)
        await sleep(900)
        const horizontal = position === 'bottom' || position === 'top'
        await evaluate(`(() => {
          window.__fit = { worst: 0, what: '', frames: 0 }
          const check = () => {
            const W = innerWidth, H = innerHeight
            const els = [...document.querySelectorAll('.dock-icon, .dock-icon__label, .dock__desk')]
            for (const el of els) {
              const r = el.getBoundingClientRect()
              const over = Math.max(0 - r.left, r.right - W, 0 - r.top, r.bottom - H)
              if (over > window.__fit.worst) { window.__fit.worst = over; window.__fit.what = el.className + ' ' + JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round)) + ' in ' + W + 'x' + H }
            }
            window.__fit.frames++
            window.__fit.raf = requestAnimationFrame(check)
          }
          window.__fit.raf = requestAnimationFrame(check)
        })()`)
        const geometry = await evaluate(`[...document.querySelectorAll('.dock-icon')].map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })`)
        const mains = geometry.map(([x, y]) => (horizontal ? x : y))
        const cross = horizontal ? geometry[0][1] : geometry[0][0]
        const move = (m) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: horizontal ? m : cross, y: horizontal ? cross : m })
        // end icon, the other end, the middle, then back off the dock: the extremes are where the row sticks out most
        for (const target of [mains[0], mains[mains.length - 1], mains[Math.floor(mains.length / 2)], mains[0]]) {
          for (let k = 0; k < 8; k++) { await move(target + (k - 4) * 2); await sleep(30) }
          await sleep(350)
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -40, y: -40 })
        await sleep(300)
        const result = await evaluate('(cancelAnimationFrame(window.__fit.raf), JSON.stringify(window.__fit))')
        const { worst, what, frames } = JSON.parse(result)
        const ok = worst <= 0.5
        if (!ok) failed++
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${scale}x  ${position.padEnd(6)}  ${scenario.name}  (${frames} frames${ok ? '' : `, ${worst.toFixed(1)}px outside: ${what}`})`)
      }
    }
    ws.close()
  } catch (e) {
    failed++
    console.log(`FAIL  ${scale}x  setup: ${e.message}`)
  } finally {
    stop()
  }
}
console.log(failed ? `\n${failed} scenario(s) cut something off` : '\nnothing is cut off in any scenario')
process.exitCode = failed ? 1 : 0
