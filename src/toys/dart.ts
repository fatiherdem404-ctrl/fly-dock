// Darts: aim with the pointer, hold the mouse button to steady your hand (the wobble shrinks), let go to throw.
// Three darts a round, five rounds. Doubles and trebles count as on a real board; the bull is 50.
import { Area, Env, MiniGame, MiniHud, TAU, label, panel } from './mini'

const ROUNDS = 5
/** The numbers around the board, clockwise from the top. */
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
// fractions of the board's radius (the outer edge of the double ring)
const BULL = 0.037, OUTER_BULL = 0.094, TRIPLE_IN = 0.582, TRIPLE_OUT = 0.629, DOUBLE_IN = 0.953

interface Stuck {
  x: number
  y: number
}

/** What a dart that landed at (dx, dy) from the centre of a board of radius r scores, and how to say it. */
export function scoreAt(dx: number, dy: number, r: number): { points: number; text: string } {
  const d = Math.hypot(dx, dy) / r
  if (d > 1) return { points: 0, text: 'KAÇTI' }
  if (d <= BULL) return { points: 50, text: 'BULLSEYE!  50' }
  if (d <= OUTER_BULL) return { points: 25, text: 'YARIM BULL  25' }
  const ang = (Math.atan2(dx, -dy) + TAU) % TAU // clockwise from the top
  const n = NUMBERS[Math.floor(((ang + Math.PI / 20) % TAU) / (TAU / 20))]
  if (d >= DOUBLE_IN) return { points: n * 2, text: `ÇİFT ${n}  ${n * 2}` }
  if (d >= TRIPLE_IN && d <= TRIPLE_OUT) return { points: n * 3, text: `ÜÇLÜ ${n}  ${n * 3}` }
  return { points: n, text: String(n) }
}

export class Dart implements MiniGame {
  private a: Area = { x: 0, y: 0, w: 0, h: 0 }
  private R = 0
  private cx = 0
  private cy = 0
  private round = 1
  private dartNo = 0
  private total = 0
  private roundTotal = 0
  private stuck: Stuck[] = []
  private holding = 0
  private holdOn = false
  private t = 0
  private phase: 'ready' | 'aim' | 'wait' | 'over' = 'ready'
  private timer = 0
  private lastText = ''
  private aimAt = { x: 0, y: 0 }

  constructor(private env: Env) {}

  area(w: number, _h: number, floor: number): Area {
    const side = Math.min(floor - 160, 520, w - 80)
    this.a = { x: w / 2 - side / 2, y: Math.max(140, (floor - side) / 2 + 20), w: side, h: side }
    this.R = side * 0.37
    this.cx = this.a.x + side / 2
    this.cy = this.a.y + side / 2 + 8
    return this.a
  }

  reset() {
    this.round = 1
    this.dartNo = 0
    this.total = 0
    this.roundTotal = 0
    this.stuck = []
    this.phase = 'ready'
  }

  /** The wobble of the hand, in pixels: big at first, calmer while the button is held. */
  private wobble() {
    return 5 + 30 * Math.exp(-this.holding * 1.6) + Math.min(14, Math.max(0, this.holding - 2.4) * 8)
  }

  down() {
    if (this.phase === 'over') { this.reset(); this.phase = 'aim'; return }
    if (this.phase === 'ready') this.phase = 'aim'
    if (this.phase === 'aim') { this.holdOn = true; this.holding = 0 }
  }

  up() {
    if (this.phase !== 'aim' || !this.holdOn) return
    this.holdOn = false
    const w = this.wobble()
    // the dart lands where you aimed, plus the hand's wobble (a different push every throw)
    const ang = Math.random() * TAU
    const off = Math.random() * w
    const x = this.aimAt.x + Math.cos(ang) * off
    const y = this.aimAt.y + Math.sin(ang) * off
    this.stuck.push({ x, y })
    const s = scoreAt(x - this.cx, y - this.cy, this.R)
    this.total += s.points
    this.roundTotal += s.points
    this.lastText = s.text
    this.dartNo += 1
    this.env.flash(s.text, 1)
    this.env.tone(s.points >= 50 ? 880 : 360, s.points > 0 ? 160 : 90, 0.12, 'triangle', 0.12)
    this.holding = 0
    if (this.dartNo >= 3) {
      this.phase = 'wait'
      this.timer = 1.6
    }
  }

  wheel() {}

  step(dt: number, pointer: { x: number; y: number } | null, _down: boolean, w: number, h: number, floor: number) {
    this.area(w, h, floor)
    this.t += dt
    if (pointer) this.aimAt = { x: pointer.x, y: pointer.y }
    if (this.phase === 'aim' && this.holdOn) this.holding += dt
    if (this.phase === 'wait') {
      this.timer -= dt
      if (this.timer <= 0) {
        if (this.round >= ROUNDS) {
          this.phase = 'over'
          this.env.finish(this.total)
          this.env.flash(`OYUN BİTTİ  ·  ${this.total}`, 2.2)
        } else {
          this.round += 1
          this.dartNo = 0
          this.roundTotal = 0
          this.stuck = []
          this.phase = 'aim'
        }
      }
    }
  }

