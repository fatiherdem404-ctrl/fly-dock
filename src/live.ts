// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// The built-in live wallpapers: canvas scenes that need no files. Each one is tinted from the theme's accent colour
// (hue 0..360), runs at 30 fps and stops completely when stopped, so a paused wallpaper costs nothing.
// Every scene reacts to the mouse and to clicks. The wallpaper sits behind the desktop icons and cannot be clicked, so the
// app watches the cursor and the desktop clicks and feeds them into a Pointer the scenes read (see feedPointer, clickPointer).
//
// Scenes draw in a fixed "design" size (so their sizes and speeds stay the same) onto a canvas that may be much sharper:
// `view.sx/sy` scale the design coordinates up to the real pixels.

type Draw = (t: number, dt: number) => void

/** Where the cursor is over a scene, 0..1 across it, how fast it moves, whether it is over the scene, and the last click. */
export interface Pointer {
  x: number
  y: number
  /** Speed in screen widths per second, smoothed. */
  speed: number
  vx: number
  vy: number
  on: boolean
  at: number
  /** Counts clicks; the last one was at (cx, cy), 0..1. */
  clickN: number
  cx: number
  cy: number
}

/** The scene's drawing area: `w`/`h` are design units, `sx`/`sy` turn them into canvas pixels. */
export interface View {
  w: number
  h: number
  sx: number
  sy: number
}

export const makePointer = (): Pointer => ({ x: 0.5, y: 0.5, speed: 0, vx: 0, vy: 0, on: false, at: 0, clickN: 0, cx: 0.5, cy: 0.5 })

/** Updates a pointer from a new position; the velocity comes from the time since the last one. */
export function feedPointer(p: Pointer, x: number, y: number, on: boolean) {
  const now = performance.now()
  if (p.at && on && p.on) {
    const dt = Math.max(0.005, (now - p.at) / 1000)
    const vx = (x - p.x) / dt
    const vy = (y - p.y) / dt
    p.vx = p.vx * 0.5 + vx * 0.5
    p.vy = p.vy * 0.5 + vy * 0.5
    p.speed = Math.hypot(p.vx, p.vy)
  } else {
    p.vx = 0
    p.vy = 0
    p.speed = 0
  }
  p.x = x
  p.y = y
  p.on = on
  p.at = now
}

/** Records a click (position 0..1) for the scenes to react to. */
export function clickPointer(p: Pointer, x: number, y: number) {
  p.cx = x
  p.cy = y
  p.clickN += 1
}

function loop(draw: Draw, fps = 30): () => void {
  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now - last < 1000 / fps - 2) return
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    draw(now / 1000, dt)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** A pointer that glides: the scene reads smoothed coordinates and a 0..1 "presence" that fades in and out. */
function follower(ptr: Pointer) {
  const f = { x: 0.5, y: 0.5, presence: 0 }
  return {
    f,
    step(dt: number) {
      const k = 1 - Math.exp(-dt * 7)
      if (ptr.on) {
        f.x += (ptr.x - f.x) * k
        f.y += (ptr.y - f.y) * k
      }
      f.presence += ((ptr.on ? 1 : 0) - f.presence) * (1 - Math.exp(-dt * 3))
      return f
    },
  }
}

/** Returns the click that happened since the last call (position 0..1), or null. */
function clicks(ptr: Pointer) {
  let seen = ptr.clickN
  return (): { x: number; y: number } | null => {
    if (ptr.clickN === seen) return null
    seen = ptr.clickN
    return { x: ptr.cx, y: ptr.cy }
  }
}

/** A little film grain laid over smooth gradients: it breaks the visible bands that 8-bit colour makes in them. */
function grainer(c: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 128
  const t = tile.getContext('2d')!
  const img = t.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 112 + Math.random() * 32
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  t.putImageData(img, 0, 0)
  const pattern = c.createPattern(tile, 'repeat')!
  return () => {
    // just enough to dither 8-bit banding; anything stronger reads as dirty noise
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalCompositeOperation = 'soft-light'
    c.globalAlpha = 0.1
    c.fillStyle = pattern
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.restore()
  }
}

const prep = (c: CanvasRenderingContext2D, v: View) => {
  c.setTransform(v.sx, 0, 0, v.sy, 0, 0)
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
}

interface Burst {
  x: number
  y: number
  age: number
}

/** Soft drifting clouds of light that lean toward the cursor, with a bright one that follows it; a click sends a ring of light. */
function aurora(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const bursts: Burst[] = []
  const blobs = Array.from({ length: 6 }, (_, i) => ({ sx: rand(0.05, 0.14), sy: rand(0.05, 0.12), px: rand(0, 6.28), py: rand(0, 6.28), r: rand(0.35, 0.6), hue: hue + (i - 2.5) * 22 }))
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const k = click()
    if (k) bursts.push({ x: k.x * w, y: k.y * h, age: 0 })
    c.fillStyle = hsl(hue, 55, 7)
    c.fillRect(0, 0, w, h)
    c.globalCompositeOperation = 'lighter'
    for (const b of blobs) {
      const lean = f.presence * 0.16
      const x = w * (0.5 + 0.42 * Math.sin(t * b.sx * 6.28 + b.px)) + (f.x - 0.5) * w * lean
      const y = h * (0.5 + 0.38 * Math.sin(t * b.sy * 6.28 + b.py)) + (f.y - 0.5) * h * lean
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * b.r)
      g.addColorStop(0, hsl(b.hue, 80, 48, 0.5))
      g.addColorStop(1, hsl(b.hue, 80, 40, 0))
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
    if (f.presence > 0.01) {
      const x = f.x * w
      const y = f.y * h
      const r = Math.max(w, h) * (0.2 + Math.min(0.12, ptr.speed * 0.08))
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, hsl(hue + 30, 90, 62, 0.55 * f.presence))
      g.addColorStop(1, hsl(hue + 30, 90, 50, 0))
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      b.age += dt
      if (b.age > 1.6) {
        bursts.splice(i, 1)
        continue
      }
      const r = (0.04 + b.age * 0.5) * Math.max(w, h)
      const a = (1 - b.age / 1.6) * 0.65
      const g = c.createRadialGradient(b.x, b.y, r * 0.5, b.x, b.y, r)
      g.addColorStop(0, hsl(hue + 50, 95, 70, 0))
      g.addColorStop(0.75, hsl(hue + 50, 95, 70, a))
      g.addColorStop(1, hsl(hue + 50, 95, 70, 0))
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
    grain()
  })
}

