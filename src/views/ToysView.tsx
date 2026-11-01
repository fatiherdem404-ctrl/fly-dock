import { useEffect, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import type { DockSettings, ToyMode, ToyScores } from '@/shared/types'
import { DEFAULT_TOY_SCORES } from '@/shared/types'
import { Ball, Segment, World, bounceOffMover, inGoal, kickBall, makeBall, scoredThroughRim, stepBall, throwVelocity } from '@/toys/ball'
import { Pet, drop, makePet, pickUp, stepPet, stroke } from '@/toys/pet'
import { drawPet, drawPetExtras } from '@/toys/petDraw'
import handUrl from '@/assets/toys/hand.png'
import fistUrl from '@/assets/toys/fist.png'
import reachUrl from '@/assets/toys/reach.png'
import grabUrl from '@/assets/toys/grab.png'
import bootUrl from '@/assets/toys/boot.png'
import racketUrl from '@/assets/toys/racket.png'
import basketballUrl from '@/assets/toys/basketball.png'
import soccerUrl from '@/assets/toys/soccer.png'

type GameId = 'basket' | 'football' | 'tennis' | 'bounce'
/** The pet's own playthings: the cat's ball of yarn and the dog's stick. */
type PlayKind = 'yarn' | 'stick'
type BallKind = GameId | PlayKind
type Round = { active: boolean; left: number; score: number }

const ALL: BallKind[] = ['basket', 'football', 'tennis', 'bounce', 'yarn', 'stick']
const GAME_IDS: GameId[] = ['basket', 'football', 'tennis', 'bounce']
const ROUND_SECONDS = 60

const GAME_INFO: Record<GameId, { title: string; unit: string }> = {
  basket: { title: 'Basketbol', unit: 'sepet' },
  football: { title: 'Futbol', unit: 'gol' },
  tennis: { title: 'Tenis', unit: 'vuruş' },
  bounce: { title: 'Sektirme', unit: 'vuruş' },
}
const BEST_KEY: Record<GameId, keyof ToyScores> = { basket: 'basketBest', football: 'footballBest', tennis: 'tennisTimedBest', bounce: 'bounceBest' }

const modeOf = (s: DockSettings, id: GameId): ToyMode => (id === 'basket' ? s.toyBasketMode : id === 'football' ? s.toyFootballMode : id === 'tennis' ? s.toyTennisMode : s.toyBounceMode)
const enabledOf = (s: DockSettings, id: GameId): boolean => (id === 'basket' ? s.toyBasket : id === 'football' ? s.toyFootball : id === 'tennis' ? s.toyTennis : s.toyBounce)

// ---- pictures ----
const picture = (url: string) => {
  const img = new Image()
  img.src = url
  return img
}
const PICS = { hand: picture(handUrl), fist: picture(fistUrl), reach: picture(reachUrl), grab: picture(grabUrl), boot: picture(bootUrl), racket: picture(racketUrl), basket: picture(basketballUrl), football: picture(soccerUrl) }
const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0

/** What the on-screen scoreboard shows for one game. */
interface HudCard {
  id: GameId
  title: string
  unit: string
  timed: boolean
  active: boolean
  score: number
  left: number
  best: string
  hint: string
}
interface HudResult {
  title: string
  score: number
  unit: string
  best: number
  record: boolean
  game: string
}

/** Everything that moves lives here, outside React: the animation loop reads and writes it every frame. */
interface Sim {
  balls: Partial<Record<BallKind, Ball>>
  pet: Pet | null
  pointer: { x: number; y: number; vx: number; vy: number; t: number } | null
  samples: [number, number, number][]
  drag: { kind: 'ball'; ball: BallKind; dx: number; dy: number } | { kind: 'pet'; dx: number; dy: number; moved: number; at: number } | null
  capture: boolean
  scores: ToyScores
  /** Tennis rally in free play. */
  rally: number
  games: Record<GameId, { round: Round; session: number }>
  /** The result card shown for a few seconds after a timed round. */
  result: (HudResult & { left: number }) | null
  /** Text flashed in the middle of the screen: SEPET!, GOL! … */
  flash: { text: string; left: number } | null
  /** A scored football is put back when this runs out. */
  respawn: number
  hover: boolean
  /** Size of the window the toys were last placed for. */
  size: string
  /** The hand, boot or racket the pointer has turned into near a ball. */
  armed: 'basket' | 'football' | 'tennis' | null
  /** Which side of the pointer the ball is on: the boot and the racket always face it, so they never spin around. */
  toolDir: 1 | -1
  /** Smoothed up/down swing of the tool, from how fast the pointer moves vertically. */
  toolTilt: number
  /** Where the pointer was in the previous frame and how fast it is going, so fast swings can be swept for hits. */
  toolPos: { x: number; y: number } | null
  toolVx: number
  toolVy: number
  /** Last time each ball was struck, to count one stroke once. */
  struck: Record<string, number>
  /** The dog has the stick in its mouth. */
  carried: boolean
  /** The stick was thrown and lies free for the dog to fetch. */
  stickThrown: boolean
  /** Where the stick was thrown from: the dog brings it back there. */
  throwFrom: number
  /** Racket and baseball: a rally is on, the pointer is the racket, and hits in a row are counted. */
  bounce: { playing: boolean; combo: number; respawn: number }
  /** Pet animation: a clock, and how far through its walking cycle it is. */
  clock: number
  gait: number
  lastPetX: number
  cursor: string
}

const SPEC: Record<BallKind, { r: number; gravity: number; restitution: number; rolling: number }> = {
  basket: { r: 24, gravity: 2000, restitution: 0.72, rolling: 1.2 },
  football: { r: 28, gravity: 1900, restitution: 0.62, rolling: 0.9 },
  tennis: { r: 13, gravity: 1500, restitution: 0.86, rolling: 0.7 },
  bounce: { r: 17, gravity: 1900, restitution: 0.8, rolling: 1 },
  yarn: { r: 15, gravity: 1800, restitution: 0.5, rolling: 0.8 },
  stick: { r: 9, gravity: 1900, restitution: 0.3, rolling: 3.2 },
}
const GOAL_DEPTH = 64
const GOAL_HEIGHT = 150
const NET_HEIGHT = 96
const TAU = Math.PI * 2
/** How close the pointer has to come before it turns into a hand, a boot or a racket. */
const AURA: Record<'basket' | 'football' | 'tennis', number> = { basket: 70, football: 90, tennis: 120 }
/** Distance from the racket's grip to the middle of its head, and the head's hitting radius. */
const RACKET_REACH = 96
const HEAD_R = 34
/** The racket's resting lift above the horizontal, in radians. */
const RACKET_REST = 0.3

/** The line the toys stand on: the top of the dock when it sits at the bottom, else the bottom of the work area. */
function floorOf(s: DockSettings, height: number): number {
  if (s.toyFloor === 'screen' || s.position !== 'bottom' || s.autoHide) return height
  return Math.max(height * 0.4, height - s.edgeOffset - (s.iconSize + s.deskPadTop + s.deskPadBottom))
}

/** The basketball hoop on the chosen side: the backboard against the screen edge and the rim reaching out from it. */
function hoop(width: number, floor: number, side: 'left' | 'right') {
  const rimY = Math.max(150, floor - 330)
  const boardX = side === 'right' ? width - 22 : 22
  const near = side === 'right' ? width - 26 : 26
  const far = side === 'right' ? near - 84 : near + 84
  return { rimY, boardX, lo: Math.min(near, far), hi: Math.max(near, far), near, far, boardTop: rimY - 100, boardBottom: rimY + 12 }
}

function segmentsFor(kind: BallKind, width: number, floor: number, side: 'left' | 'right'): Segment[] {
  if (kind === 'basket') {
    const h = hoop(width, floor, side)
    return [
      { ax: h.boardX, ay: h.boardTop, bx: h.boardX, by: h.boardBottom, restitution: 0.5 },
      { ax: h.far, ay: h.rimY, bx: h.far, by: h.rimY, restitution: 0.55 },
      { ax: h.near, ay: h.rimY, bx: h.near, by: h.rimY, restitution: 0.55 },
    ]
  }
  if (kind === 'football') {
    const top = floor - GOAL_HEIGHT
    return [
      { ax: 0, ay: top, bx: GOAL_DEPTH, by: top, restitution: 0.5 },
      { ax: width - GOAL_DEPTH, ay: top, bx: width, by: top, restitution: 0.5 },
    ]
  }
  if (kind === 'tennis') {
    const x = width / 2
    return [
      { ax: x, ay: floor - NET_HEIGHT, bx: x, by: floor, restitution: 0.3 },
      { ax: x, ay: floor - NET_HEIGHT, bx: x, by: floor - NET_HEIGHT, restitution: 0.6 },
    ]
  }
  return []
}

function startPosition(kind: BallKind, width: number, floor: number, side: 'left' | 'right', petX = width * 0.3): [number, number] {
  const r = SPEC[kind].r
  switch (kind) {
    case 'basket': return [side === 'right' ? width - 280 : 280, floor - r]
    case 'football': return [width * 0.62, floor - r]
    case 'tennis': return [width * 0.3, floor - r]
    case 'bounce': return [width * 0.46, floor - r]
    case 'yarn': return [Math.min(Math.max(petX + 170, 80), width - 80), floor - r]
    default: return [Math.min(Math.max(petX - 170, 80), width - 80), floor - r]
  }
}

// ---- sound: tiny synthesized blips, nothing to load ----
let audio: AudioContext | null = null
function tone(on: boolean, from: number, to: number, seconds: number, type: OscillatorType = 'sine', volume = 0.12, delay = 0) {
  if (!on) return
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const t0 = audio.currentTime + delay
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + seconds)
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds)
    osc.connect(gain).connect(audio.destination)
    osc.start(t0)
    osc.stop(t0 + seconds + 0.02)
  } catch {
    /* no audio device: the toys stay silent */
  }
}

