// The built-in live wallpapers: small canvas scenes that need no files. Each one is tinted from the theme's accent
// colour (hue 0..360), runs at 30 fps and stops completely when stopped, so a paused wallpaper costs nothing.
// Every scene also reacts to the mouse: the wallpaper sits behind the desktop icons and cannot be clicked, so the app
// watches the cursor and feeds its position (0..1 across the screen) into a Pointer the scenes read.

type Draw = (t: number, dt: number) => void

/** Where the cursor is over a scene, 0..1 across it, how fast it moves, and whether it is over the scene at all. */
export interface Pointer {
  x: number
  y: number
  /** Speed in screen widths per second, smoothed. */
  speed: number
  vx: number
  vy: number
  on: boolean
  at: number
}

export const makePointer = (): Pointer => ({ x: 0.5, y: 0.5, speed: 0, vx: 0, vy: 0, on: false, at: 0 })

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

/** Soft drifting clouds of light that lean toward the cursor, with a bright one that follows it. */
function aurora(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const blobs = Array.from({ length: 6 }, (_, i) => ({ sx: rand(0.05, 0.14), sy: rand(0.05, 0.12), px: rand(0, 6.28), py: rand(0, 6.28), r: rand(0.35, 0.6), hue: hue + (i - 2.5) * 22 }))
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    c.globalCompositeOperation = 'source-over'
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
  })
}

/** A slowly turning two-colour gradient with moving lights; the gradient tilts toward the cursor and a light follows it. */
function flow(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    const a = t * 0.05 + (f.x - 0.5) * 0.9 * f.presence
    const dx = Math.cos(a) * w
    const dy = Math.sin(a) * h
    const g = c.createLinearGradient(w / 2 - dx / 2, h / 2 - dy / 2, w / 2 + dx / 2, h / 2 + dy / 2)
    g.addColorStop(0, hsl(hue + 10 * Math.sin(t * 0.1), 65, 22))
    g.addColorStop(0.5, hsl(hue + 35, 70, 30))
    g.addColorStop(1, hsl(hue + 70 + 15 * Math.cos(t * 0.08), 65, 20))
    c.globalCompositeOperation = 'source-over'
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
  })
}

/** Stars with depth: they drift with the cursor, light up near it and join into a constellation; a fast flick throws a shooting star. */
function stars(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const w0 = canvas.width
  const h0 = canvas.height
  const field = Array.from({ length: Math.round((w0 * h0) / 6500) }, () => ({ x: Math.random() * w0, y: Math.random() * h0, r: rand(0.4, 1.7), tw: rand(0.4, 1.8), ph: rand(0, 6.28), v: rand(1, 6) }))
  let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null
  let next = rand(3, 8)
  let cooldown = 0
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
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
      c.fillStyle = hsl(hue + 20, 30, 92, Math.min(1, Math.max(0.1, a) + lit))
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

/** Layered waves on a real water surface: the cursor pushes the water and the disturbance spreads and fades. */
function waves(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const cols = 96
  const u = new Float32Array(cols + 2)
  const v = new Float32Array(cols + 2)
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    // the wave equation on the columns: each one is pulled toward its neighbours, and the motion slowly dies out
    const steps = Math.max(1, Math.round(dt * 60))
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i <= cols; i++) v[i] += (u[i - 1] + u[i + 1] - 2 * u[i]) * 0.35 - u[i] * 0.004
      for (let i = 1; i <= cols; i++) {
        v[i] *= 0.985
        u[i] += v[i]
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
    const sky = c.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, hsl(hue + 30, 60, 62))
    sky.addColorStop(0.6, hsl(hue + 10, 55, 40))
    sky.addColorStop(1, hsl(hue, 60, 22))
    c.fillStyle = sky
    c.fillRect(0, 0, w, h)
    for (let i = 0; i < 5; i++) {
      const base = h * (0.52 + i * 0.1)
      const amp = h * (0.018 + i * 0.006)
      c.beginPath()
      c.moveTo(0, h)
      for (let x = 0; x <= w + 12; x += 12) {
        const idx = clamp(Math.round((x / w) * (cols - 1)) + 1, 1, cols)
        const y = base + amp * Math.sin(x * (0.004 + i * 0.0007) + t * (0.35 + i * 0.12) + i * 1.7) + amp * 0.5 * Math.sin(x * 0.011 - t * (0.5 + i * 0.08) + i) + u[idx] * h * (0.03 + i * 0.012)
        c.lineTo(x, y)
      }
      c.lineTo(w, h)
      c.closePath()
      c.fillStyle = hsl(hue + i * 7, 62, 20 + i * 7, 0.55 + i * 0.09)
      c.fill()
    }
  })
}