/** A slowly turning two-colour gradient with moving lights; it tilts toward the cursor, a light follows it, a click makes a shock ring. */
function flow(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const bursts: Burst[] = []
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const k = click()
    if (k) bursts.push({ x: k.x * w, y: k.y * h, age: 0 })
    const a = t * 0.05 + (f.x - 0.5) * 0.9 * f.presence
    const dx = Math.cos(a) * w
    const dy = Math.sin(a) * h
    const g = c.createLinearGradient(w / 2 - dx / 2, h / 2 - dy / 2, w / 2 + dx / 2, h / 2 + dy / 2)
    g.addColorStop(0, hsl(hue + 10 * Math.sin(t * 0.1), 65, 22))
    g.addColorStop(0.5, hsl(hue + 35, 70, 30))
    g.addColorStop(1, hsl(hue + 70 + 15 * Math.cos(t * 0.08), 65, 20))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 3; i++) {
      const x = w * (0.5 + 0.4 * Math.sin(t * (0.07 + i * 0.03) + i * 2))
      const y = h * (0.5 + 0.4 * Math.cos(t * (0.06 + i * 0.025) + i))
      const r = Math.max(w, h) * 0.35
      const l = c.createRadialGradient(x, y, 0, x, y, r)
      l.addColorStop(0, hsl(hue + 40 + i * 25, 90, 60, 0.28))
      l.addColorStop(1, hsl(hue + 40 + i * 25, 90, 60, 0))
      c.fillStyle = l
      c.fillRect(0, 0, w, h)
    }
    if (f.presence > 0.01) {
      const x = f.x * w
      const y = f.y * h
      const l = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.3)
      l.addColorStop(0, hsl(hue + 60, 95, 66, 0.4 * f.presence))
      l.addColorStop(1, hsl(hue + 60, 95, 60, 0))
      c.fillStyle = l
      c.fillRect(0, 0, w, h)
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      b.age += dt
      if (b.age > 1.4) {
        bursts.splice(i, 1)
        continue
      }
      const r = (0.03 + b.age * 0.55) * Math.max(w, h)
      const al = (1 - b.age / 1.4) * 0.55
      const l = c.createRadialGradient(b.x, b.y, r * 0.7, b.x, b.y, r)
      l.addColorStop(0, hsl(hue + 90, 95, 72, 0))
      l.addColorStop(0.8, hsl(hue + 90, 95, 72, al))
      l.addColorStop(1, hsl(hue + 90, 95, 72, 0))
      c.fillStyle = l
      c.fillRect(0, 0, w, h)
    }
    grain()
  })
}

/** Stars with depth: they drift with the cursor, light up near it and join into a constellation; a flick throws a shooting star, a click a burst of sparks. */
function stars(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const w0 = v.w
  const h0 = v.h
  const field = Array.from({ length: Math.round((w0 * h0) / 6500) }, () => ({ x: Math.random() * w0, y: Math.random() * h0, r: rand(0.4, 1.7), tw: rand(0.4, 1.8), ph: rand(0, 6.28), v: rand(1, 6) }))
  const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = []
  let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null
  let next = rand(3, 8)
  let cooldown = 0
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, hsl(hue, 55, 5))
    g.addColorStop(1, hsl(hue + 12, 45, 15))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const reach = Math.max(70, w * 0.1)
    const near: { x: number; y: number }[] = []
    for (const s of field) {
      s.x -= s.v * dt * 0.6
      if (s.x < -2) s.x = w + 2
      // bigger stars are closer: they move more as the cursor moves
      const depth = s.r / 1.7
      const x = s.x - (f.x - 0.5) * 36 * depth * f.presence
      const y = s.y - (f.y - 0.5) * 22 * depth * f.presence
      const d = Math.hypot(x - px, y - py)
      const lit = f.presence > 0.05 ? Math.max(0, 1 - d / reach) * f.presence : 0
      if (lit > 0.05 && near.length < 14) near.push({ x, y })
      const a = 0.45 + 0.55 * Math.sin(t * s.tw + s.ph)
      const alpha = Math.min(1, Math.max(0.1, a) + lit)
      if (s.r > 1.2) {
        // the bigger, nearer stars get a soft halo
        const halo = c.createRadialGradient(x, y, 0, x, y, s.r * 5)
        halo.addColorStop(0, hsl(hue + 20, 60, 85, 0.35 * alpha))
        halo.addColorStop(1, hsl(hue + 20, 60, 85, 0))
        c.fillStyle = halo
        c.beginPath()
        c.arc(x, y, s.r * 5, 0, 6.283)
        c.fill()
      }
      c.fillStyle = hsl(hue + 20, 30, 92, alpha)
      c.beginPath()
      c.arc(x, y, s.r * (1 + lit * 0.9), 0, 6.283)
      c.fill()
    }
    if (near.length > 1 && f.presence > 0.05) {
      c.strokeStyle = hsl(hue + 25, 60, 85, 0.28 * f.presence)
      c.lineWidth = 1
      c.beginPath()
      for (const s of near) {
        c.moveTo(px, py)
        c.lineTo(s.x, s.y)
      }
      for (let i = 0; i < near.length; i++) {
        for (let j = i + 1; j < near.length; j++) {
          if (Math.hypot(near[i].x - near[j].x, near[i].y - near[j].y) < reach * 0.8) {
            c.moveTo(near[i].x, near[i].y)
            c.lineTo(near[j].x, near[j].y)
          }
        }
      }
      c.stroke()
    }
    const k = click()
    if (k) {
      for (let i = 0; i < 46; i++) {
        const a = rand(0, 6.283)
        const sp = rand(60, 280)
        sparks.push({ x: k.x * w, y: k.y * h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 })
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vx *= 1 - dt * 1.8
      s.vy *= 1 - dt * 1.8
      s.life -= dt * 0.9
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      c.fillStyle = hsl(hue + 30, 70, 90, s.life)
      c.beginPath()
      c.arc(s.x, s.y, 1.1 + s.life * 1.4, 0, 6.283)
      c.fill()
    }
    next -= dt
    cooldown -= dt
    if (!shoot && ptr.on && ptr.speed > 1.4 && cooldown <= 0) {
      // a quick flick of the cursor throws a star the way it was flicked
      const sp = Math.hypot(ptr.vx, ptr.vy) || 1
      shoot = { x: px, y: py, vx: (ptr.vx / sp) * 700, vy: (ptr.vy / sp) * 700, life: 1 }
      cooldown = 2
    }
    if (!shoot && next <= 0) {
      shoot = { x: rand(w * 0.3, w), y: rand(0, h * 0.4), vx: -rand(500, 800), vy: rand(200, 360), life: 1 }
      next = rand(6, 14)
    }
    if (shoot) {
      shoot.x += shoot.vx * dt
      shoot.y += shoot.vy * dt
      shoot.life -= dt * 1.1
      const len = 140
      const tail = c.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * (len / 700), shoot.y - shoot.vy * (len / 700))
      tail.addColorStop(0, hsl(hue + 20, 40, 95, Math.max(0, shoot.life)))
      tail.addColorStop(1, hsl(hue + 20, 40, 95, 0))
      c.strokeStyle = tail
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(shoot.x, shoot.y)
      c.lineTo(shoot.x - shoot.vx * (len / 700), shoot.y - shoot.vy * (len / 700))
      c.stroke()
      if (shoot.life <= 0) shoot = null
    }
  })
}