// ---- the pointer's tools ----

type Circle = { x: number; y: number; r: number }

/** The solid parts of the tool at the pointer: where a ball can hit it. */
function toolCircles(kind: 'tennis' | 'football' | 'bounce', x: number, y: number, dir: number, tilt: number): Circle[] {
  if (kind === 'tennis') {
    const a = RACKET_REST - tilt
    return [{ x: x + dir * Math.cos(a) * RACKET_REACH, y: y - Math.sin(a) * RACKET_REACH, r: HEAD_R }]
  }
  if (kind === 'bounce') return [{ x, y, r: 28 }]
  // a boot: toe, instep and heel, lifting a little as the leg swings up
  const lift = -tilt * 26
  return [
    { x: x - dir * 14, y: y - 6 + lift * 0.4, r: 17 },
    { x: x - dir * 52, y: y - 14 + lift * 0.8, r: 20 },
    { x: x - dir * 98, y: y - 22 + lift, r: 22 },
  ]
}

// ---- drawing ----

function drawBall(c: CanvasRenderingContext2D, b: Ball, kind: BallKind, floor: number) {
  const height = Math.max(0, floor - (b.y + b.r))
  const shade = Math.max(0.08, 0.32 - height / 900)
  c.fillStyle = `rgba(0,0,0,${shade})`
  c.beginPath()
  c.ellipse(b.x, floor - 2, (kind === 'stick' ? 30 : b.r) * Math.max(0.35, 1 - height / 700), b.r * 0.22, 0, 0, TAU)
  c.fill()
  c.save()
  c.translate(b.x, b.y)
  c.rotate(b.angle)
  if (kind === 'stick') {
    // a branch: a rounded brown stick with a knot and a twig
    c.lineCap = 'round'
    c.strokeStyle = '#6b4423'
    c.lineWidth = 9
    c.beginPath(); c.moveTo(-32, 0); c.lineTo(32, 0); c.stroke()
    c.strokeStyle = '#8f5f33'
    c.lineWidth = 5
    c.beginPath(); c.moveTo(-31, -1.5); c.lineTo(31, -1.5); c.stroke()
    c.strokeStyle = '#6b4423'
    c.lineWidth = 4
    c.beginPath(); c.moveTo(6, 0); c.lineTo(16, -11); c.stroke()
    c.fillStyle = '#4a2c13'
    c.beginPath(); c.arc(-18, 1, 2, 0, TAU); c.fill()
    c.restore()
    return
  }
  if ((kind === 'basket' || kind === 'football') && ready(PICS[kind])) {
    const d = b.r * 2.12
    c.drawImage(PICS[kind], -d / 2, -d / 2, d, d)
    c.restore()
    return
  }
  const g = c.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r)
  if (kind === 'basket') { g.addColorStop(0, '#ffb066'); g.addColorStop(1, '#c9591b') }
  else if (kind === 'football') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd3da') }
  else if (kind === 'yarn') { g.addColorStop(0, '#ff9ec4'); g.addColorStop(1, '#d6447f') }
  else if (kind === 'bounce') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d6cf') }
  else { g.addColorStop(0, '#e9ff6a'); g.addColorStop(1, '#a9c91d') }
  c.fillStyle = g
  c.beginPath()
  c.arc(0, 0, b.r, 0, TAU)
  c.fill()
  c.lineCap = 'round'
  if (kind === 'yarn') {
    c.strokeStyle = 'rgba(120,20,60,0.55)'
    c.lineWidth = 1.5
    for (let i = -2; i <= 2; i++) {
      c.beginPath()
      c.ellipse(0, 0, b.r * 0.95, Math.max(2, b.r * (0.25 + Math.abs(i) * 0.18)), i * 0.5, 0, TAU)
      c.stroke()
    }
  } else if (kind === 'bounce') {
    // a baseball: two curved seams with red stitches
    c.strokeStyle = '#c8302f'
    c.lineWidth = 1.8
    for (const s of [-1, 1]) {
      c.beginPath()
      c.arc(s * b.r * 1.15, 0, b.r * 0.95, s > 0 ? Math.PI - 0.95 : -0.95, s > 0 ? Math.PI + 0.95 : 0.95)
      c.stroke()
      c.lineWidth = 1.2
      for (let i = -4; i <= 4; i++) {
        const a = (i / 4) * 0.85
        const x = s * b.r * 1.15 - s * Math.cos(a) * b.r * 0.95
        const y = Math.sin(a) * b.r * 0.95
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - s * 3.4, y + (a >= 0 ? 2.6 : -2.6)); c.stroke()
      }
      c.lineWidth = 1.8
    }
  } else if (kind === 'tennis') {
    c.strokeStyle = 'rgba(255,255,255,0.9)'
    c.lineWidth = Math.max(1.4, b.r * 0.12)
    c.beginPath()
    c.arc(-b.r * 1.15, 0, b.r * 0.95, -0.9, 0.9)
    c.moveTo(b.r * 0.3, 0)
    c.arc(b.r * 1.15, 0, b.r * 0.95, Math.PI - 0.9, Math.PI + 0.9)
    c.stroke()
  }
  c.restore()
  c.strokeStyle = 'rgba(0,0,0,0.25)'
  c.lineWidth = 1
  c.beginPath()
  c.arc(b.x, b.y, b.r, 0, TAU)
  c.stroke()
}