/** Floating bubbles that drift away from the cursor as it comes near and settle back when it leaves. */
function bubbles(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const w0 = canvas.width
  const h0 = canvas.height
  const list = Array.from({ length: 36 }, () => ({ x: Math.random() * w0, y: Math.random() * h0, r: rand(10, 70), vy: rand(10, 40), ph: rand(0, 6.28), sw: rand(8, 26), h: hue + rand(-30, 30), ox: 0, oy: 0 }))
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, hsl(hue, 60, 16))
    g.addColorStop(1, hsl(hue + 40, 60, 28))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const reach = Math.max(90, w * 0.14)
    for (const b of list) {
      b.y -= b.vy * dt
      if (b.y < -b.r) {
        b.y = h + b.r
        b.x = Math.random() * w
      }
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
      const fill = c.createRadialGradient(x - b.r * 0.3, y - b.r * 0.3, b.r * 0.1, x, y, b.r)
      fill.addColorStop(0, hsl(b.h, 80, 80, 0.38))
      fill.addColorStop(1, hsl(b.h, 80, 60, 0.07))
      c.fillStyle = fill
      c.beginPath()
      c.arc(x, y, b.r, 0, 6.283)
      c.fill()
      c.strokeStyle = hsl(b.h, 80, 88, 0.3)
      c.lineWidth = 1.5
      c.stroke()
    }
  })
}

/** A web of drifting points: near ones join with lines, and the cursor becomes a node that pulls its neighbours in. */
function network(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const w0 = canvas.width
  const h0 = canvas.height
  const n = clamp(Math.round((w0 * h0) / 5200), 40, 130)
  const pts = Array.from({ length: n }, () => ({ x: Math.random() * w0, y: Math.random() * h0, vx: rand(-12, 12), vy: rand(-12, 12), r: rand(1.2, 2.6) }))
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    const bg = c.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, hsl(hue, 55, 8))
    bg.addColorStop(1, hsl(hue + 30, 50, 16))
    c.fillStyle = bg
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const link = Math.max(60, w * 0.13)
    const pull = link * 1.7
    for (const p of pts) {
      if (f.presence > 0.05) {
        const dx = px - p.x
        const dy = py - p.y
        const d = Math.hypot(dx, dy)
        if (d < pull && d > 8) {
          const k = (1 - d / pull) * 38 * f.presence
          p.vx += (dx / d) * k * dt
          p.vy += (dy / d) * k * dt
        }
      }
      p.vx *= 1 - dt * 0.4
      p.vy *= 1 - dt * 0.4
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
      c.fillStyle = hsl(hue + 30, 80, 82, 0.85)
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
  })
}

/** Still dark water: the cursor leaves rings that spread and fade, and now and then a drop falls on its own. */
function ripples(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const rings: { x: number; y: number; r: number; a: number; speed: number }[] = []
  let sinceRing = 0
  let nextDrop = rand(1, 3)
  let lastX = -1
  let lastY = -1
  return loop((_t, dt) => {
    const w = canvas.width
    const h = canvas.height
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
        rings.push({ x, y, r: 2, a: clamp(0.35 + ptr.speed * 0.4, 0.3, 0.8), speed: 55 + ptr.speed * 60 })
        sinceRing = 0
      }
      lastX = x
      lastY = y
    } else lastX = -1
    if (nextDrop <= 0) {
      rings.push({ x: rand(0.1, 0.9) * w, y: rand(0.1, 0.9) * h, r: 2, a: 0.5, speed: 60 })
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
      c.strokeStyle = hsl(hue + 30, 70, 74, r.a)
      c.lineWidth = 1.6
      c.beginPath()
      c.arc(r.x, r.y, r.r, 0, 6.283)
      c.stroke()
      c.strokeStyle = hsl(hue + 30, 70, 74, r.a * 0.45)
      c.beginPath()
      c.arc(r.x, r.y, r.r * 0.78, 0, 6.283)
      c.stroke()
    }
    if (rings.length > 140) rings.splice(0, rings.length - 140)
  })
}

