// Bowling seen from above: pull the ball back like a sling for direction and power, turn the mouse wheel for the hook.
// Ten pins, two throws a frame, five frames: the score is the number of pins you bring down.
import { dial, powerGauge } from './gauges'
import { Area, Env, MiniGame, MiniHud, TAU, clamp, label, panel } from './mini'

const FRAMES = 5
const BALL_R = 20
const PIN_R = 11
const MAX_PULL = 200
const LANE_W = 280

interface Pin {
  x: number
  y: number
  vx: number
  vy: number
  hx: number
  hy: number
  down: boolean
  fade: number
}

export class Bowling implements MiniGame {
  private a: Area = { x: 0, y: 0, w: 0, h: 0 }
  private pins: Pin[] = []
  private ball = { x: 0, y: 0, vx: 0, vy: 0, live: false }
  private aim: { x: number; y: number } | null = null
  private hook = 0
  private phase: 'ready' | 'roll' | 'settle' | 'over' = 'ready'
  private timer = 0
  private frame = 1
  private throwNo = 1
  private total = 0
  private frameDown = 0
  private laneKey = ''

  constructor(private env: Env) {}

  area(w: number, _h: number, floor: number): Area {
    const ah = Math.min(floor - 160, 660)
    this.a = { x: w / 2 - (LANE_W + 120) / 2, y: Math.max(140, (floor - ah) / 2 + 20), w: LANE_W + 120, h: ah }
    return this.a
  }

  private laneX() { return this.a.x + this.a.w / 2 }
  private spot() { return { x: this.laneX(), y: this.a.y + this.a.h - 56 } }