/** Layered waves on a real water surface: the cursor pushes the water and the disturbance spreads and fades; a click is a big splash. */
function waves(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const cols = 120
  const u = new Float32Array(cols + 2)
  const vel = new Float32Array(cols + 2)
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    // the wave equation on the columns: each one is pulled toward its neighbours, and the motion slowly dies out
    const steps = Math.max(1, Math.round(dt * 60))
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i <= cols; i++) vel[i] += (u[i - 1] + u[i + 1] - 2 * u[i]) * 0.35 - u[i] * 0.004
      for (let i = 1; i <= cols; i++) {
        vel[i] *= 0.985
        u[i] += vel[i]
      }
    }
    if (ptr.on && f.presence > 0.2) {
      const ci = Math.round(f.x * (cols - 1)) + 1
      const push = Math.min(1.4, 0.15 + ptr.speed * 0.9) * (f.y > 0.35 ? 1 : 0.4)
      for (let k = -2; k <= 2; k++) {
        const j = ci + k
        if (j >= 1 && j <= cols) u[j] += push * (1 - Math.abs(k) / 3) * dt * 4 * (ptr.speed > 0.05 ? 1 : 0.2) * (Math.sin(t * 9) > 0 ? 1 : -1)
      }
    }
    const k = click()
    if (k) {
      const ci = Math.round(k.x * (cols - 1)) + 1
      for (let d = -7; d <= 7; d++) {
        const j = ci + d
        if (j >= 1 && j <= cols) vel[j] += 1.4 * (1 - Math.abs(d) / 8)
      }
    }
    const sky = c.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, hsl(hue + 30, 60, 62))
    sky.addColorStop(0.6, hsl(hue + 10, 55, 40))
    sky.addColorStop(1, hsl(hue, 60, 22))
    c.fillStyle = sky
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < 5; i++) {
      const base = h * (0.52 + i * 0.1)
      const amp = h * (0.018 + i * 0.006)
      const top: number[] = []
      c.beginPath()
      c.moveTo(0, h)
      for (let x = 0; x <= w + 8; x += 8) {
        const idx = clamp(Math.round((x / w) * (cols - 1)) + 1, 1, cols)
        const y = base + amp * Math.sin(x * (0.004 + i * 0.0007) + t * (0.35 + i * 0.12) + i * 1.7) + amp * 0.5 * Math.sin(x * 0.011 - t * (0.5 + i * 0.08) + i) + u[idx] * h * (0.03 + i * 0.012)
        c.lineTo(x, y)
        top.push(y)
      }
      c.lineTo(w, h)
      c.closePath()
      const body = c.createLinearGradient(0, base - amp * 2, 0, h)
      body.addColorStop(0, hsl(hue + i * 7, 62, 26 + i * 7, 0.7 + i * 0.07))
      body.addColorStop(1, hsl(hue + i * 7, 62, 14 + i * 5, 0.9))
      c.fillStyle = body
      c.fill()
      // a light crest along the top of each layer
      c.beginPath()
      top.forEach((y, n) => (n === 0 ? c.moveTo(0, y) : c.lineTo(n * 8, y)))
      c.strokeStyle = hsl(hue + 20 + i * 6, 70, 82, 0.18 + i * 0.03)
      c.lineWidth = 1.2
      c.stroke()
    }
    grain()
  })
}

interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  r: number
}

