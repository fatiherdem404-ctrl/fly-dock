// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Pong against the computer on the whole screen, drawn like the football pitch (translucent grass, white lines): your
// paddle follows the pointer, the ball speeds up with every return, first to seven wins. The desktop stays usable:
// the window only takes the mouse on the "Başla" button between games.
import { Area, Env, MiniGame, MiniHud, TAU, clamp, label } from './mini'

import { t } from '../i18n'
const WIN = 7
const PADDLE_H = 120
const PADDLE_W = 14
const BALL_R = 11
const MARGIN = 46

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
  private dir: 1 | -1 = 1
  /** How solid the green is (the same setting as the football pitch). */
  alpha = 0.3

  constructor(private env: Env) {}

  area(w: number, _h: number, floor: number): Area {
    this.a = { x: 0, y: 0, w, h: floor }
    return this.a
  }

  private startBox() {
    const a = this.a
    return { x: a.x + a.w / 2 - 130, y: a.y + a.h / 2 - 34, w: 260, h: 68 }
  }

  /** The window takes the mouse only on the button, between games. */
  captures(x: number, y: number): boolean {
    if (this.phase !== 'ready' && this.phase !== 'over') return false
    const b = this.startBox()
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  }

  reset() {
    this.youPts = 0
    this.aiPts = 0
    this.phase = 'ready'
    this.rally = 0
    this.trail = []
  }

  private speedBase() {
    return 430 * clamp(this.a.w / 1200, 1, 1.9)
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
    const lo = a.y + 14 + PADDLE_H / 2, hi = a.y + a.h - 14 - PADDLE_H / 2
    if (pointer) this.you += (clamp(pointer.y, lo, hi) - this.you) * Math.min(1, dt * 22)
    if (this.phase === 'ready' || this.phase === 'over') {
      this.ai += (a.y + a.h / 2 - this.ai) * Math.min(1, dt * 2)
      return
    }
    const b = this.ball
    const base = this.speedBase()
    if (this.phase === 'serve') {
      this.timer -= dt
      if (this.timer <= 0) {
        const ang = (Math.random() - 0.5) * 0.8
        b.vx = Math.cos(ang) * base * this.dir
        b.vy = Math.sin(ang) * base
        this.phase = 'play'
      }
      return
    }
    // the computer: follows the ball with a little delay and error, and can only be so fast
    this.noise += dt
    const target = b.vx > 0 ? b.y + Math.sin(this.noise * 2.1) * 40 : a.y + a.h / 2
    const speed = (300 + this.youPts * 14) * clamp(a.h / 700, 1, 1.6)
    this.ai += clamp(target - this.ai, -speed * dt, speed * dt)
    this.ai = clamp(this.ai, lo, hi)

    b.x += b.vx * dt
    b.y += b.vy * dt
    this.trail.push([b.x, b.y])
    if (this.trail.length > 10) this.trail.shift()
    if (b.y < a.y + BALL_R + 6) { b.y = a.y + BALL_R + 6; b.vy = Math.abs(b.vy); this.env.tone(260, 200, 0.05, 'square', 0.05) }
    if (b.y > a.y + a.h - BALL_R - 6) { b.y = a.y + a.h - BALL_R - 6; b.vy = -Math.abs(b.vy); this.env.tone(260, 200, 0.05, 'square', 0.05) }

    const left = a.x + MARGIN + PADDLE_W
    const right = a.x + a.w - MARGIN - PADDLE_W
    const hit = (padY: number, side: 1 | -1) => {
      const off = (b.y - padY) / (PADDLE_H / 2)
      const sp = Math.min(base * 2.2, Math.hypot(b.vx, b.vy) * 1.06)
      const ang = clamp(off, -1, 1) * 0.95
      b.vx = Math.cos(ang) * sp * side
      b.vy = Math.sin(ang) * sp
      this.rally += 1
      this.env.tone(side === 1 ? 520 : 380, 260, 0.07, 'square', 0.08)
    }
    if (b.vx < 0 && b.x - BALL_R <= left && b.x > left - 28 && Math.abs(b.y - this.you) < PADDLE_H / 2 + BALL_R) { b.x = left + BALL_R; hit(this.you, 1) }
    if (b.vx > 0 && b.x + BALL_R >= right && b.x < right + 28 && Math.abs(b.y - this.ai) < PADDLE_H / 2 + BALL_R) { b.x = right - BALL_R; hit(this.ai, -1) }

    if (b.x < a.x - 10 || b.x > a.x + a.w + 10) {
      const youScored = b.x > a.x + a.w
      if (youScored) this.youPts += 1
      else this.aiPts += 1
      this.env.flash(youScored ? t('SAYI!') : t('RAKİP ATTI'), 0.9)
      this.env.tone(youScored ? 660 : 200, youScored ? 990 : 120, 0.25, 'triangle', 0.1)
      if (this.youPts >= WIN || this.aiPts >= WIN) {
        this.phase = 'over'
        const won = this.youPts > this.aiPts
        this.env.flash(won ? 'KAZANDIN!' : t('KAYBETTİN'), 1.6)
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
    const grass = clamp(this.alpha, 0, 1)
    c.save()
    c.fillStyle = `rgba(30, 120, 62, ${grass})`
    c.fillRect(a.x, a.y, a.w, a.h)
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 3
    c.strokeRect(a.x + 6, a.y + 6, a.w - 12, a.h - 12)
    c.setLineDash([14, 16])
    c.beginPath()
    c.moveTo(a.x + a.w / 2, a.y + 6)
    c.lineTo(a.x + a.w / 2, a.y + a.h - 6)
    c.stroke()
    c.setLineDash([])
    c.beginPath()
    c.arc(a.x + a.w / 2, a.y + a.h / 2, 70, 0, TAU)
    c.stroke()
    // the score, low enough to clear the scoreboard card
    c.fillStyle = 'rgba(255,255,255,0.5)'
    c.font = "800 84px 'Segoe UI', system-ui, sans-serif"
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(this.youPts), a.x + a.w / 2 - 120, a.y + 210)
    c.fillText(String(this.aiPts), a.x + a.w / 2 + 120, a.y + 210)
    // paddles and ball
    const pad = (x: number, y: number, color: string) => {
      c.save()
      c.shadowColor = color
      c.shadowBlur = 20
      c.fillStyle = color
      c.beginPath()
      c.roundRect(x, y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 7)
      c.fill()
      c.restore()
    }
    pad(a.x + MARGIN, this.you, '#5aa2ff')
    pad(a.x + a.w - MARGIN - PADDLE_W, this.ai, '#ff6a8a')
    for (let i = 0; i < this.trail.length; i++) {
      c.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.3})`
      c.beginPath()
      c.arc(this.trail[i][0], this.trail[i][1], BALL_R * (i / this.trail.length), 0, TAU)
      c.fill()
    }
    if (this.phase !== 'ready' && this.phase !== 'over') {
      c.save()
      c.shadowColor = '#ffffff'
      c.shadowBlur = 16
      c.fillStyle = '#ffffff'
      c.beginPath()
      c.arc(this.ball.x, this.ball.y, BALL_R, 0, TAU)
      c.fill()
      c.restore()
    }
    c.restore()
    // the button between games
    if (this.phase === 'ready' || this.phase === 'over') {
      const b = this.startBox()
      c.save()
      c.shadowColor = 'rgba(0,0,0,0.45)'
      c.shadowBlur = 24
      c.fillStyle = 'rgba(14, 18, 34, 0.92)'
      c.beginPath()
      c.roundRect(b.x, b.y, b.w, b.h, 18)
      c.fill()
      c.restore()
      c.strokeStyle = 'rgba(255,255,255,0.25)'
      c.lineWidth = 1.5
      c.beginPath()
      c.roundRect(b.x, b.y, b.w, b.h, 18)
      c.stroke()
      label(c, this.phase === 'over' ? (this.youPts > this.aiPts ? t('Kazandın! Tekrar oyna') : t('Kaybettin. Tekrar oyna')) : t('BAŞLA'), b.x + b.w / 2, b.y + b.h / 2 - 8, 20, '#ffffff', 800)
      label(c, t('raketi fareyle yönet · ilk 7 sayı kazanır'), b.x + b.w / 2, b.y + b.h / 2 + 16, 12, 'rgba(255,255,255,0.7)')
    }
  }

  hud(): MiniHud {
    return { score: this.youPts, unit: t('sayı  ·  rakip {aiPts}', { aiPts: this.aiPts }), best: t('Seri {rally}', { rally: this.rally }), hint: t('Hazır: BAŞLA düğmesine tıkla'), active: this.phase === 'play' || this.phase === 'serve' }
  }
}