/** Fireflies that wander in the dark, come to the cursor and circle it, and scatter when it is flicked. */
function fireflies(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const w0 = canvas.width
  const h0 = canvas.height
  const flies = Array.from({ length: clamp(Math.round((w0 * h0) / 9000), 24, 70) }, () => ({ x: Math.random() * w0, y: Math.random() * h0, vx: 0, vy: 0, a: rand(0, 6.28), ph: rand(0, 6.28), sp: rand(0.8, 1.6), r: rand(2, 4) }))
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, hsl(hue + 20, 45, 6))
    g.addColorStop(1, hsl(hue + 35, 50, 12))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const px = f.x * w
    const py = f.y * h
    const scatter = ptr.on && ptr.speed > 1.6
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
          const k = (d - want) * 1.4 * f.presence
          ax += (dx / d) * k + (-dy / d) * 34 * f.presence
          ay += (dy / d) * k + (dx / d) * 34 * f.presence
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
    c.globalCompositeOperation = 'source-over'
  })
}

/** A spinning galaxy of points whose centre follows the cursor, and a flick makes it flare. */
function galaxy(canvas: HTMLCanvasElement, hue: number, ptr: Pointer) {
  const c = canvas.getContext('2d')!
  const fol = follower(ptr)
  const count = 1100
  const parts = Array.from({ length: count }, (_, i) => {
    const arm = i % 3
    const r = Math.pow(Math.random(), 0.7)
    const a = r * 7 + (arm * Math.PI * 2) / 3 + rand(-0.3, 0.3)
    return { r, a, jitter: rand(-1, 1), z: rand(0.4, 1), hue: hue + rand(-20, 40) + r * 40 }
  })
  const cx = { x: 0.5, y: 0.5 }
  let flare = 0
  return loop((t, dt) => {
    const f = fol.step(dt)
    const w = canvas.width
    const h = canvas.height
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = hsl(hue + 10, 50, 4, 0.5)
    c.fillRect(0, 0, w, h)
    const tx = ptr.on ? f.x : 0.5
    const ty = ptr.on ? f.y : 0.5
    cx.x += (tx - cx.x) * (1 - Math.exp(-dt * 2.5))
    cx.y += (ty - cx.y) * (1 - Math.exp(-dt * 2.5))
    flare += ((ptr.on && ptr.speed > 1.2 ? 1 : 0) - flare) * (1 - Math.exp(-dt * 2))
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
      const rr = p.r * size * 0.6 + p.jitter * size * 0.02
      const x = px + Math.cos(ang) * rr
      const y = py + Math.sin(ang) * rr * 0.55
      c.fillStyle = hsl(p.hue, 80, 74, 0.55 * p.z * (1 - p.r * 0.4))
      c.fillRect(x, y, p.z * 1.8 + 0.6, p.z * 1.8 + 0.6)
    }
    c.globalCompositeOperation = 'source-over'
  })
}

/** Scenes drawn at a lower resolution than the screen (they are all soft); the canvas is stretched by CSS. */
const SCALE: Record<string, number> = { aurora: 0.2, flow: 0.2, waves: 0.5, stars: 0.75, bubbles: 0.6, network: 0.5, ripples: 0.5, fireflies: 0.45, galaxy: 0.5 }
const SCENES: Record<string, (canvas: HTMLCanvasElement, hue: number, ptr: Pointer) => () => void> = { aurora, flow, stars, waves, bubbles, network, ripples, fireflies, galaxy }

/** Starts a scene on the canvas and returns the function that stops it. The pointer is read every frame (see feedPointer). */
export function startLive(canvas: HTMLCanvasElement, id: string, hue: number, size?: { w: number; h: number }, pointer: Pointer = makePointer()): () => void {
  const scene = SCENES[id] ?? SCENES.aurora
  const k = SCALE[id] ?? 0.5
  canvas.width = size ? size.w : Math.max(64, Math.round(window.innerWidth * k))
  canvas.height = size ? size.h : Math.max(64, Math.round(window.innerHeight * k))
  return scene(canvas, hue, pointer)
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