/** Floating bubbles with a glossy iridescent skin; they drift away from the cursor, and a click pops the one it lands on. */
function bubbles(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const w0 = v.w
  const h0 = v.h
  const make = (anywhere: boolean) => ({ x: Math.random() * w0, y: anywhere ? Math.random() * h0 : h0 + 80, r: rand(10, 70), vy: rand(10, 40), ph: rand(0, 6.28), sw: rand(8, 26), h: hue + rand(-30, 30), ox: 0, oy: 0 })
  const list = Array.from({ length: 36 }, () => make(true))
  const drops: Drop[] = []
  const rings: { x: number; y: number; r: number; a: number; h: number }[] = []
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, hsl(hue, 60, 16))
    g.addColorStop(1, hsl(hue + 40, 60, 28))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const reach = Math.max(90, w * 0.14)
    const k = click()
    for (let bi = 0; bi < list.length; bi++) {
      const b = list[bi]
      b.y -= b.vy * dt
      if (b.y < -b.r) Object.assign(b, make(false), { y: h + b.r })
      const x0 = b.x + Math.sin(t * 0.6 + b.ph) * b.sw
      let tx = 0
      let ty = 0
      if (f.presence > 0.05) {
        const dx = x0 + b.ox - px
        const dy = b.y + b.oy - py
        const d = Math.hypot(dx, dy) || 1
        if (d < reach + b.r) {
          const push = (1 - d / (reach + b.r)) * (60 + ptr.speed * 90) * f.presence
          tx = (dx / d) * push
          ty = (dy / d) * push
        }
      }
      b.ox += (tx - b.ox) * (1 - Math.exp(-dt * 5))
      b.oy += (ty - b.oy) * (1 - Math.exp(-dt * 5))
      const x = x0 + b.ox
      const y = b.y + b.oy
      if (k && Math.hypot(x - k.x * w, y - k.y * h) < b.r + 10) {
        // pop: a ring, a spray of droplets, and a new bubble starts from below
        rings.push({ x, y, r: b.r, a: 0.8, h: b.h })
        for (let i = 0; i < 14; i++) {
          const a = rand(0, 6.283)
          const sp = rand(40, 190)
          drops.push({ x: x + Math.cos(a) * b.r * 0.8, y: y + Math.sin(a) * b.r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 1, r: rand(1.5, 4) })
        }
        Object.assign(b, make(false))
        continue
      }
      // the skin: a faint body, a bright rim, a colour-shifting edge and a highlight like a window's reflection
      const fill = c.createRadialGradient(x - b.r * 0.25, y - b.r * 0.3, b.r * 0.05, x, y, b.r)
      fill.addColorStop(0, hsl(b.h, 85, 85, 0.3))
      fill.addColorStop(0.7, hsl(b.h, 80, 65, 0.08))
      fill.addColorStop(0.92, hsl(b.h + 70, 90, 70, 0.28))
      fill.addColorStop(1, hsl(b.h - 60, 90, 75, 0.38))
      c.fillStyle = fill
      c.beginPath()
      c.arc(x, y, b.r, 0, 6.283)
      c.fill()
      c.strokeStyle = hsl(b.h, 80, 92, 0.38)
      c.lineWidth = 1.3
      c.stroke()
      c.fillStyle = 'rgba(255,255,255,0.55)'
      c.beginPath()
      c.ellipse(x - b.r * 0.38, y - b.r * 0.4, b.r * 0.2, b.r * 0.11, -0.7, 0, 6.283)
      c.fill()
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.r += 90 * dt
      r.a -= dt * 2
      if (r.a <= 0) {
        rings.splice(i, 1)
        continue
      }
      c.strokeStyle = hsl(r.h, 80, 90, r.a)
      c.lineWidth = 2
      c.beginPath()
      c.arc(r.x, r.y, r.r, 0, 6.283)
      c.stroke()
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 260 * dt
      d.life -= dt * 1.6
      if (d.life <= 0) {
        drops.splice(i, 1)
        continue
      }
      c.fillStyle = hsl(hue + 20, 80, 85, d.life * 0.8)
      c.beginPath()
      c.arc(d.x, d.y, d.r * d.life, 0, 6.283)
      c.fill()
    }
    grain()
  })
}

/** A web of drifting points: near ones join with lines, the cursor is a node that pulls its neighbours in, a click is a shock wave. */
function network(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const w0 = v.w
  const h0 = v.h
  const n = clamp(Math.round((w0 * h0) / 5200), 40, 130)
  const pts = Array.from({ length: n }, () => ({ x: Math.random() * w0, y: Math.random() * h0, vx: rand(-12, 12), vy: rand(-12, 12), r: rand(1.2, 2.6) }))
  const shocks: Burst[] = []
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const bg = c.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, hsl(hue, 55, 8))
    bg.addColorStop(1, hsl(hue + 30, 50, 16))
    c.fillStyle = bg
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const link = Math.max(60, w * 0.13)
    const pull = link * 1.7
    const k = click()
    if (k) {
      shocks.push({ x: k.x * w, y: k.y * h, age: 0 })
      for (const p of pts) {
        const dx = p.x - k.x * w
        const dy = p.y - k.y * h
        const d = Math.hypot(dx, dy) || 1
        if (d < w * 0.5) {
          const imp = (1 - d / (w * 0.5)) * 340
          p.vx += (dx / d) * imp
          p.vy += (dy / d) * imp
        }
      }
    }
    for (const p of pts) {
      if (f.presence > 0.05) {
        const dx = px - p.x
        const dy = py - p.y
        const d = Math.hypot(dx, dy)
        if (d < pull && d > 8) {
          const kk = (1 - d / pull) * 38 * f.presence
          p.vx += (dx / d) * kk * dt
          p.vy += (dy / d) * kk * dt
        }
      }
      p.vx *= 1 - dt * 0.9
      p.vy *= 1 - dt * 0.9
      p.vx += Math.sin(t * 0.5 + p.y) * 0.4 * dt * 10
      p.vy += Math.cos(t * 0.45 + p.x) * 0.4 * dt * 10
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.x < 0 || p.x > w) p.vx *= -1
      if (p.y < 0 || p.y > h) p.vy *= -1
      p.x = clamp(p.x, 0, w)
      p.y = clamp(p.y, 0, h)
    }
    c.lineWidth = 1
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
        if (d < link) {
          c.strokeStyle = hsl(hue + 25, 70, 70, (1 - d / link) * 0.32)
          c.beginPath()
          c.moveTo(pts[i].x, pts[i].y)
          c.lineTo(pts[j].x, pts[j].y)
          c.stroke()
        }
      }
      if (f.presence > 0.05) {
        const d = Math.hypot(pts[i].x - px, pts[i].y - py)
        if (d < pull) {
          c.strokeStyle = hsl(hue + 50, 90, 78, (1 - d / pull) * 0.55 * f.presence)
          c.beginPath()
          c.moveTo(pts[i].x, pts[i].y)
          c.lineTo(px, py)
          c.stroke()
        }
      }
    }
    for (const p of pts) {
      const halo = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
      halo.addColorStop(0, hsl(hue + 30, 80, 82, 0.35))
      halo.addColorStop(1, hsl(hue + 30, 80, 82, 0))
      c.fillStyle = halo
      c.beginPath()
      c.arc(p.x, p.y, p.r * 4, 0, 6.283)
      c.fill()
      c.fillStyle = hsl(hue + 30, 80, 86, 0.95)
      c.beginPath()
      c.arc(p.x, p.y, p.r, 0, 6.283)
      c.fill()
    }
    if (f.presence > 0.05) {
      const g = c.createRadialGradient(px, py, 0, px, py, 18)
      g.addColorStop(0, hsl(hue + 50, 95, 80, 0.9 * f.presence))
      g.addColorStop(1, hsl(hue + 50, 95, 70, 0))
      c.fillStyle = g
      c.beginPath()
      c.arc(px, py, 18, 0, 6.283)
      c.fill()
    }
    for (let i = shocks.length - 1; i >= 0; i--) {
      const s = shocks[i]
      s.age += dt
      if (s.age > 1.2) {
        shocks.splice(i, 1)
        continue
      }
      c.strokeStyle = hsl(hue + 60, 90, 80, (1 - s.age / 1.2) * 0.7)
      c.lineWidth = 2
      c.beginPath()
      c.arc(s.x, s.y, s.age * w * 0.4, 0, 6.283)
      c.stroke()
    }
  })
}