const shadowed = (c: CanvasRenderingContext2D) => {
  c.shadowColor = 'rgba(0,0,0,0.35)'
  c.shadowBlur = 8
  c.shadowOffsetY = 3
}

/** The racket picture with its grip at (gx, gy) and its head along `axis` (radians, 0 = right, up is negative). */
function drawRacket(c: CanvasRenderingContext2D, gx: number, gy: number, dir: number, axis: number) {
  if (!ready(PICS.racket)) return
  c.save()
  c.translate(gx, gy)
  shadowed(c)
  c.scale(dir, 1)
  c.rotate(axis + 0.72) // the picture's own axis is 0.72 rad above the horizontal
  const s = 0.174
  c.drawImage(PICS.racket, -19 * s, -462 * s, 640 * s, 502 * s)
  c.restore()
}

function drawBoot(c: CanvasRenderingContext2D, x: number, y: number, dir: number, tilt: number) {
  if (!ready(PICS.boot)) return
  c.save()
  c.translate(x, y)
  shadowed(c)
  c.scale(dir, 1)
  c.rotate(tilt * 0.7)
  c.drawImage(PICS.boot, -140 * 0.97, -84 * 0.7, 140, 84)
  c.restore()
}

/** An open hand reaching down from above, fingertips at the pointer. */
function drawReach(c: CanvasRenderingContext2D, x: number, y: number) {
  const img = PICS.reach
  if (!ready(img)) return
  c.save()
  c.translate(x, y)
  shadowed(c)
  c.rotate(Math.PI / 2)
  const w = 74
  c.drawImage(img, -w * 0.96, -w * 0.5, w, w)
  c.restore()
}

/** A hand curled over the top of a ball it is holding. */
function drawGrip(c: CanvasRenderingContext2D, ball: Ball) {
  const img = PICS.grab
  if (!ready(img)) return
  const w = ball.r * 4.0
  c.save()
  c.translate(ball.x, ball.y)
  shadowed(c)
  c.drawImage(img, -w * 0.6, -w * 0.66, w, w)
  c.restore()
}

function drawFist(c: CanvasRenderingContext2D, x: number, y: number) {
  const img = PICS.fist
  if (!ready(img)) return
  c.save()
  shadowed(c)
  c.drawImage(img, x - 26, y - 20, 52, 52)
  c.restore()
}