  draw(c: CanvasRenderingContext2D, _w: number, _h: number, _f: number, pointer: { x: number; y: number } | null) {
    const a = this.a
    if (a.w === 0) return
    panel(c, a, 'rgba(18, 22, 30, 0.92)')
    const { cx, cy, R } = this
    // the board
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.5)'
    c.shadowBlur = 16
    c.fillStyle = '#10131a'
    c.beginPath(); c.arc(cx, cy, R * 1.16, 0, TAU); c.fill()
    c.restore()
    const ring = (from: number, to: number, i: number, a1: string, a2: string) => {
      const start = -Math.PI / 2 + (i - 0.5) * (TAU / 20)
      c.fillStyle = i % 2 === 0 ? a1 : a2
      c.beginPath()
      c.arc(cx, cy, R * to, start, start + TAU / 20)
      c.arc(cx, cy, R * from, start + TAU / 20, start, true)
      c.closePath()
      c.fill()
    }
    for (let i = 0; i < 20; i++) {
      ring(OUTER_BULL, TRIPLE_IN, i, '#15181f', '#efe3c2')
      ring(TRIPLE_IN, TRIPLE_OUT, i, '#c8312f', '#1f8a4b')
      ring(TRIPLE_OUT, DOUBLE_IN, i, '#15181f', '#efe3c2')
      ring(DOUBLE_IN, 1, i, '#c8312f', '#1f8a4b')
    }
    c.fillStyle = '#1f8a4b'
    c.beginPath(); c.arc(cx, cy, R * OUTER_BULL, 0, TAU); c.fill()
    c.fillStyle = '#c8312f'
    c.beginPath(); c.arc(cx, cy, R * BULL, 0, TAU); c.fill()
    c.strokeStyle = 'rgba(220,220,230,0.55)'
    c.lineWidth = 1
    c.beginPath()
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 + (i - 0.5) * (TAU / 20)
      c.moveTo(cx + Math.cos(ang) * R * OUTER_BULL, cy + Math.sin(ang) * R * OUTER_BULL)
      c.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R)
    }
    for (const f of [BULL, OUTER_BULL, TRIPLE_IN, TRIPLE_OUT, DOUBLE_IN, 1]) { c.moveTo(cx + R * f, cy); c.arc(cx, cy, R * f, 0, TAU) }
    c.stroke()
    for (let i = 0; i < 20; i++) {
      const ang = -Math.PI / 2 + i * (TAU / 20)
      label(c, String(NUMBERS[i]), cx + Math.cos(ang) * R * 1.08, cy + Math.sin(ang) * R * 1.08, Math.max(11, R * 0.075), '#ffffff', 700)
    }
    // darts that have landed
    for (const s of this.stuck) {
      c.save()
      c.translate(s.x, s.y)
      c.fillStyle = 'rgba(0,0,0,0.35)'
      c.beginPath(); c.arc(2, 3, 4, 0, TAU); c.fill()
      c.strokeStyle = '#d6d6de'
      c.lineWidth = 3
      c.lineCap = 'round'
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -22); c.stroke()
      c.fillStyle = '#ff6a3d'
      c.beginPath(); c.moveTo(-9, -22); c.lineTo(-18, -34); c.lineTo(-4, -30); c.fill()
      c.beginPath(); c.moveTo(-9, -22); c.lineTo(2, -35); c.lineTo(-3, -24); c.fill()
      c.restore()
    }
    // the crosshair: the circle is how far the dart may stray
    if (pointer && (this.phase === 'aim' || this.phase === 'ready')) {
      const wob = this.wobble()
      c.strokeStyle = this.holdOn ? '#8dffb0' : 'rgba(255,255,255,0.9)'
      c.lineWidth = 2
      c.beginPath(); c.arc(pointer.x, pointer.y, wob, 0, TAU); c.stroke()
      c.beginPath()
      c.moveTo(pointer.x - wob - 6, pointer.y); c.lineTo(pointer.x + wob + 6, pointer.y)
      c.moveTo(pointer.x, pointer.y - wob - 6); c.lineTo(pointer.x, pointer.y + wob + 6)
      c.stroke()
    }
    label(c, `Tur ${Math.min(this.round, ROUNDS)}/${ROUNDS}  ·  ok ${Math.min(this.dartNo + 1, 3)}/3  ·  ${this.total} puan`, cx, a.y + 22, 13, '#ffffff', 700)
    if (this.phase === 'ready') label(c, 'Nişan al, tuşa basılı tutarak elini sakinleştir, bırakınca atılır', cx, a.y + a.h - 18, 12)
    else if (this.phase === 'aim') label(c, this.holdOn ? 'Tut… çember küçülüyor' : (this.lastText ? `Son atış: ${this.lastText}` : 'Basılı tut, bırakınca at'), cx, a.y + a.h - 18, 12)
    else if (this.phase === 'wait') label(c, `Tur toplamı ${this.roundTotal}`, cx, a.y + a.h - 18, 13, '#ffffff', 700)
    else if (this.phase === 'over') label(c, 'Yeniden oynamak için tıkla', cx, a.y + a.h - 18, 13, '#ffffff', 700)
  }

  hud(): MiniHud {
    return { score: this.total, unit: `puan  ·  tur ${Math.min(this.round, ROUNDS)}/${ROUNDS}`, best: `Son atış ${this.lastText || '-'}`, hint: 'Hazır: nişan al, basılı tut, bırak', active: this.phase !== 'ready' }
  }
}