/** Still dark water: the cursor leaves rings that spread and fade, a click drops a stone, and now and then a drop falls on its own. */
function ripples(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const rings: { x: number; y: number; r: number; a: number; speed: number; w: number }[] = []
  let sinceRing = 0
  let nextDrop = rand(1, 3)
  let lastX = -1
  let lastY = -1
  return loop((_t, dt) => {
    prep(c, v)
    const w = v.w
    const h = v.h
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, hsl(hue + 8, 55, 14))
    g.addColorStop(1, hsl(hue - 6, 60, 7))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    sinceRing += dt
    nextDrop -= dt
    if (ptr.on) {
      const x = ptr.x * w
      const y = ptr.y * h
      const moved = lastX < 0 ? 0 : Math.hypot(x - lastX, y - lastY)
      if (sinceRing > 0.11 && moved > 4) {
        rings.push({ x, y, r: 2, a: clamp(0.35 + ptr.speed * 0.4, 0.3, 0.8), speed: 55 + ptr.speed * 60, w: 1.6 })
        sinceRing = 0
      }
      lastX = x
      lastY = y
    } else lastX = -1
    const k = click()
    if (k) {
      for (let i = 0; i < 4; i++) rings.push({ x: k.x * w, y: k.y * h, r: 2 - i * 10, a: 0.95 - i * 0.12, speed: 150 - i * 22, w: 2.6 - i * 0.4 })
    }
    if (nextDrop <= 0) {
      rings.push({ x: rand(0.1, 0.9) * w, y: rand(0.1, 0.9) * h, r: 2, a: 0.5, speed: 60, w: 1.6 })
      nextDrop = rand(2.5, 6)
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.r += r.speed * dt
      r.a -= dt * 0.28
      if (r.a <= 0) {
        rings.splice(i, 1)
        continue
      }
      if (r.r <= 0) continue
      c.strokeStyle = hsl(hue + 30, 70, 74, r.a)
      c.lineWidth = r.w
      c.beginPath()
      c.arc(r.x, r.y, r.r, 0, 6.283)
      c.stroke()
      c.strokeStyle = hsl(hue + 30, 70, 74, r.a * 0.45)
      c.lineWidth = r.w * 0.7
      c.beginPath()
      c.arc(r.x, r.y, r.r * 0.78, 0, 6.283)
      c.stroke()
    }
    if (rings.length > 160) rings.splice(0, rings.length - 160)
    grain()
  })
}

