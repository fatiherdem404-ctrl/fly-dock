// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useMemo, useRef } from 'react'
import type { Pointer } from '@/live'

/**
 * Runs a scene written by the user. The code lives in a sandboxed iframe (no same-origin, so it cannot reach the app,
 * Electron or the file system; it only gets a canvas), and talks to the page by messages: pointer, clicks, pause in,
 * errors out. A scene defines any of these top-level functions:
 *   init(ctx, view)              once, and again when the size changes
 *   draw(ctx, t, dt, pointer)    every frame; t and dt in seconds
 *   click(x, y)                  a click, in view pixels
 * `view` is { width, height }, `pointer` is { x, y, nx, ny, on, down } (nx, ny run 0..1).
 */

const HARNESS = String.raw`
const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const view = { width: 0, height: 0 }
const pointer = { x: 0, y: 0, nx: 0.5, ny: 0.5, on: false, down: false }
let scene = { init: null, draw: null, click: null }
let paused = false, failed = false, last = 0, t0 = 0, warm = 45, gap = 1000 / 30
const fail = (e) => {
  if (failed) return
  failed = true
  let line = 0
  const m = /<anonymous>:(\d+):\d+/.exec(String(e && e.stack))
  if (m) line = Math.max(1, Number(m[1]) - 2)
  parent.postMessage({ fly: 'scene-error', message: String((e && e.message) || e), line }, '*')
}
const fit = () => {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight)
  const k = Math.min(dpr, Math.sqrt(2200000 / (w * h)))
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  ctx.setTransform(k, 0, 0, k, 0, 0)
  view.width = w
  view.height = h
  if (scene.init && !failed) { try { scene.init(ctx, view) } catch (e) { fail(e) } }
}
const frame = (now) => {
  requestAnimationFrame(frame)
  // a paused scene still draws its first moments, so a thumbnail is never a black square
  if (failed || !scene.draw || (paused && warm <= 0)) { last = now; return }
  // a screen may refresh at 144 Hz; a wallpaper does not need to, and the fans do not need to hear it
  if (now - last < gap - 2) return
  warm--
  const dt = Math.min(0.1, (now - last) / 1000 || 0.016)
  last = now
  try {
    ctx.save()
    scene.draw(ctx, (now - t0) / 1000, dt, pointer)
    ctx.restore()
  } catch (e) { fail(e) }
}
window.addEventListener('message', (ev) => {
  const d = ev.data
  if (!d || typeof d !== 'object') return
  if (d.fly === 'pointer') { pointer.nx = d.x; pointer.ny = d.y; pointer.x = d.x * view.width; pointer.y = d.y * view.height; pointer.on = !!d.on }
  else if (d.fly === 'click') { pointer.down = true; setTimeout(() => { pointer.down = false }, 120); if (scene.click && !failed) { try { scene.click(d.x * view.width, d.y * view.height) } catch (e) { fail(e) } } }
  else if (d.fly === 'pause') paused = !!d.v
  else if (d.fly === 'fps') gap = 1000 / Math.max(5, Math.min(120, Number(d.v) || 30))
})
window.addEventListener('resize', fit)
window.addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.nx = e.clientX / view.width; pointer.ny = e.clientY / view.height; pointer.on = true })
window.addEventListener('mouseleave', () => { pointer.on = false })
window.addEventListener('mousedown', (e) => { pointer.down = true; if (scene.click && !failed) { try { scene.click(e.clientX, e.clientY) } catch (err) { fail(err) } } })
window.addEventListener('mouseup', () => { pointer.down = false })
window.addEventListener('error', (e) => { fail(e.error || e.message); e.preventDefault() })
try {
  const make = new Function('canvas', 'ctx', 'view', 'pointer', CODE + '\n;return { init: typeof init === "function" ? init : null, draw: typeof draw === "function" ? draw : null, click: typeof click === "function" ? click : null }')
  scene = make(canvas, ctx, view, pointer)
} catch (e) { fail(e) }
t0 = performance.now()
fit()
if (!failed && !scene.draw && !scene.init) fail(new Error('Kodda draw ya da init işlevi yok'))
requestAnimationFrame(frame)
parent.postMessage({ fly: 'scene-ready' }, '*')
`

export function sceneDocument(code: string): string {
  // the code is embedded as a JSON string; < is escaped so the page can never see an early </script>
  const literal = JSON.stringify(code)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029')
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100%;height:100%}</style><canvas id="c"></canvas><script>const CODE = ${literal};${HARNESS}</script>`
}

export interface SceneError {
  message: string
  line: number
}

interface Props {
  code: string
  paused?: boolean
  /** Frames per second the scene is drawn at (default 30). */
  fps?: number
  /** Live pointer in 0..1, fed from outside when the frame cannot see the mouse itself (the desktop wallpaper). */
  pointer?: Pointer
  onError?: (e: SceneError | null) => void
  className?: string
}

export default function SceneFrame({ code, paused = false, fps = 30, pointer, onError, className }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const doc = useMemo(() => sceneDocument(code), [code])
  const report = useRef(onError)
  report.current = onError
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const fpsRef = useRef(fps)
  fpsRef.current = fps

  useEffect(() => {
    report.current?.(null)
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== frame.current?.contentWindow) return
      const d = ev.data
      if (d?.fly === 'scene-ready') {
        frame.current?.contentWindow?.postMessage({ fly: 'pause', v: pausedRef.current }, '*')
        frame.current?.contentWindow?.postMessage({ fly: 'fps', v: fpsRef.current }, '*')
      }
      if (d?.fly === 'scene-error') report.current?.({ message: String(d.message).slice(0, 300), line: Number(d.line) || 0 })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [doc])

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ fly: 'pause', v: paused }, '*')
  }, [paused, doc])
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ fly: 'fps', v: fps }, '*')
  }, [fps, doc])

  // the wallpaper window gets no mouse events, so the shared pointer is relayed at a steady rate
  useEffect(() => {
    if (!pointer || paused) return
    let clicks = pointer.clickN
    const timer = setInterval(() => {
      const w = frame.current?.contentWindow
      if (!w) return
      w.postMessage({ fly: 'pointer', x: pointer.x, y: pointer.y, on: pointer.on }, '*')
      if (pointer.clickN !== clicks) {
        clicks = pointer.clickN
        w.postMessage({ fly: 'click', x: pointer.cx, y: pointer.cy }, '*')
      }
    }, 33)
    return () => clearInterval(timer)
  }, [pointer, paused, doc])

  return <iframe ref={frame} className={className} title="Sahne" sandbox="allow-scripts" srcDoc={doc} style={{ border: 0, width: '100%', height: '100%', display: 'block' }} />
}