function drawScene(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  if (s.toyBasket) {
    const h = hoop(width, floor, s.toyHoopSide)
    c.fillStyle = 'rgba(255,255,255,0.92)'
    c.strokeStyle = 'rgba(30,40,60,0.7)'
    c.lineWidth = 2
    c.beginPath()
    c.roundRect(h.boardX - 6, h.boardTop, 12, h.boardBottom - h.boardTop, 3)
    c.fill()
    c.stroke()
    c.strokeStyle = '#e8452c'
    c.lineWidth = 2.5
    c.strokeRect(h.boardX - 4, h.rimY - 34, 8, 30)
    c.strokeStyle = 'rgba(255,255,255,0.8)'
    c.lineWidth = 1.4
    c.beginPath()
    for (let i = 0; i <= 5; i++) {
      const t = i / 5
      c.moveTo(h.lo + (h.hi - h.lo) * t, h.rimY)
      c.lineTo(h.lo + 14 + (h.hi - h.lo - 28) * t, h.rimY + 46)
    }
    for (let j = 1; j <= 3; j++) {
      const y = h.rimY + j * 12
      const inset = (j * 14) / 3.8
      c.moveTo(h.lo + inset, y)
      c.lineTo(h.hi - inset, y)
    }
    c.stroke()
    c.strokeStyle = '#ff7a2f'
    c.lineWidth = 5
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(h.lo, h.rimY)
    c.lineTo(h.hi, h.rimY)
    c.stroke()
  }
  if (s.toyFootball) {
    const top = floor - GOAL_HEIGHT
    const goal = (x: number, w: number) => {
      c.fillStyle = 'rgba(255,255,255,0.1)'
      c.fillRect(x, top, w, GOAL_HEIGHT)
      c.strokeStyle = 'rgba(255,255,255,0.45)'
      c.lineWidth = 1
      c.beginPath()
      for (let i = 1; i < 6; i++) {
        c.moveTo(x, top + (GOAL_HEIGHT / 6) * i); c.lineTo(x + w, top + (GOAL_HEIGHT / 6) * i)
        c.moveTo(x + (w / 6) * i, top); c.lineTo(x + (w / 6) * i, floor)
      }
      c.stroke()
      c.strokeStyle = '#ffffff'
      c.lineWidth = 5
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(x === 0 ? 0 : x, top)
      c.lineTo(x === 0 ? w : x + w, top)
      c.moveTo(x === 0 ? w : x, top)
      c.lineTo(x === 0 ? w : x, floor)
      c.stroke()
    }
    goal(0, GOAL_DEPTH)
    goal(width - GOAL_DEPTH, GOAL_DEPTH)
  }
  if (s.toyTennis) {
    const x = width / 2
    const top = floor - NET_HEIGHT
    c.fillStyle = 'rgba(255,255,255,0.14)'
    c.fillRect(x - 3, top, 6, NET_HEIGHT)
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 1
    c.beginPath()
    for (let y = top + 8; y < floor; y += 9) { c.moveTo(x - 3, y); c.lineTo(x + 3, y) }
    c.stroke()
    c.fillStyle = '#ffffff'
    c.fillRect(x - 4, top - 1, 8, 5)
    c.fillStyle = '#d9d9e0'
    c.fillRect(x - 1.5, top, 3, NET_HEIGHT)
  }
  if (sim.flash) {
    const t = Math.min(1, sim.flash.left / 0.4)
    c.globalAlpha = t
    c.font = "800 54px 'Segoe UI', system-ui, sans-serif"
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.lineWidth = 6
    c.lineJoin = 'round'
    c.strokeStyle = 'rgba(10,14,28,0.75)'
    c.strokeText(sim.flash.text, width / 2, floor * 0.42 - (1 - t) * 10)
    c.fillStyle = '#ffffff'
    c.fillText(sim.flash.text, width / 2, floor * 0.42 - (1 - t) * 10)
    c.globalAlpha = 1
  }
  for (const kind of ALL) {
    const ball = sim.balls[kind]
    if (ball) drawBall(c, ball, kind, floor)
  }
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function GameIcon({ id }: { id: GameId }) {
  if (id === 'basket') return <img src={basketballUrl} alt="" />
  if (id === 'football') return <img src={soccerUrl} alt="" />
  if (id === 'tennis') return <img src={racketUrl} alt="" />
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#f4f1ea" stroke="#b9b3a6" strokeWidth="1" />
      <path d="M8 6 Q 14 16 8 26 M24 6 Q 18 16 24 26" fill="none" stroke="#c8302f" strokeWidth="1.8" />
    </svg>
  )
}

/** The scoreboard: one card per game that is on, and the result card after a timed round. */
function Hud({ cards, result }: { cards: HudCard[]; result: HudResult | null }) {
  return (
    <>
      <div className="hud">
        {cards.map((card) => (
          <div key={card.id} className={`hud-card${card.timed && card.active && card.left <= 10 ? ' hud-card--urgent' : ''}`} data-active={card.active}>
            <div className="hud-card__head">
              <span className="hud-card__icon"><GameIcon id={card.id} /></span>
              <b>{card.title}</b>
              <span className="hud-chip">{card.timed ? 'Süreye karşı' : 'Serbest'}</span>
            </div>
            <div className="hud-card__main">
              <strong>{card.score}</strong>
              <small>{card.unit}</small>
              {card.timed && <time>{clock(card.active ? card.left : ROUND_SECONDS)}</time>}
            </div>
            {card.timed && <div className="hud-bar"><i style={{ width: `${card.active ? (card.left / ROUND_SECONDS) * 100 : 100}%` }} /></div>}
            <div className="hud-card__foot">{card.timed && !card.active ? card.hint : card.best}</div>
          </div>
        ))}
      </div>
      {result && (
        <div className={`hud-result${result.record ? ' hud-result--record' : ''}`}>
          <small>{result.game}</small>
          <h2>{result.record ? 'Yeni rekor!' : 'Süre doldu'}</h2>
          <strong>{result.score}<span> {result.unit}</span></strong>
          <p>{result.record ? 'Önceki rekorunu geçtin' : `Rekor: ${result.best}`}</p>
        </div>
      )}
    </>
  )
}

export default function ToysView() {
  const [settings, setSettings] = useState<DockSettings | null>(null)
  useEffect(() => {
    invoke('settings:get').then(setSettings)
  }, [])
  useEvent('settings:changed', setSettings)
  if (!settings) return null
  return <Toys s={settings} />
}

