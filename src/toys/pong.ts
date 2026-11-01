// Pong against the computer: your paddle follows the pointer, the ball speeds up with every return, first to seven wins.
import { Area, Env, MiniGame, MiniHud, TAU, clamp, label, panel } from './mini'

const WIN = 7
const PADDLE_H = 92
const PADDLE_W = 12
const BALL_R = 9

export class Pong implements MiniGame {
  private a: Area = { x: 0, y: 0, w: 0, h: 0 }
  private ball = { x: 0, y: 0, vx: 0, vy: 0 }
  private you = 0
  private ai = 0
  private youPts = 0
  private aiPts = 0
  private phase: 'ready' | 'serve' | 'play' | 'over' = 'ready'
  private timer = 0
  private rally = 0
  private noise = 0
  private trail: [number, number][] = []

  constructor(private env: Env) {}

  area(w: number, _h: number, floor: number): Area {
    const aw = Math.min(w - 80, 860)
    const ah = Math.min(floor - 170, 470)
    this.a = { x: (w - aw) / 2, y: Math.max(140, (floor - ah) / 2 + 30), w: aw, h: ah }
    return this.a
  }

  reset() {
    this.youPts = 0
    this.aiPts = 0
    this.phase = 'ready'
    this.rally = 0
    this.trail = []
  }

  private serve(toward: 1 | -1) {
    const a = this.a
    this.ball = { x: a.x + a.w / 2, y: a.y + a.h / 2, vx: 0, vy: 0 }
    this.phase = 'serve'
    this.timer = 0.9
    this.rally = 0
    this.trail = []
    this.dir = toward
  }
  private dir: 1 | -1 = 1

  down() {
    if (this.phase === 'ready' || this.phase === 'over') {
      this.youPts = 0
      this.aiPts = 0
      this.serve(Math.random() < 0.5 ? 1 : -1)
      this.env.tone(440, 880, 0.18, 'triangle', 0.1)
    }
  }
  up() {}
  wheel() {}

  step(dt: number, pointer: { x: number; y: number } | null, _down: boolean, w: number, h: number, floor: number) {
    const a = this.area(w, h, floor)
    if (this.you === 0) { this.you = a.y + a.h / 2; this.ai = this.you }
    if (pointer) this.you += (clamp(pointer.y, a.y + PADDLE_H / 2, a.y + a.h - PADDLE_H / 2) - this.you) * Math.min(1, dt * 22)
    if (this.phase === 'ready' || this.phase === 'over') {
      this.ai += (a.y + a.h / 2 - this.ai) * Math.min(1, dt * 2)
      return
    }
    const b = this.ball
    if (this.phase === 'serve') {
      this.timer -= dt
      if (this.timer <= 0) {
        const ang = (Math.random() - 0.5) * 0.8
        const speed = 420
        b.vx = Math.cos(ang) * speed * this.dir
        b.vy = Math.sin(ang) * speed
        this.phase = 'play'
      }
      return
    }
    // the computer: follows the ball with a little delay and error, and can only be so fast
    this.noise += dt
    const target = b.vx > 0 ? b.y + Math.sin(this.noise * 2.1) * 34 : a.y + a.h / 2
    const speed = 300 + this.youPts * 14
    this.ai += clamp(target - this.ai, -speed * dt, speed * dt)
    this.ai = clamp(this.ai, a.y + PADDLE_H / 2, a.y + a.h - PADDLE_H / 2)

    b.x += b.vx * dt
    b.y += b.vy * dt
    this.trail.push([b.x, b.y])
    if (this.trail.length > 10) this.trail.shift()
    if (b.y < a.y + BALL_R) { b.y = a.y + BALL_R; b.vy = Math.abs(b.vy); this.env.tone(260, 200, 0.05, 'square', 0.05) }
    if (b.y > a.y + a.h - BALL_R) { b.y = a.y + a.h - BALL_R; b.vy = -Math.abs(b.vy); this.env.tone(260, 200, 0.05, 'square', 0.05) }

    const left = a.x + 24 + PADDLE_W
    const right = a.x + a.w - 24 - PADDLE_W
    const hit = (padY: number, side: 1 | -1) => {
      const off = (b.y - padY) / (PADDLE_H / 2)
      const speed = Math.min(950, Math.hypot(b.vx, b.vy) * 1.06)
      const ang = clamp(off, -1, 1) * 0.95
      b.vx = Math.cos(ang) * speed * side
      b.vy = Math.sin(ang) * speed
      this.rally += 1
      this.env.tone(side === 1 ? 520 : 380, 260, 0.07, 'square', 0.08)
    }
    if (b.vx < 0 && b.x - BALL_R <= left && b.x > left - 24 && Math.abs(b.y - this.you) < PADDLE_H / 2 + BALL_R) { b.x = left + BALL_R; hit(this.you, 1) }
    if (b.vx > 0 && b.x + BALL_R >= right && b.x < right + 24 && Math.abs(b.y - this.ai) < PADDLE_H / 2 + BALL_R) { b.x = right - BALL_R; hit(this.ai, -1) }

    if (b.x < a.x - 10 || b.x > a.x + a.w + 10) {
      const youScored = b.x > a.x + a.w
      if (youScored) this.youPts += 1
      else this.aiPts += 1
      this.env.flash(youScored ? 'SAYI!' : 'RAKİP ATTI', 0.9)
      this.env.tone(youScored ? 660 : 200, youScored ? 990 : 120, 0.25, 'triangle', 0.1)
      if (this.youPts >= WIN || this.aiPts >= WIN) {
        this.phase = 'over'
        const won = this.youPts > this.aiPts
        this.env.flash(won ? 'KAZANDIN!' : 'KAYBETTİN', 1.6)
        if (won) {
          this.env.win()
          this.env.finish(this.youPts)
        }
      } else this.serve(youScored ? -1 : 1)
    }
  }

