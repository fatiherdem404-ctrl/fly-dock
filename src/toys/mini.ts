// The small self-contained games of the desktop toys (Pong, bowling, darts). Each one lives in a panel in the middle
// of the screen, so the rest of the desktop stays usable, and talks to the toy window through this small interface.

export interface Area {
  x: number
  y: number
  w: number
  h: number
}

export interface MiniHud {
  score: number
  unit: string
  best: string
  hint: string
  active: boolean
}

/** What a game may ask of the toy window. */
export interface Env {
  flash(text: string, seconds?: number): void
  tone(from: number, to: number, seconds: number, type?: OscillatorType, volume?: number, delay?: number): void
  /** The game is over with this score: the record is kept and the result card shown. */
  finish(score: number): void
  /** Games that are won or lost count their wins as the record instead. */
  win(): void
}

export interface MiniGame {
  /** The panel the game is played in; the window takes the mouse while the pointer is over it. */
  area(w: number, h: number, floor: number): Area
  step(dt: number, pointer: { x: number; y: number } | null, down: boolean, w: number, h: number, floor: number): void
  draw(c: CanvasRenderingContext2D, w: number, h: number, floor: number, pointer: { x: number; y: number } | null): void
  down(x: number, y: number): void
  up(x: number, y: number): void
  wheel(dy: number): void
  hud(): MiniHud
  reset(): void
}

export const TAU = Math.PI * 2
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const inside = (a: Area, x: number, y: number) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h

/** The dark rounded panel every game plays on. */
export function panel(c: CanvasRenderingContext2D, a: Area, tint = 'rgba(14, 18, 34, 0.9)') {
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.45)'
  c.shadowBlur = 30
  c.shadowOffsetY = 10
  c.fillStyle = tint
  c.beginPath()
  c.roundRect(a.x, a.y, a.w, a.h, 22)
  c.fill()
  c.restore()
  c.strokeStyle = 'rgba(255,255,255,0.16)'
  c.lineWidth = 1.5
  c.beginPath()
  c.roundRect(a.x, a.y, a.w, a.h, 22)
  c.stroke()
}

export function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size = 13, color = 'rgba(255,255,255,0.85)', weight = 600) {
  c.fillStyle = color
  c.font = `${weight} ${size}px 'Segoe UI', system-ui, sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, x, y)
}