/** Fireflies that wander in the dark, come to the cursor and circle it, scatter when it is flicked or clicked (and a few new ones appear). */
function fireflies(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const grain = grainer(c, canvas)
  const w0 = v.w
  const h0 = v.h
  const make = (x = Math.random() * w0, y = Math.random() * h0) => ({ x, y, vx: 0, vy: 0, a: rand(0, 6.28), ph: rand(0, 6.28), sp: rand(0.8, 1.6), r: rand(2, 4) })
  const flies = Array.from({ length: clamp(Math.round((w0 * h0) / 9000), 24, 70) }, () => make())
  const flashes: Burst[] = []
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, hsl(hue + 20, 45, 6))
    g.addColorStop(1, hsl(hue + 35, 50, 12))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const scatter = ptr.on && ptr.speed > 1.6
    const k = click()
    if (k) {
      flashes.push({ x: k.x * w, y: k.y * h, age: 0 })
      for (const q of flies) {
        const dx = q.x - k.x * w
        const dy = q.y - k.y * h
        const d = Math.hypot(dx, dy) || 1
        if (d < w * 0.45) {
          q.vx += (dx / d) * 520 * (1 - d / (w * 0.45))
          q.vy += (dy / d) * 520 * (1 - d / (w * 0.45))
        }
      }
      for (let i = 0; i < 8; i++) {
        const q = make(k.x * w, k.y * h)
        const a = rand(0, 6.283)
        q.vx = Math.cos(a) * rand(120, 320)
        q.vy = Math.sin(a) * rand(120, 320)
        flies.push(q)
      }
      if (flies.length > 100) flies.splice(0, flies.length - 100)
    }
    c.globalCompositeOperation = 'lighter'
    for (const q of flies) {
      q.a += (Math.sin(t * 0.7 + q.ph) * 1.2 + rand(-0.5, 0.5)) * dt
      let ax = Math.cos(q.a) * 20 * q.sp
      let ay = Math.sin(q.a) * 20 * q.sp
      if (f.presence > 0.05) {
        const dx = px - q.x
        const dy = py - q.y
        const d = Math.hypot(dx, dy) || 1
        if (scatter && d < w * 0.3) {
          ax -= (dx / d) * 420
          ay -= (dy / d) * 420
        } else if (d < w * 0.35) {
          // pulled in until about arm's length, then swirled around it
          const want = w * 0.07
          const kk = (d - want) * 1.4 * f.presence
          ax += (dx / d) * kk + (-dy / d) * 34 * f.presence
          ay += (dy / d) * kk + (dx / d) * 34 * f.presence
        }
      }
      q.vx += ax * dt
      q.vy += ay * dt
      q.vx *= 1 - dt * 1.6
      q.vy *= 1 - dt * 1.6
      q.x = (q.x + q.vx * dt + w) % w
      q.y = (q.y + q.vy * dt + h) % h
      const glow = 0.45 + 0.55 * Math.sin(t * 2.2 * q.sp + q.ph)
      const r = q.r * (1.5 + glow * 0.9)
      const rg = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3)
      rg.addColorStop(0, hsl(hue + 45, 95, 82, 0.95 * (0.5 + glow * 0.5)))
      rg.addColorStop(0.25, hsl(hue + 45, 95, 66, 0.55 * (0.4 + glow * 0.6)))
      rg.addColorStop(1, hsl(hue + 45, 95, 60, 0))
      c.fillStyle = rg
      c.beginPath()
      c.arc(q.x, q.y, r * 3, 0, 6.283)
      c.fill()
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const s = flashes[i]
      s.age += dt
      if (s.age > 0.9) {
        flashes.splice(i, 1)
        continue
      }
      const r = 30 + s.age * 260
      const fg = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, r)
      fg.addColorStop(0, hsl(hue + 45, 95, 80, (1 - s.age / 0.9) * 0.6))
      fg.addColorStop(1, hsl(hue + 45, 95, 60, 0))
      c.fillStyle = fg
      c.beginPath()
      c.arc(s.x, s.y, r, 0, 6.283)
      c.fill()
    }
    grain()
  })
}