  draw(c: CanvasRenderingContext2D) {
    const a = this.a
    if (a.w === 0) return
    panel(c, a)
    c.save()
    c.beginPath()
    c.roundRect(a.x, a.y, a.w, a.h, 22)
    c.clip()
    // the court
    c.strokeStyle = 'rgba(255,255,255,0.18)'
    c.lineWidth = 3
    c.setLineDash([10, 14])
    c.beginPath()
    c.moveTo(a.x + a.w / 2, a.y + 10)
    c.lineTo(a.x + a.w / 2, a.y + a.h - 10)
    c.stroke()
    c.setLineDash([])
    c.fillStyle = 'rgba(255,255,255,0.28)'
    c.font = "800 64px 'Segoe UI', system-ui, sans-serif"
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(this.youPts), a.x + a.w / 2 - 70, a.y + 62)
    c.fillText(String(this.aiPts), a.x + a.w / 2 + 70, a.y + 62)
    // paddles and ball
    const pad = (x: number, y: number, color: string) => {
      c.save()
      c.shadowColor = color
      c.shadowBlur = 18
      c.fillStyle = color
      c.beginPath()
      c.roundRect(x, y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 6)
      c.fill()
      c.restore()
    }
    pad(a.x + 24, this.you, '#5aa2ff')
    pad(a.x + a.w - 24 - PADDLE_W, this.ai, '#ff6a8a')
    for (let i = 0; i < this.trail.length; i++) {
      c.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.25})`
      c.beginPath()
      c.arc(this.trail[i][0], this.trail[i][1], BALL_R * (i / this.trail.length), 0, TAU)
      c.fill()
    }
    if (this.phase !== 'ready' && this.phase !== 'over') {
      c.save()
      c.shadowColor = '#ffffff'
      c.shadowBlur = 14
      c.fillStyle = '#ffffff'
      c.beginPath()
      c.arc(this.ball.x, this.ball.y, BALL_R, 0, TAU)
      c.fill()
      c.restore()
    }
    c.restore()
    if (this.phase === 'ready') label(c, 'Başlamak için tıkla · raketi fareyle yönet · ilk 7 sayıya ulaşan kazanır', a.x + a.w / 2, a.y + a.h - 28)
    if (this.phase === 'over') label(c, this.youPts > this.aiPts ? 'Kazandın! Yeniden oynamak için tıkla' : 'Kaybettin. Yeniden oynamak için tıkla', a.x + a.w / 2, a.y + a.h - 28, 14, '#ffffff', 700)
  }

  hud(): MiniHud {
    return { score: this.youPts, unit: `sayı  ·  rakip ${this.aiPts}`, best: `Seri ${this.rally}`, hint: 'Hazır: tıkla ve başla', active: this.phase === 'play' || this.phase === 'serve' }
  }
}