  private setPins() {
    const cx = this.laneX()
    const top = this.a.y + 78
    this.pins = []
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        const x = cx + (i - row / 2) * 38
        const y = top + row * 34
        this.pins.push({ x, y, vx: 0, vy: 0, hx: x, hy: y, down: false, fade: 1 })
      }
    }
  }

  reset() {
    this.frame = 1
    this.throwNo = 1
    this.total = 0
    this.frameDown = 0
    this.phase = 'ready'
    this.laneKey = ''
  }

  private ensure() {
    const key = `${this.a.x}|${this.a.y}|${this.a.h}`
    if (key !== this.laneKey) {
      this.laneKey = key
      this.setPins()
      this.placeBall()
    }
  }

  private placeBall() {
    const s = this.spot()
    this.ball = { x: s.x, y: s.y, vx: 0, vy: 0, live: false }
    this.aim = null
  }

  down(x: number, y: number) {
    this.ensure()
    if (this.phase === 'over') { this.reset(); this.ensure(); return }
    if (this.phase === 'ready' && Math.hypot(this.ball.x - x, this.ball.y - y) <= BALL_R + 22) this.aim = { x: x - this.ball.x, y: y - this.ball.y }
  }
  move(x: number, y: number) {
    if (this.aim) this.aim = { x: x - this.ball.x, y: y - this.ball.y }
  }
  up() {
    if (!this.aim) return
    const len = Math.hypot(this.aim.x, this.aim.y)
    const k = Math.min(len, MAX_PULL)
    const aim = this.aim
    this.aim = null
    if (len < 16 || aim.y < 0) return // pulled the wrong way, or hardly at all
    const speed = 380 + (k / MAX_PULL) * 700
    this.ball.vx = (-aim.x / len) * speed * 0.55
    this.ball.vy = (-aim.y / len) * speed
    this.ball.live = true
    this.phase = 'roll'
    this.timer = 0
    this.frameDown = this.pins.filter((p) => p.down).length
    this.env.tone(180, 90, 0.4, 'sawtooth', 0.05)
  }
  wheel(dy: number) {
    this.hook = clamp(Math.round((this.hook + (dy < 0 ? 0.2 : -0.2)) * 10) / 10, -1, 1)
  }

  step(dt: number, pointer: { x: number; y: number } | null, _down: boolean, w: number, h: number, floor: number) {
    this.area(w, h, floor)
    this.ensure()
    if (pointer) this.move(pointer.x, pointer.y)
    if (this.phase === 'roll' || this.phase === 'settle') this.simulate(dt)
  }

  private simulate(dt: number) {
    const a = this.a
    const cx = this.laneX()
    const b = this.ball
    this.timer += dt
    const sub = 3
    for (let s = 0; s < sub; s++) {
      const d = dt / sub
      if (b.live) {
        // the hook: a sideways pull that grows as the ball travels
        const gutter = Math.abs(b.x - cx) > LANE_W / 2 - 4
        if (!gutter) b.vx += this.hook * 260 * d * (Math.abs(b.vy) / 700)
        b.x += b.vx * d
        b.y += b.vy * d
        if (Math.abs(b.x - cx) > LANE_W / 2 + 4) {
          // in the gutter: the ball slides straight on, past the pins
          b.x = cx + Math.sign(b.x - cx) * (LANE_W / 2 + 10)
          b.vx = 0
        }
      }
      for (const p of this.pins) {
        if (p.vx === 0 && p.vy === 0) continue
        p.x += p.vx * d
        p.y += p.vy * d
        p.vx *= Math.exp(-2.2 * d)
        p.vy *= Math.exp(-2.2 * d)
        if (Math.hypot(p.vx, p.vy) < 8) { p.vx = 0; p.vy = 0 }
        p.x = clamp(p.x, cx - LANE_W / 2 - 40, cx + LANE_W / 2 + 40)
        p.y = clamp(p.y, a.y + 30, a.y + a.h)
      }
      // ball hits pin, pin hits pin: equal discs, the ball heavier
      const circles = [{ c: b as { x: number; y: number; vx: number; vy: number }, r: BALL_R, m: 6, ball: true }, ...this.pins.map((p) => ({ c: p, r: PIN_R, m: 1, ball: false }))]
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const A = circles[i], B = circles[j]
          if (A.ball && !b.live) continue
          const dx = B.c.x - A.c.x, dy = B.c.y - A.c.y
          const dist = Math.hypot(dx, dy)
          const min = A.r + B.r
          if (dist >= min || dist === 0) continue
          const nx = dx / dist, ny = dy / dist
          const rel = (B.c.vx - A.c.vx) * nx + (B.c.vy - A.c.vy) * ny
          const push = (min - dist) / (A.m + B.m)
          A.c.x -= nx * push * B.m
          A.c.y -= ny * push * B.m
          B.c.x += nx * push * A.m
          B.c.y += ny * push * A.m
          if (rel < 0) {
            const j2 = (-(1 + 0.85) * rel) / (1 / A.m + 1 / B.m)
            A.c.vx -= (j2 * nx) / A.m
            A.c.vy -= (j2 * ny) / A.m
            B.c.vx += (j2 * nx) / B.m
            B.c.vy += (j2 * ny) / B.m
            if (!A.ball && Math.hypot(A.c.vx, A.c.vy) > 5) (A.c as Pin).down = true
            if (!B.ball && Math.hypot(B.c.vx, B.c.vy) > 5) (B.c as Pin).down = true
            if (Math.random() < 0.5) this.env.tone(500 + Math.random() * 500, 300, 0.05, 'square', 0.04)
          }
        }
      }
    }
    for (const p of this.pins) if (p.down) p.fade = Math.max(0, p.fade - dt * 0.6)
    // the ball is done when it leaves the lane at the far end, or stops
    if (b.live && (b.y < a.y + 20 || Math.hypot(b.vx, b.vy) < 30 || this.timer > 6)) b.live = false
    const moving = this.pins.some((p) => p.vx !== 0 || p.vy !== 0)
    if (!b.live && !moving && this.timer > 1.2) this.endThrow()
  }

  private endThrow() {
    const downNow = this.pins.filter((p) => p.down).length
    const got = downNow - this.frameDown
    this.total += got
    if (downNow >= 10 && this.throwNo === 1) this.env.flash('STRIKE!', 1.4)
    else if (downNow >= 10) this.env.flash('SPARE!', 1.3)
    else if (got === 0) this.env.flash('KARAVANA', 1)
    else this.env.flash(`${got} LOBUT`, 1)
    const frameDone = this.throwNo === 2 || downNow >= 10
    if (frameDone) {
      if (this.frame >= FRAMES) {
        this.phase = 'over'
        this.env.finish(this.total)
        this.env.flash(`OYUN BİTTİ  ·  ${this.total}`, 2.2)
        return
      }
      this.frame += 1
      this.throwNo = 1
      this.setPins()
    } else {
      this.throwNo = 2
      // the ones that are down are cleared away, the standing ones stay
      this.pins = this.pins.filter((p) => !p.down)
      for (const p of this.pins) { p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0 }
    }
    this.phase = 'ready'
    this.placeBall()
    this.frameDown = this.pins.filter((p) => p.down).length
  }

  draw(c: CanvasRenderingContext2D) {
    const a = this.a
    if (a.w === 0) return
    this.ensure()
    panel(c, a)
    const cx = this.laneX()
    c.save()
    c.beginPath()
    c.roundRect(a.x, a.y, a.w, a.h, 22)
    c.clip()
    // gutters, then the lane
    c.fillStyle = '#1a1f33'
    c.fillRect(cx - LANE_W / 2 - 22, a.y, LANE_W + 44, a.h)
    const wood = c.createLinearGradient(cx - LANE_W / 2, 0, cx + LANE_W / 2, 0)
    wood.addColorStop(0, '#c98d4e'); wood.addColorStop(0.5, '#e2b377'); wood.addColorStop(1, '#c98d4e')
    c.fillStyle = wood
    c.fillRect(cx - LANE_W / 2, a.y, LANE_W, a.h)
    c.strokeStyle = 'rgba(80,40,10,0.28)'
    c.lineWidth = 1
    c.beginPath()
    for (let i = 1; i < 12; i++) { c.moveTo(cx - LANE_W / 2 + (LANE_W / 12) * i, a.y); c.lineTo(cx - LANE_W / 2 + (LANE_W / 12) * i, a.y + a.h) }
    c.stroke()
    c.fillStyle = 'rgba(80,40,10,0.45)'
    for (let i = -3; i <= 3; i++) {
      c.beginPath()
      c.moveTo(cx + i * 30, a.y + a.h - 150 - Math.abs(i) * 14)
      c.lineTo(cx + i * 30 - 5, a.y + a.h - 134 - Math.abs(i) * 14)
      c.lineTo(cx + i * 30 + 5, a.y + a.h - 134 - Math.abs(i) * 14)
      c.fill()
    }
    // pins
    for (const p of this.pins) {
      if (p.fade <= 0) continue
      c.save()
      c.globalAlpha = p.fade
      c.translate(p.x, p.y)
      c.fillStyle = 'rgba(0,0,0,0.25)'
      c.beginPath(); c.ellipse(2, 3, PIN_R, PIN_R, 0, 0, TAU); c.fill()
      c.fillStyle = p.down ? '#d9d9e0' : '#ffffff'
      c.beginPath(); c.arc(0, 0, PIN_R, 0, TAU); c.fill()
      c.strokeStyle = '#d63a3a'
      c.lineWidth = 2.5
      c.beginPath(); c.arc(0, 0, PIN_R - 4, 0, TAU); c.stroke()
      c.restore()
    }
    // the ball
    const b = this.ball
    c.save()
    c.translate(b.x, b.y)
    c.fillStyle = 'rgba(0,0,0,0.3)'
    c.beginPath(); c.ellipse(3, 5, BALL_R, BALL_R, 0, 0, TAU); c.fill()
    const g = c.createRadialGradient(-6, -7, 3, 0, 0, BALL_R)
    g.addColorStop(0, '#6c8dff'); g.addColorStop(1, '#16206b')
    c.fillStyle = g
    c.beginPath(); c.arc(0, 0, BALL_R, 0, TAU); c.fill()
    c.fillStyle = '#0a0f33'
    for (const [dx, dy] of [[-4, -5], [4, -5], [0, 4]]) { c.beginPath(); c.arc(dx, dy, 2.6, 0, TAU); c.fill() }
    c.restore()
    c.restore()
    // the aim
    if (this.aim) {
      const len = Math.min(Math.hypot(this.aim.x, this.aim.y), MAX_PULL)
      const ang = Math.atan2(this.aim.y, this.aim.x)
      c.strokeStyle = 'rgba(255,255,255,0.8)'
      c.lineWidth = 3
      c.setLineDash([2, 7])
      c.beginPath()
      c.moveTo(b.x, b.y)
      c.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len)
      c.stroke()
      c.setLineDash([])
      // where it is headed
      c.strokeStyle = 'rgba(255,255,255,0.35)'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(b.x, b.y)
      c.lineTo(b.x - Math.cos(ang) * 300 * 0.55, b.y - Math.sin(ang) * 300)
      c.stroke()
      powerGauge(c, a.x + 82, a.y + a.h - 70, len / MAX_PULL)
    }
    dial(c, a.x + a.w - 52, a.y + a.h - 74, this.hook, 'FALSO · tekerlek')
    label(c, `Tur ${Math.min(this.frame, FRAMES)}/${FRAMES}  ·  atış ${this.throwNo}  ·  ${this.total} lobut`, cx, a.y + 22, 13, '#ffffff', 700)
    if (this.phase === 'ready' && !this.aim) label(c, this.frame === 1 && this.throwNo === 1 && this.total === 0 ? 'Topu geri çek ve bırak' : 'Topu geri çek', cx, a.y + a.h - 18, 12)
    if (this.phase === 'over') label(c, 'Yeniden oynamak için tıkla', cx, a.y + a.h - 18, 13, '#ffffff', 700)
  }

  hud(): MiniHud {
    return { score: this.total, unit: `lobut  ·  tur ${Math.min(this.frame, FRAMES)}/${FRAMES}`, best: `Atış ${this.throwNo}`, hint: 'Hazır: topu geri çek, bırak', active: this.phase === 'roll' || this.phase === 'settle' || this.frame > 1 || this.total > 0 }
  }
}