/** A spinning galaxy of points whose centre follows the cursor; a flick makes it flare and a click sets off a supernova. */
function galaxy(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const click = clicks(ptr)
  const count = 1700
  const parts = Array.from({ length: count }, (_, i) => {
    const arm = i % 3
    const r = Math.pow(Math.random(), 0.7)
    const a = r * 7 + (arm * Math.PI * 2) / 3 + rand(-0.3, 0.3)
    return { r, a, jitter: rand(-1, 1), z: rand(0.4, 1), hue: hue + rand(-20, 40) + r * 40 }
  })
  const cx = { x: 0.5, y: 0.5 }
  let flare = 0
  let kick = 0
  const novas: Burst[] = []
  return loop((t, dt) => {
    prep(c, v)
    const f = fol.step(dt)
    const w = v.w
    const h = v.h
    c.fillStyle = hsl(hue + 10, 50, 4, 0.5)
    c.fillRect(0, 0, w, h)
    const tx = ptr.on ? f.x : 0.5
    const ty = ptr.on ? f.y : 0.5
    cx.x += (tx - cx.x) * (1 - Math.exp(-dt * 2.5))
    cx.y += (ty - cx.y) * (1 - Math.exp(-dt * 2.5))
    flare += ((ptr.on && ptr.speed > 1.2 ? 1 : 0) - flare) * (1 - Math.exp(-dt * 2))
    const k = click()
    if (k) {
      kick = 1
      flare = 1.6
      novas.push({ x: k.x * w, y: k.y * h, age: 0 })
    }
    kick *= Math.exp(-dt * 2.2)
    const size = Math.min(w, h) * (0.62 + flare * 0.12)
    c.globalCompositeOperation = 'lighter'
    const px = cx.x * w
    const py = cx.y * h
    const core = c.createRadialGradient(px, py, 0, px, py, size * 0.28)
    core.addColorStop(0, hsl(hue + 40, 90, 72, 0.5 + flare * 0.3))
    core.addColorStop(1, hsl(hue + 40, 90, 55, 0))
    c.fillStyle = core
    c.fillRect(0, 0, w, h)
    for (const p of parts) {
      const spin = t * (0.5 / (0.25 + p.r)) * 0.3
      const ang = p.a + spin
      const rr = (p.r * size * 0.6 + p.jitter * size * 0.02) * (1 + kick * 0.35 * Math.sin(p.r * 9 - t * 6))
      const x = px + Math.cos(ang) * rr
      const y = py + Math.sin(ang) * rr * 0.55
      c.fillStyle = hsl(p.hue, 80, 74, 0.55 * p.z * (1 - p.r * 0.4))
      c.fillRect(x, y, p.z * 1.8 + 0.6, p.z * 1.8 + 0.6)
    }
    for (let i = novas.length - 1; i >= 0; i--) {
      const s = novas[i]
      s.age += dt
      if (s.age > 1.5) {
        novas.splice(i, 1)
        continue
      }
      const r = s.age * Math.max(w, h) * 0.45
      const al = (1 - s.age / 1.5) * 0.7
      const g = c.createRadialGradient(s.x, s.y, r * 0.8, s.x, s.y, r)
      g.addColorStop(0, hsl(hue + 50, 95, 80, 0))
      g.addColorStop(0.85, hsl(hue + 50, 95, 80, al))
      g.addColorStop(1, hsl(hue + 50, 95, 80, 0))
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
  })
}

// ------------------------------------------------------------------ the oil-slick scene (WebGL)

const FLUID_VERT = `#version 300 es
in vec2 aPosition;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`
const FLUID_HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
`
const FLUID_FRAG: Record<string, string> = {
  advection: 'uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;\nvoid main () { vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize; outColor = texture(uSource, coord) / (1.0 + dissipation * dt); }',
  divergence: 'uniform sampler2D uVelocity;\nvoid main () {\n  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x; float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;\n  vec2 C = texture(uVelocity, vUv).xy;\n  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;\n  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);\n}',
  curl: 'uniform sampler2D uVelocity;\nvoid main () {\n  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y; float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;\n  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);\n}',
  vorticity: 'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;\nvoid main () {\n  float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x; float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x; float C = texture(uCurl, vUv).x;\n  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n  force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;\n  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;\n  outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);\n}',
  pressure: 'uniform sampler2D uPressure; uniform sampler2D uDivergence;\nvoid main () {\n  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;\n  outColor = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);\n}',
  gradient: 'uniform sampler2D uPressure; uniform sampler2D uVelocity;\nvoid main () {\n  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;\n  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);\n  outColor = vec4(velocity, 0.0, 1.0);\n}',
  splat: 'uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;\nvoid main () {\n  vec2 p = vUv - point; p.x *= aspect;\n  outColor = vec4(texture(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);\n}',
  clear: 'uniform sampler2D uTexture; uniform float value;\nvoid main () { outColor = value * texture(uTexture, vUv); }',
  // the dye is shown like a film of oil on water: its thickness picks an interference colour, its slope catches a highlight
  display: 'uniform sampler2D uTexture; uniform float time;\nvec3 pal (float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }\nfloat lum (vec3 c) { return max(c.r, max(c.g, c.b)); }\nvoid main () {\n  vec3 c = texture(uTexture, vUv).rgb;\n  float hL = lum(texture(uTexture, vL).rgb); float hR = lum(texture(uTexture, vR).rgb);\n  float hT = lum(texture(uTexture, vT).rgb); float hB = lum(texture(uTexture, vB).rgb);\n  vec3 n = normalize(vec3(hL - hR, hB - hT, 0.22));\n  float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 28.0);\n  float l = lum(c);\n  vec3 iri = pal(l * 1.9 + (hL - hR) * 3.5 + (hB - hT) * 2.0 + time * 0.025);\n  vec3 col = mix(c, iri * min(l * 1.6 + 0.12, 1.0), 0.62) + spec * 0.4 * min(l * 3.0, 1.0);\n  vec3 bg = mix(vec3(0.012, 0.016, 0.045), vec3(0.035, 0.045, 0.10), vUv.y);\n  outColor = vec4(1.0 - exp(-(bg + col) * 1.5), 1.0);\n}',
}

/** Whether this machine can run the fluid scene (WebGL2 with float render targets). */
function fluidSupported(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    return !!gl && !!gl.getExtension('EXT_color_buffer_float')
  } catch {
    return false
  }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: return [v, t, p]
    case 1: return [q, v, p]
    case 2: return [p, v, t]
    case 3: return [p, q, v]
    case 4: return [t, p, v]
    default: return [v, p, q]
  }
}

/** Colours that flow into each other like oil on water: the cursor stirs them, a click makes them burst out. */
function fluid(canvas: HTMLCanvasElement, hue: number, ptr: Pointer, v: View) {
  if (!fluidSupported()) return aurora(canvas, hue, ptr, v)
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext
  gl.getExtension('EXT_color_buffer_float')
  const click = clicks(ptr)
  const aspect = canvas.width / canvas.height

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const programs: Record<string, { prog: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }> = {}
  const vert = compile(gl.VERTEX_SHADER, FLUID_VERT)
  for (const [name, body] of Object.entries(FLUID_FRAG)) {
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FLUID_HEAD + body))
    gl.bindAttribLocation(prog, 0, 'aPosition')
    gl.linkProgram(prog)
    const uniforms: Record<string, WebGLUniformLocation | null> = {}
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!
      uniforms[info.name] = gl.getUniformLocation(prog, info.name)
    }
    programs[name] = { prog, uniforms }
  }
  const quad = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  interface Target { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; texel: [number, number] }
  const makeTarget = (w: number, h: number): Target => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { tex, fbo, w, h, texel: [1 / w, 1 / h] }
  }
  const makeDouble = (w: number, h: number) => {
    let a = makeTarget(w, h)
    let b = makeTarget(w, h)
    return { get read() { return a }, get write() { return b }, swap() { const t = a; a = b; b = t } }
  }
  const size = (res: number): [number, number] => (aspect >= 1 ? [Math.round(res * aspect), res] : [res, Math.round(res / aspect)])
  const [vw, vh] = size(128)
  const [dw, dh] = size(640)
  const velocity = makeDouble(vw, vh)
  const dye = makeDouble(dw, dh)
  const pressure = makeDouble(vw, vh)
  const divergence = makeTarget(vw, vh)
  const curl = makeTarget(vw, vh)

  const use = (name: string) => {
    gl.useProgram(programs[name].prog)
    return programs[name].uniforms
  }
  const bind = (loc: WebGLUniformLocation | null, tex: WebGLTexture, unit: number) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(loc, unit)
  }
  const blit = (target: Target | null) => {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, target.w, target.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  const splat = (x: number, y: number, dx: number, dy: number, rgb: [number, number, number], radius = 0.0028) => {
    const r = aspect > 1 ? radius * aspect : radius
    let u = use('splat')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uTarget, velocity.read.tex, 0)
    gl.uniform1f(u.aspect, aspect)
    gl.uniform2f(u.point, x, y)
    gl.uniform3f(u.color, dx, dy, 0)
    gl.uniform1f(u.radius, r)
    blit(velocity.write)
    velocity.swap()
    u = use('splat')
    gl.uniform2f(u.texelSize, dye.read.texel[0], dye.read.texel[1])
    bind(u.uTarget, dye.read.tex, 0)
    gl.uniform3f(u.color, rgb[0], rgb[1], rgb[2])
    blit(dye.write)
    dye.swap()
  }
  const colour = (h: number, amount = 0.55): [number, number, number] => {
    const c = hsvToRgb(((h % 1) + 1) % 1, 0.85, 1)
    return [c[0] * amount, c[1] * amount, c[2] * amount]
  }

  let lastX = ptr.x
  let lastY = ptr.y
  let tone = hue / 360
  let nextIdle = 0.3
  const stop = loop((t, dt0) => {
    const dt = Math.min(dt0, 1 / 24)
    // the cursor stirs the liquid: its movement is the force, and the colour drifts as it goes
    if (ptr.on) {
      const dx = ptr.x - lastX
      const dy = ptr.y - lastY
      if (Math.abs(dx) + Math.abs(dy) > 0.0004) {
        tone += 0.004 + Math.hypot(dx, dy) * 0.4
        splat(ptr.x, 1 - ptr.y, dx * 5200, -dy * 5200, colour(tone + 0.2 * Math.sin(t * 0.7), 0.34))
      }
    }
    lastX = ptr.x
    lastY = ptr.y
    const k = click()
    if (k) {
      // a click: a ring of splats pushing outward, each its own colour
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.283 + rand(-0.2, 0.2)
        splat(k.x + Math.cos(a) * 0.015, 1 - k.y - Math.sin(a) * 0.015, Math.cos(a) * 1700, Math.sin(a) * 1700, colour(tone + i / 9, 0.7), 0.0042)
      }
      tone += 0.17
    }
    nextIdle -= dt
    if (nextIdle <= 0) {
      // now and then something drips in by itself, so the surface never goes dead
      const a = rand(0, 6.283)
      splat(rand(0.15, 0.85), rand(0.2, 0.85), Math.cos(a) * rand(300, 900), Math.sin(a) * rand(300, 900), colour(rand(0, 1), 0.34), 0.003)
      nextIdle = rand(1.6, 4)
    }

    gl.disable(gl.BLEND)
    let u = use('curl')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uVelocity, velocity.read.tex, 0)
    blit(curl)
    u = use('vorticity')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uVelocity, velocity.read.tex, 0)
    bind(u.uCurl, curl.tex, 1)
    gl.uniform1f(u.curl, 24)
    gl.uniform1f(u.dt, dt)
    blit(velocity.write)
    velocity.swap()
    u = use('divergence')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uVelocity, velocity.read.tex, 0)
    blit(divergence)
    u = use('clear')
    bind(u.uTexture, pressure.read.tex, 0)
    gl.uniform1f(u.value, 0.8)
    blit(pressure.write)
    pressure.swap()
    u = use('pressure')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uDivergence, divergence.tex, 0)
    for (let i = 0; i < 18; i++) {
      bind(u.uPressure, pressure.read.tex, 1)
      blit(pressure.write)
      pressure.swap()
    }
    u = use('gradient')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uPressure, pressure.read.tex, 0)
    bind(u.uVelocity, velocity.read.tex, 1)
    blit(velocity.write)
    velocity.swap()
    u = use('advection')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uVelocity, velocity.read.tex, 0)
    bind(u.uSource, velocity.read.tex, 1)
    gl.uniform1f(u.dt, dt)
    gl.uniform1f(u.dissipation, 0.25)
    blit(velocity.write)
    velocity.swap()
    u = use('advection')
    gl.uniform2f(u.texelSize, velocity.read.texel[0], velocity.read.texel[1])
    bind(u.uVelocity, velocity.read.tex, 0)
    bind(u.uSource, dye.read.tex, 1)
    gl.uniform1f(u.dt, dt)
    gl.uniform1f(u.dissipation, 1.0)
    blit(dye.write)
    dye.swap()
    u = use('display')
    gl.uniform2f(u.texelSize, dye.read.texel[0], dye.read.texel[1])
    bind(u.uTexture, dye.read.tex, 0)
    gl.uniform1f(u.time, t)
    blit(null)
  }, 40)
  return () => {
    stop()
    // free the GPU memory; the context itself stays usable in case the same canvas is started again
    for (const p of Object.values(programs)) gl.deleteProgram(p.prog)
    for (const target of [velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write, divergence, curl]) {
      gl.deleteTexture(target.tex)
      gl.deleteFramebuffer(target.fbo)
    }
    gl.deleteBuffer(quad)
  }
}

/** Design-size factor of each scene (the scene is laid out as if the screen were this fraction of its real size). */
const SCALE: Record<string, number> = { aurora: 0.3, flow: 0.3, waves: 0.5, stars: 0.75, bubbles: 0.6, network: 0.5, ripples: 0.5, fireflies: 0.45, galaxy: 0.5, fluid: 0.5 }
/** Canvas pixels per real screen pixel: smooth scenes can be soft, line and shape scenes are drawn at full sharpness. */
const SHARP: Record<string, number> = { aurora: 0.3, flow: 0.3, waves: 1, stars: 1, bubbles: 1, network: 1, ripples: 1, fireflies: 0.7, galaxy: 0.8, fluid: 0.75 }
const SCENES: Record<string, (canvas: HTMLCanvasElement, hue: number, ptr: Pointer, view: View) => () => void> = { aurora, flow, stars, waves, bubbles, network, ripples, fireflies, galaxy, fluid }

/** Starts a scene on the canvas and returns the function that stops it. The pointer is read every frame (see feedPointer). */
export function startLive(canvas: HTMLCanvasElement, id: string, hue: number, size?: { w: number; h: number }, pointer: Pointer = makePointer()): () => void {
  const scene = SCENES[id] ?? SCENES.aurora
  const k = SCALE[id] ?? 0.5
  const q = SHARP[id] ?? 1
  const dpr = window.devicePixelRatio || 1
  const designW = size ? size.w : Math.max(64, Math.round(window.innerWidth * k))
  const designH = size ? size.h : Math.max(64, Math.round(window.innerHeight * k))
  // the canvas gets as many pixels as the screen has (a thumbnail, twice its size), but never more than 2560 across
  const wantW = size ? size.w * 2 * q : window.innerWidth * dpr * q
  const backW = Math.min(2560, Math.max(designW, Math.round(wantW)))
  const backH = Math.round(backW * (designH / designW))
  canvas.width = backW
  canvas.height = backH
  return scene(canvas, hue, pointer, { w: designW, h: designH, sx: backW / designW, sy: backH / designH })
}

/** Hue (0..360) of a #rrggbb colour, for tinting the scenes from the theme. */
export function hueOf(hex: string, fallback = 215): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return fallback
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60 + 360) % 360
}