function Toys({ s }: { s: DockSettings }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const settingsRef = useRef(s)
  settingsRef.current = s
  const [hud, setHud] = useState<{ cards: HudCard[]; result: HudResult | null }>({ cards: [], result: null })
  const newGame = () => ({ round: { active: false, left: 0, score: 0 }, session: 0 })
  const sim = useRef<Sim>({
    balls: {}, pet: null, pointer: null, samples: [], drag: null, capture: false, scores: { ...DEFAULT_TOY_SCORES }, rally: 0,
    games: { basket: newGame(), football: newGame(), tennis: newGame(), bounce: newGame() },
    result: null, flash: null, respawn: 0, hover: false, size: '', armed: null, toolDir: 1, toolTilt: 0, toolPos: null, toolVx: 0, toolVy: 0, struck: {},
    carried: false, stickThrown: false, throwFrom: 0, bounce: { playing: false, combo: 0, respawn: 0 }, clock: 0, gait: 0, lastPetX: 0, cursor: '',
  })

  useEffect(() => {
    const st = sim.current
    ;(window as unknown as { __toys: Sim }).__toys = st
    invoke('toys:scores').then((scores) => (st.scores = scores))
    const setCapture = (on: boolean) => {
      if (st.capture === on) return
      st.capture = on
      invoke('toys:capture', on)
    }
    const setCursor = (value: string) => {
      if (st.cursor === value || !root.current) return
      st.cursor = value
      root.current.style.cursor = value
    }
    const saveScores = (patch: Partial<ToyScores>) => {
      st.scores = { ...st.scores, ...patch }
      invoke('toys:scores', patch)
    }
    const dims = () => ({ w: window.innerWidth, h: window.innerHeight })
    /** A timed round starts with the first touch of the ball. */
    const startRound = (id: GameId) => {
      const g = st.games[id]
      if (g.round.active || modeOf(settingsRef.current, id) !== 'timed') return
      g.round.active = true
      g.round.left = ROUND_SECONDS
      g.round.score = 0
      st.result = null
      tone(settingsRef.current.toySound, 440, 880, 0.18, 'triangle', 0.1)
    }
    const point = (id: GameId) => {
      const g = st.games[id]
      g.session += 1
      if (g.round.active) g.round.score += 1
    }
    const endRound = (id: GameId) => {
      const g = st.games[id]
      g.round.active = false
      const key = BEST_KEY[id]
      const best = st.scores[key]
      const record = g.round.score > best
      if (record) saveScores({ [key]: g.round.score })
      st.result = { game: GAME_INFO[id].title, title: record ? 'Yeni rekor!' : 'Süre doldu', score: g.round.score, unit: GAME_INFO[id].unit, best: record ? g.round.score : best, record, left: 4.5 }
      const sound = settingsRef.current.toySound
      if (record) [523, 659, 784, 1047].forEach((f, i) => tone(sound, f, f, 0.2, 'triangle', 0.1, i * 0.12))
      else tone(sound, 400, 200, 0.4, 'triangle', 0.1)
    }
    const petBox = () => {
      const cur = settingsRef.current
      const p = st.pet
      if (!p || !cur.toyPet) return null
      const size = cur.toyPetSize
      return { x: p.x - size * 0.55, y: p.y - size * 0.95, w: size * 1.1, h: size * 0.95 }
    }
    /** What can be picked up or started at a point: basketball, baseball, yarn, stick or the pet. */
    const grabAt = (x: number, y: number): { kind: 'ball'; ball: BallKind } | { kind: 'pet' } | null => {
      for (const kind of ['yarn', 'stick', 'bounce', 'basket'] as BallKind[]) {
        const b = st.balls[kind]
        if (b && Math.hypot(b.x - x, b.y - y) <= b.r + (kind === 'stick' ? 26 : 8)) return { kind: 'ball', ball: kind }
      }
      const box = petBox()
      if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return { kind: 'pet' }
      return null
    }
    /** Is the pointer close enough to a ball to turn into a hand, a boot or a racket? */
    const armedFor = (x: number, y: number): 'basket' | 'football' | 'tennis' | null => {
      for (const kind of ['football', 'tennis', 'basket'] as const) {
        const b = st.balls[kind]
        if (b && !b.grabbed && Math.hypot(b.x - x, b.y - y) <= b.r + AURA[kind]) return kind
      }
      return null
    }
    /** Decides what the pointer is and whether the window takes the mouse. */
    const refresh = (x: number, y: number) => {
      const playing = st.bounce.playing
      st.armed = playing || st.drag ? null : armedFor(x, y)
      const over = playing || st.drag ? null : grabAt(x, y)
      setCapture(!!over || !!st.armed || !!st.drag || playing)
      setCursor(st.drag || st.armed || playing ? 'none' : over ? (over.kind === 'pet' ? 'pointer' : 'grab') : '')
      const hovering = over?.kind === 'pet'
      if (hovering !== st.hover) st.hover = hovering
    }
    /** A rally of the racket and the baseball has ended: the ball touched the floor. */
    const dropBounce = () => {
      const b = st.bounce
      if (b.combo > st.scores.bounceCombo) saveScores({ bounceCombo: b.combo })
      b.combo = 0
      const timed = st.games.bounce.round.active
      if (timed) b.respawn = 0.9
      else b.playing = false
      tone(settingsRef.current.toySound, 300, 110, 0.3, 'sawtooth', 0.08)
    }

    const onMove = (e: MouseEvent) => {
      const now = performance.now()
      const prev = st.pointer
      let vx = 0
      let vy = 0
      if (prev) {
        const dt = Math.max(0.004, (now - prev.t) / 1000)
        vx = prev.vx * 0.4 + ((e.clientX - prev.x) / dt) * 0.6
        vy = prev.vy * 0.4 + ((e.clientY - prev.y) / dt) * 0.6
      }
      st.pointer = { x: e.clientX, y: e.clientY, vx, vy, t: now }
      const d = st.drag
      if (d) {
        st.samples.push([e.clientX, e.clientY, now])
        if (st.samples.length > 12) st.samples.shift()
        const { w, h } = dims()
        if (d.kind === 'ball') {
          const ball = st.balls[d.ball]
          if (ball) {
            ball.x = Math.min(Math.max(e.clientX + d.dx, ball.r), w - ball.r)
            ball.y = Math.min(Math.max(e.clientY + d.dy, ball.r), h - ball.r)
          }
        } else if (st.pet) {
          d.moved += Math.hypot(e.movementX, e.movementY)
          st.pet.x = e.clientX + d.dx
          st.pet.y = e.clientY + d.dy
        }
        return
      }
      const yarn = st.balls.yarn
      if (yarn && kickBall(yarn, e.clientX, e.clientY, vx, vy)) tone(settingsRef.current.toySound, 330, 200, 0.06, 'triangle', 0.08)
      refresh(e.clientX, e.clientY)
    }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const over = st.bounce.playing ? null : grabAt(e.clientX, e.clientY)
      if (!over) return
      st.samples = [[e.clientX, e.clientY, performance.now()]]
      st.armed = null
      if (over.kind === 'ball' && over.ball === 'bounce') {
        // serve: the baseball is thrown up and the pointer becomes the racket
        const ball = st.balls.bounce!
        ball.vx = (Math.random() - 0.5) * 160
        ball.vy = -1150
        ball.floorHits = 0
        st.bounce = { playing: true, combo: 0, respawn: 0 }
        startRound('bounce')
        tone(settingsRef.current.toySound, 220, 520, 0.14, 'triangle', 0.1)
        refresh(e.clientX, e.clientY)
        return
      }
      setCursor('none')
      if (over.kind === 'ball') {
        const ball = st.balls[over.ball]!
        ball.grabbed = true
        ball.vx = 0
        ball.vy = 0
        ball.floorHits = 0
        if (over.ball === 'stick') {
          st.carried = false
          st.stickThrown = false
        }
        if (over.ball === 'basket') startRound('basket')
        st.drag = { kind: 'ball', ball: over.ball, dx: ball.x - e.clientX, dy: ball.y - e.clientY }
      } else if (st.pet) {
        if (st.carried) {
          st.carried = false
          const stick = st.balls.stick
          if (stick) stick.grabbed = false
        }
        pickUp(st.pet)
        st.drag = { kind: 'pet', dx: st.pet.x - e.clientX, dy: st.pet.y - e.clientY, moved: 0, at: performance.now() }
      }
    }
    const onUp = () => {
      const d = st.drag
      if (!d) return
      st.drag = null
      const v = throwVelocity(st.samples)
      st.samples = []
      if (d.kind === 'ball') {
        const ball = st.balls[d.ball]
        if (ball) {
          ball.grabbed = false
          ball.vx = v.vx
          ball.vy = v.vy
          if (d.ball === 'stick' && Math.hypot(v.vx, v.vy) > 250) {
            st.stickThrown = true
            st.throwFrom = st.pointer?.x ?? ball.x
          }
        }
      } else if (st.pet) {
        const click = d.moved < 5 && performance.now() - d.at < 400
        if (click) {
          st.pet.state = 'idle'
          st.pet.timer = 0.1
          stroke(st.pet)
          const cur = settingsRef.current
          tone(cur.toySound, cur.toyPetKind === 'dog' ? 380 : 620, cur.toyPetKind === 'dog' ? 520 : 940, 0.16, 'triangle', 0.1)
          tone(cur.toySound, cur.toyPetKind === 'dog' ? 440 : 780, cur.toyPetKind === 'dog' ? 330 : 1100, 0.14, 'triangle', 0.1, 0.12)
        } else drop(st.pet, v.vx * 0.5, v.vy * 0.5)
      }
      const p = st.pointer
      if (p) refresh(p.x, p.y)
    }
    /** A right click puts the racket down and ends the rally (and a timed round) at once. */
    const onContext = (e: MouseEvent) => {
      if (!st.bounce.playing) return
      e.preventDefault()
      const b = st.bounce
      if (b.combo > st.scores.bounceCombo) saveScores({ bounceCombo: b.combo })
      b.playing = false
      b.combo = 0
      if (st.games.bounce.round.active) endRound('bounce')
      const p = st.pointer
      if (p) refresh(p.x, p.y)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('contextmenu', onContext)

    // the scoreboard is plain page content, refreshed a few times a second
    let lastHud = ''
    const hudTimer = window.setInterval(() => {
      const cur = settingsRef.current
      const cards: HudCard[] = []
      for (const id of GAME_IDS) {
        if (!enabledOf(cur, id)) continue
        const timed = modeOf(cur, id) === 'timed'
        const g = st.games[id]
        const sc = st.scores
        let best = ''
        if (timed) best = `Rekor ${sc[BEST_KEY[id]]}`
        else if (id === 'basket') best = `Toplam ${sc.basket}`
        else if (id === 'football') best = `Toplam ${sc.football}`
        else if (id === 'tennis') best = `Seri ${st.rally}  ·  Rekor ${sc.tennisBest}`
        else best = `Seri ${st.bounce.combo}  ·  Rekor ${sc.bounceCombo}`
        const hint = id === 'basket' ? 'Hazır: topu tutunca başlar' : id === 'bounce' ? 'Hazır: topa tıkla ve başla' : 'Hazır: topa vurunca başlar'
        cards.push({ id, title: GAME_INFO[id].title, unit: GAME_INFO[id].unit, timed, active: g.round.active, score: timed ? g.round.score : g.session, left: Math.round(g.round.left * 10) / 10, best, hint })
      }
      const result = st.result ? { game: st.result.game, title: st.result.title, score: st.result.score, unit: st.result.unit, best: st.result.best, record: st.result.record } : null
      const key = JSON.stringify([cards, result])
      if (key !== lastHud) {
        lastHud = key
        setHud({ cards, result })
      }
    }, 100)

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const cur = settingsRef.current
      const { w, h } = dims()
      if (w < 300 || h < 300) return // the window has not been laid out yet
      const floor = floorOf(cur, h)
      const side = cur.toyHoopSide
      st.clock += dt

      // the toys that should exist right now
      const enabled: Record<BallKind, boolean> = {
        basket: cur.toyBasket,
        football: cur.toyFootball,
        tennis: cur.toyTennis,
        bounce: cur.toyBounce,
        yarn: cur.toyPet && cur.toyPetPlay && cur.toyPetKind === 'cat',
        stick: cur.toyPet && cur.toyPetPlay && cur.toyPetKind === 'dog',
      }

      // a changed screen size puts the balls back where they start, and nothing scores while they settle
      const sizeKey = `${w}x${h}`
      if (st.size !== sizeKey) {
        if (st.size) {
          for (const kind of Object.keys(st.balls) as BallKind[]) {
            const [x, y] = startPosition(kind, w, floor, side, st.pet?.x)
            Object.assign(st.balls[kind]!, { x, y: y - 120, vx: 0, vy: 0 })
          }
          st.respawn = 0.6
        }
        st.size = sizeKey
      }

      for (const kind of ALL) {
        if (!enabled[kind]) {
          if (st.balls[kind]) {
            delete st.balls[kind]
            if (kind === 'stick') {
              st.carried = false
              st.stickThrown = false
            }
            if (kind === 'bounce') st.bounce = { playing: false, combo: 0, respawn: 0 }
          }
        } else if (!st.balls[kind]) {
          const [x, y] = startPosition(kind, w, floor, side, st.pet?.x)
          st.balls[kind] = makeBall(x, y - 120, SPEC[kind].r)
        }
      }
      // a game that is switched off, or set to free play, has no round running
      for (const id of GAME_IDS) {
        const g = st.games[id]
        if (g.round.active && (!enabledOf(cur, id) || modeOf(cur, id) === 'free')) g.round.active = false
        if (!enabledOf(cur, id)) g.session = 0
      }
      if (!cur.toyPet) st.pet = null
      else if (!st.pet) st.pet = makePet(w * 0.3, floor)

      // ---- the pointer's tool: which ball it faces, how it swings, and every spot it passed through this frame ----
      const p = st.pointer
      let toolPath: { x: number; y: number }[] = []
      let toolKind: 'tennis' | 'football' | 'bounce' | null = null
      if (p) {
        toolKind = st.bounce.playing ? 'bounce' : st.armed === 'tennis' || st.armed === 'football' ? st.armed : null
        const from = st.toolPos ?? { x: p.x, y: p.y }
        const mdx = p.x - from.x
        const mdy = p.y - from.y
        if (dt > 0) {
          st.toolVx = st.toolVx * 0.45 + (mdx / dt) * 0.55
          st.toolVy = st.toolVy * 0.45 + (mdy / dt) * 0.55
        }
        if (Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1) { st.toolVx *= 0.5; st.toolVy *= 0.5 }
        const steps = Math.max(1, Math.min(14, Math.ceil(Math.hypot(mdx, mdy) / 10)))
        for (let k = 1; k <= steps; k++) toolPath.push({ x: from.x + (mdx * k) / steps, y: from.y + (mdy * k) / steps })
        st.toolPos = { x: p.x, y: p.y }
        const target = Math.max(-0.5, Math.min(0.5, st.toolVy / 3200))
        st.toolTilt += (target - st.toolTilt) * Math.min(1, 12 * dt)
        if (toolKind === 'tennis' || toolKind === 'football') {
          const ball = st.balls[toolKind]
          if (ball && Math.abs(ball.x - p.x) > 14) st.toolDir = ball.x > p.x ? 1 : -1
        }
      } else toolPath = []
      // the pointer stands still between events: its speed fades out
      st.toolVx *= 1 - Math.min(1, 6 * dt) * 0.0
      const tv = { vx: st.toolVx, vy: st.toolVy }
      const hitOk = (key: string) => {
        if (now - (st.struck[key] ?? 0) < 160) return false
        st.struck[key] = now
        return true
      }

      for (const kind of ALL) {
        const ball = st.balls[kind]
        if (!ball) continue
        if (kind === 'stick' && st.carried) continue
        const spec = SPEC[kind]
        const world: World = { width: w, floor, gravity: spec.gravity, restitution: spec.restitution, rolling: spec.rolling }
        const hitsBefore = ball.floorHits
        const prevY = ball.y
        const prevAngle = ball.angle
        const speedBefore = Math.abs(ball.vy)
        // a ball being served up off the floor, or waiting to be put back, stays out of the physics
        if (kind === 'bounce' && st.bounce.respawn > 0) {
          st.bounce.respawn -= dt
          if (st.bounce.respawn <= 0) {
            ball.x = w * (0.3 + Math.random() * 0.4)
            ball.y = floor * 0.3
            ball.vx = (Math.random() - 0.5) * 120
            ball.vy = 0
            ball.floorHits = 0
          }
          continue
        }
        stepBall(ball, dt, world, segmentsFor(kind, w, floor, side))
        if (kind === 'stick' && !ball.grabbed) {
          // a thrown stick tumbles in the air and settles flat once it lies on the floor
          if (ball.y >= floor - ball.r - 0.5) {
            const flat = Math.round(prevAngle / Math.PI) * Math.PI
            ball.angle = prevAngle + (flat - prevAngle) * Math.min(1, 12 * dt)
          } else ball.angle = prevAngle + ball.vx * 0.12 * dt
        }
        if (ball.floorHits > hitsBefore && speedBefore > 260 && kind !== 'stick') tone(cur.toySound, 150, 70, 0.09, 'sine', Math.min(0.2, speedBefore / 6000))
        if (ball.y > floor - ball.r) ball.y = floor - ball.r

        // the boot, the racket: solid, swept along the way the pointer travelled
        if (toolKind && p && ((toolKind === 'tennis' && kind === 'tennis') || (toolKind === 'football' && kind === 'football') || (toolKind === 'bounce' && kind === 'bounce'))) {
          let touched = false
          for (const spot of toolPath) {
            for (const circle of toolCircles(toolKind, spot.x, spot.y, st.toolDir, st.toolTilt)) {
              const e = toolKind === 'football' ? 0.7 : toolKind === 'bounce' ? 0.95 : 0.9
              if (bounceOffMover(ball, circle.x, circle.y, circle.r, tv.vx, tv.vy, e)) {
                touched = true
                if (toolKind === 'bounce') {
                  // a rally ball is kept alive: it always goes back up, steered by where on the racket it landed
                  if (ball.vy > -720) ball.vy = -720 - Math.min(260, Math.abs(tv.vy) * 0.2)
                  ball.vx = Math.max(-900, Math.min(900, ball.vx * 0.5 + (ball.x - circle.x) * 5 + tv.vx * 0.2))
                }
              }
            }
          }
          if (touched && hitOk(kind)) {
            if (kind === 'football') {
              startRound('football')
              tone(cur.toySound, 220, 90, 0.11, 'triangle', 0.18)
            } else if (kind === 'tennis') {
              startRound('tennis')
              point('tennis')
              tone(cur.toySound, 520, 260, 0.07, 'square', 0.08)
              st.rally += 1
              if (st.rally > st.scores.tennisBest) saveScores({ tennisBest: st.rally })
            } else {
              point('bounce')
              st.bounce.combo += 1
              tone(cur.toySound, 380 + Math.min(st.bounce.combo, 14) * 35, 260, 0.08, 'square', 0.08)
            }
          }
        }

        if (kind === 'basket') {
          const hp = hoop(w, floor, side)
          if (scoredThroughRim(prevY, ball, hp.rimY, hp.lo, hp.hi)) {
            saveScores({ basket: st.scores.basket + 1 })
            point('basket')
            st.flash = { text: 'SEPET!', left: 1.1 }
            tone(cur.toySound, 660, 660, 0.12, 'sine', 0.12)
            tone(cur.toySound, 990, 990, 0.2, 'sine', 0.12, 0.1)
          }
        } else if (kind === 'football' && st.respawn <= 0 && !ball.grabbed) {
          if (inGoal(ball, 'left', w, GOAL_DEPTH, floor, GOAL_HEIGHT) || inGoal(ball, 'right', w, GOAL_DEPTH, floor, GOAL_HEIGHT)) {
            saveScores({ football: st.scores.football + 1 })
            point('football')
            st.flash = { text: 'GOL!', left: 1.4 }
            st.respawn = 1.2
            tone(cur.toySound, 523, 523, 0.14, 'square', 0.07)
            tone(cur.toySound, 659, 659, 0.14, 'square', 0.07, 0.12)
            tone(cur.toySound, 784, 784, 0.3, 'square', 0.07, 0.24)
          }
        } else if (kind === 'tennis' && ball.floorHits >= 3 && st.rally > 0) {
          st.rally = 0
        } else if (kind === 'bounce' && st.bounce.playing && ball.floorHits > 0 && ball.y >= floor - ball.r - 1 && st.bounce.respawn <= 0) {
          dropBounce()
        }
      }
      if (st.respawn > 0) {
        st.respawn -= dt
        const ball = st.balls.football
        if (st.respawn <= 0 && ball) {
          ball.x = startPosition('football', w, floor, side)[0]
          ball.y = floor - 260
          ball.vx = 0
          ball.vy = 0
        }
      }
      for (const id of GAME_IDS) {
        const r = st.games[id].round
        if (r.active) {
          r.left -= dt
          if (r.left <= 0) {
            endRound(id)
            if (id === 'bounce') {
              st.bounce.playing = false
              st.bounce.respawn = 0
              if (st.bounce.combo > st.scores.bounceCombo) saveScores({ bounceCombo: st.bounce.combo })
              st.bounce.combo = 0
            }
          }
        }
      }
      if (st.flash) {
        st.flash.left -= dt
        if (st.flash.left <= 0) st.flash = null
      }
      if (st.result) {
        st.result.left -= dt
        if (st.result.left <= 0) st.result = null
      }

      const pet = st.pet
      if (pet) {
        const yarn = st.balls.yarn
        const stick = st.balls.stick
        const event = stepPet(pet, dt, {
          width: w, floor, pointer: st.pointer, chase: cur.toyPetChase, size: cur.toyPetSize, rand: Math.random, kind: cur.toyPetKind,
          yarn: yarn ? { x: yarn.x, rolling: Math.hypot(yarn.vx, yarn.vy) > 40 || yarn.y < floor - yarn.r - 4 } : null,
          stick: stick ? { x: stick.x, free: st.stickThrown && !stick.grabbed && !st.carried } : null,
          home: st.throwFrom || w / 2,
        })
        const size = cur.toyPetSize
        if (event === 'swat' && yarn) {
          yarn.vx += pet.dir * (260 + Math.random() * 200)
          yarn.vy = -(240 + Math.random() * 220)
          tone(cur.toySound, 700, 420, 0.07, 'triangle', 0.08)
        } else if (event === 'pickup') {
          st.carried = true
          st.stickThrown = false
          if (stick) {
            stick.vx = 0
            stick.vy = 0
          }
          tone(cur.toySound, 300, 450, 0.1, 'triangle', 0.1)
        } else if (event === 'drop') {
          st.carried = false
          if (stick) {
            stick.vx = pet.dir * 40
            stick.vy = -120
          }
          tone(cur.toySound, 480, 340, 0.12, 'triangle', 0.1)
        }
        if (st.carried && stick) {
          // the stick rides in the dog's mouth
          stick.x = pet.x + pet.dir * size * 0.55
          stick.y = pet.y - size * 0.5
          stick.vx = 0
          stick.vy = 0
          stick.angle = pet.dir > 0 ? 0.2 : -0.2
        }
        // the walking cycle moves on with the ground the pet really covers, so the feet never slide
        const moved = Math.abs(pet.x - st.lastPetX)
        st.lastPetX = pet.x
        if (pet.state === 'walk' || pet.state === 'run' || pet.state === 'carry') {
          const cycle = size * (pet.state === 'walk' ? 0.62 : 0.85)
          st.gait += moved / cycle
        }
      }

      const cv = canvas.current
      if (cv) {
        const dpr = window.devicePixelRatio || 1
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
          cv.width = Math.round(w * dpr)
          cv.height = Math.round(h * dpr)
        }
        const c = cv.getContext('2d')!
        c.setTransform(dpr, 0, 0, dpr, 0, 0)
        c.clearRect(0, 0, w, h)
        drawScene(c, cur, st, w, floor)
        if (pet) {
          const size = cur.toyPetSize
          drawPet(c, pet.x, pet.y, size, pet.dir, { kind: cur.toyPetKind, state: pet.state, time: st.clock, gait: st.gait })
          if (st.carried && st.balls.stick) drawBall(c, st.balls.stick, 'stick', floor)
          drawPetExtras(c, pet.x, pet.y, size, pet.state, st.clock, cur.toyPetName || 'Dostum', st.hover || pet.state === 'happy' || pet.state === 'held')
        }
        if (p) {
          const dragged = st.drag && st.drag.kind === 'ball' ? st.balls[st.drag.ball] : null
          if (dragged) {
            if (st.drag && st.drag.kind === 'ball' && st.drag.ball === 'basket') drawGrip(c, dragged)
            else drawFist(c, p.x, p.y)
          } else if (st.armed === 'basket') drawReach(c, p.x, p.y)
          else if (toolKind === 'football') drawBoot(c, p.x, p.y, st.toolDir, st.toolTilt)
          else if (toolKind === 'tennis') drawRacket(c, p.x, p.y, st.toolDir, -(RACKET_REST - st.toolTilt))
          else if (toolKind === 'bounce') {
            // the racket is held upright with its face up; it leans a little into the sideways swing
            const lean = Math.max(-0.35, Math.min(0.35, st.toolVx / 3500))
            const gx = p.x - Math.sin(lean) * RACKET_REACH
            const gy = p.y + Math.cos(lean) * RACKET_REACH
            drawRacket(c, gx, gy, 1, -Math.PI / 2 + lean)
          }
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(hudTimer)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('contextmenu', onContext)
    }
  }, [])

  return (
    <div className="toys" ref={root}>
      <canvas ref={canvas} className="toys__canvas" />
      <Hud cards={hud.cards} result={hud.result} />
    </div>
  )
}
