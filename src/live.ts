// The built-in live wallpapers: small canvas scenes that need no files. Each one is tinted from the theme's accent
// colour (hue 0..360), runs at 30 fps and stops completely when stopped, so a paused wallpaper costs nothing.

type Draw = (t: number, dt: number) => void

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

/** Soft drifting clouds of light: drawn small and stretched by the browser, which is both cheap and smooth. */
function aurora(canvas: HTMLCanvasElement, hue: number) {
  const c = canvas.getContext('2d')!
  const blobs = Array.from({ length: 6 }, (_, i) => ({ sx: rand(0.05, 0.14), sy: rand(0.05, 0.12), px: rand(0, 6.28), py: rand(0, 6.28), r: rand(0.35, 0.6), hue: hue + (i - 2.5) * 22 }))
  return loop((t) => {
    const w = canvas.width
    const h = canvas.height
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = hsl(hue, 55, 7)
    c.fillRect(0, 0, w, h)
    c.globalCompositeOperation = 'lighter'
    for (const b of blobs) {
      const x = w * (0.5 + 0.42 * Math.sin(t * b.sx * 6.28 + b.px))
      const y = h * (0.5 + 0.38 * Math.sin(t * b.sy * 6.28 + b.py))
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * b.r)
      g.addColorStop(0, hsl(b.hue, 80, 48, 0.5))
      g.addColorStop(1, hsl(b.hue, 80, 40, 0))
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
  })
}

/** A slowly turning two-colour gradient with a few moving lights, like a calm screen saver. */
function flow(canvas: HTMLCanvasElement, hue: number) {
  const c = canvas.getContext('2d')!
  return loop((t) => {
    const w = canvas.width
    const h = canvas.height
    const a = t * 0.05
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
  })
}

function stars(canvas: HTMLCanvasElement, hue: number) {
  const c = canvas.getContext('2d')!
  const w0 = canvas.width
  const h0 = canvas.height
  const field = Array.from({ length: Math.round((w0 * h0) / 6500) }, () => ({ x: Math.random() * w0, y: Math.random() * h0, r: rand(0.4, 1.7), tw: rand(0.4, 1.8), ph: rand(0, 6.28), v: rand(1, 6) }))
  let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null
  let next = rand(3, 8)
  return loop((t, dt) => {
    const w = canvas.width
    const h = canvas.height
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, hsl(hue, 55, 5))
    g.addColorStop(1, hsl(hue + 12, 45, 15))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    for (const s of field) {
      s.x -= s.v * dt * 0.6
      if (s.x < -2) s.x = w + 2
      const a = 0.45 + 0.55 * Math.sin(t * s.tw + s.ph)
      c.fillStyle = hsl(hue + 20, 30, 92, Math.max(0.1, a))
      c.beginPath()
      c.arc(s.x, s.y, s.r, 0, 6.283)
      c.fill()
    }
    next -= dt
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

function waves(canvas: HTMLCanvasElement, hue: number) {
  const c = canvas.getContext('2d')!
  return loop((t) => {
    const w = canvas.width
    const h = canvas.height
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
        const y = base + amp * Math.sin(x * (0.004 + i * 0.0007) + t * (0.35 + i * 0.12) + i * 1.7) + amp * 0.5 * Math.sin(x * 0.011 - t * (0.5 + i * 0.08) + i)
        c.lineTo(x, y)
      }
      c.lineTo(w, h)
      c.closePath()
      c.fillStyle = hsl(hue + i * 7, 62, 20 + i * 7, 0.55 + i * 0.09)
      c.fill()
    }
  })
}

function bubbles(canvas: HTMLCanvasElement, hue: number) {
  const c = canvas.getContext('2d')!
  const w0 = canvas.width
  const h0 = canvas.height
  const list = Array.from({ length: 36 }, () => ({ x: Math.random() * w0, y: Math.random() * h0, r: rand(10, 70), vy: rand(10, 40), ph: rand(0, 6.28), sw: rand(8, 26), h: hue + rand(-30, 30) }))
  return loop((t, dt) => {
    const w = canvas.width
    const h = canvas.height
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, hsl(hue, 60, 16))
    g.addColorStop(1, hsl(hue + 40, 60, 28))
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    for (const b of list) {
      b.y -= b.vy * dt
      if (b.y < -b.r) {
        b.y = h + b.r
        b.x = Math.random() * w
      }
      const x = b.x + Math.sin(t * 0.6 + b.ph) * b.sw
      const fill = c.createRadialGradient(x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, x, b.y, b.r)
      fill.addColorStop(0, hsl(b.h, 80, 80, 0.38))
      fill.addColorStop(1, hsl(b.h, 80, 60, 0.07))
      c.fillStyle = fill
      c.beginPath()
      c.arc(x, b.y, b.r, 0, 6.283)
      c.fill()
      c.strokeStyle = hsl(b.h, 80, 88, 0.3)
      c.lineWidth = 1.5
      c.stroke()
    }
  })
}

/** Scenes drawn at a lower resolution than the screen (they are all soft); the canvas is stretched by CSS. */
const SCALE: Record<string, number> = { aurora: 0.2, flow: 0.2, waves: 0.5, stars: 0.75, bubbles: 0.6 }
const SCENES: Record<string, (canvas: HTMLCanvasElement, hue: number) => () => void> = { aurora, flow, stars, waves, bubbles }

/** Starts a scene on the canvas and returns the function that stops it. */
export function startLive(canvas: HTMLCanvasElement, id: string, hue: number): () => void {
  const scene = SCENES[id] ?? SCENES.aurora
  const k = SCALE[id] ?? 0.5
  canvas.width = Math.max(64, Math.round(window.innerWidth * k))
  canvas.height = Math.max(64, Math.round(window.innerHeight * k))
  return scene(canvas, hue)
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
