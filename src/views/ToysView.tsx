import { useEffect, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import type { DockSettings, ToyMode, ToyScores } from '@/shared/types'
import { DEFAULT_TOY_SCORES } from '@/shared/types'
import { PEN_MAX_PULL, Pen, geo as penGeo, randomSpot, glovePoint, keeperPoint, launch, makePen, path as penPath, shoot as penShoot, step as penStep } from '@/toys/penalty'
import { SHOT_MAX_PULL, Shot, launchShot, makeShot, pickSpot, shotPath } from '@/toys/shot'
import { dial, gaugeSpot, powerGauge } from '@/toys/gauges'
import { Bowling } from '@/toys/bowling'
import { Dart } from '@/toys/dart'
import { Env, MiniGame, inside } from '@/toys/mini'
import { Pong } from '@/toys/pong'
import { goalBoxes, goalPosts, inWhichGoal, slide } from '@/toys/pitch'
import { Ball, Segment, World, bounceOffMover, makeBall, scoredThroughRim, stepBall, throwVelocity } from '@/toys/ball'
import handUrl from '@/assets/toys/hand.png'
import fistUrl from '@/assets/toys/fist.png'
import reachUrl from '@/assets/toys/reach.png'
import grabUrl from '@/assets/toys/grab.png'
import bootUrl from '@/assets/toys/boot.png'
import racketUrl from '@/assets/toys/racket.png'
import basketballUrl from '@/assets/toys/basketball.png'
import soccerUrl from '@/assets/toys/soccer.png'

type GameId = 'basket' | 'football' | 'bounce'
type BallKind = GameId
/** The small panel games: Pong, bowling and darts. */
type MiniId = 'pong' | 'bowling' | 'dart'
const MINI_IDS: MiniId[] = ['pong', 'bowling', 'dart']
const MINI_INFO: Record<MiniId, { title: string; best: keyof ToyScores }> = {
  pong: { title: 'Pong', best: 'pongBest' },
  bowling: { title: 'Bowling', best: 'bowlingBest' },
  dart: { title: 'Dart', best: 'dartBest' },
}
const miniOn = (s: DockSettings, id: MiniId) => (id === 'pong' ? s.toyPong : id === 'bowling' ? s.toyBowling : s.toyDart)
const miniKey = (id: MiniId) => (id === 'pong' ? 'toyPong' : id === 'bowling' ? 'toyBowling' : 'toyDart')
type Round = { active: boolean; left: number; score: number }

const ALL: BallKind[] = ['basket', 'football', 'bounce']
const GAME_IDS: GameId[] = ['basket', 'football', 'bounce']
const ROUND_SECONDS = 60

const GAME_INFO: Record<GameId, { title: string; unit: string }> = {
  basket: { title: 'Basketbol', unit: 'sayı' },
  football: { title: 'Futbol', unit: 'gol' },
  bounce: { title: 'Top sektirme', unit: 'vuruş' },
}
const BEST_KEY: Record<GameId, keyof ToyScores> = { basket: 'basketBest', football: 'footballBest', bounce: 'bounceBest' }

/** Football set to keep-it-up: the football takes the part of the rally ball and the boot that of the racket. */
const jugglingOf = (s: DockSettings) => s.toyFootball && s.toyFootballStyle === 'juggle'
/** The record each game keeps for a timed round (juggling has its own, apart from the goals). */
const bestKeyOf = (s: DockSettings, id: GameId): keyof ToyScores => (id === 'football' && jugglingOf(s) ? 'juggleBest' : BEST_KEY[id])
const unitOf = (s: DockSettings, id: GameId) => (id === 'football' && jugglingOf(s) ? 'vuruş' : GAME_INFO[id].unit)

const modeOf = (s: DockSettings, id: GameId): ToyMode => (id === 'basket' ? s.toyBasketMode : id === 'football' ? s.toyFootballMode : s.toyBounceMode)
const enabledOf = (s: DockSettings, id: GameId): boolean => (id === 'basket' ? s.toyBasket : id === 'football' ? s.toyFootball : s.toyBounce)

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
  id: GameId | MiniId
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
  pointer: { x: number; y: number; vx: number; vy: number; t: number } | null
  samples: [number, number, number][]
  drag: { kind: 'ball'; ball: BallKind; dx: number; dy: number } | null
  capture: boolean
  scores: ToyScores
  games: Record<GameId, { round: Round; session: number }>
  /** The result card shown for a few seconds after a timed round. */
  result: (HudResult & { left: number }) | null
  /** Text flashed in the middle of the screen: BASKET!, GOL! … */
  flash: { text: string; left: number } | null
  /** A scored football is put back when this runs out. */
  respawn: number
  hover: boolean
  /** Size of the window the toys were last placed for. */
  size: string
  /** The hand, boot or racket the pointer has turned into near a ball. */
  armed: 'basket' | 'football' | null
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
  /** Where the basketball was let go from (x), for the three-point line. */
  shotFrom: number
  /** The penalty game of the football toy, and whether its ball has been put on the spot. */
  pen: Pen
  penOn: boolean
  penKey: string
  /** The basketball's far-hoop mode: the aim in progress, and whether the mode was already set up. */
  shot: Shot
  farOn: boolean
  /** What the pitch was last set up for: its shape and the size of the window. */
  pitchKey: string
  /** The panel games, and whether the left button went down inside one of them. */
  mini: Partial<Record<MiniId, MiniGame>>
  miniDown: boolean
  miniWas: Record<MiniId, boolean>
  /** Racket and tennis ball: a rally is on, the pointer is the racket, and hits in a row are counted. */
  bounce: { playing: boolean; combo: number; respawn: number }
  cursor: string
}

const SPEC: Record<BallKind, { r: number; gravity: number; restitution: number; rolling: number }> = {
  basket: { r: 24, gravity: 2000, restitution: 0.72, rolling: 1.2 },
  football: { r: 28, gravity: 1900, restitution: 0.62, rolling: 0.9 },
  bounce: { r: 15, gravity: 1900, restitution: 0.8, rolling: 1 },
}
const TAU = Math.PI * 2
/** How close the pointer has to come before it turns into a hand, a boot or a racket. */
const AURA: Record<'basket' | 'football', number> = { basket: 70, football: 90 }
/** Distance from the racket's grip to the middle of its head. */
const RACKET_REACH = 96

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
  return []
}

function startPosition(kind: BallKind, width: number, floor: number, side: 'left' | 'right'): [number, number] {
  const r = SPEC[kind].r
  switch (kind) {
    case 'basket': return [side === 'right' ? width - 280 : 280, floor - r]
    case 'football': return [width * 0.62, floor - r]
    default: return [width * 0.46, floor - r]
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
function toolCircles(kind: 'football' | 'bounce', x: number, y: number, dir: number, tilt: number, flat = false): Circle[] {
  if (kind === 'football' && flat) return [{ x, y, r: 26 }] // seen from above the boot is a single disc
  if (kind === 'bounce') {
    // a flat racket head: three overlapping discs along its face, tilted a little with the swing
    const c = Math.cos(tilt), s = Math.sin(tilt)
    return [-30, 0, 30].map((o) => ({ x: x + o * c, y: y + o * s, r: 15 }))
  }
  // a boot: toe, instep and heel, lifting a little as the leg swings up
  const lift = -tilt * 26
  return [
    { x: x - dir * 14, y: y - 6 + lift * 0.4, r: 17 },
    { x: x - dir * 52, y: y - 14 + lift * 0.8, r: 20 },
    { x: x - dir * 98, y: y - 22 + lift, r: 22 },
  ]
}

// ---- drawing ----

function drawBall(c: CanvasRenderingContext2D, b: Ball, kind: BallKind, floor: number, flat = false) {
  const height = Math.max(0, floor - (b.y + b.r))
  const shade = Math.max(0.08, 0.32 - height / 900)
  c.fillStyle = `rgba(0,0,0,${shade})`
  c.beginPath()
  if (flat) c.ellipse(b.x + 3, b.y + 5, b.r, b.r * 0.9, 0, 0, TAU) // seen from above the shadow sits right under the ball
  else c.ellipse(b.x, floor - 2, b.r * Math.max(0.35, 1 - height / 700), b.r * 0.22, 0, 0, TAU)
  c.fill()
  c.save()
  c.translate(b.x, b.y)
  c.rotate(b.angle)
  if ((kind === 'basket' || kind === 'football') && ready(PICS[kind])) {
    const d = b.r * 2.12
    c.drawImage(PICS[kind], -d / 2, -d / 2, d, d)
    c.restore()
    return
  }
  const g = c.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r)
  if (kind === 'basket') { g.addColorStop(0, '#ffb066'); g.addColorStop(1, '#c9591b') }
  else if (kind === 'football') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd3da') }
  else { g.addColorStop(0, '#f2ff7a'); g.addColorStop(1, '#a9c91d') }
  c.fillStyle = g
  c.beginPath()
  c.arc(0, 0, b.r, 0, TAU)
  c.fill()
  c.lineCap = 'round'
  if (kind === 'bounce') {
    // a tennis ball: the two white seams
    c.strokeStyle = 'rgba(255,255,255,0.92)'
    c.lineWidth = Math.max(1.4, b.r * 0.13)
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

/** The goalkeeper seen from above: shoulders, head towards the pitch, big gloves at the ends of his arms. */
function drawKeeper(c: CanvasRenderingContext2D, x: number, y: number, horizontal: boolean, facing: 1 | -1) {
  c.save()
  c.translate(x, y)
  if (horizontal) c.rotate(Math.PI / 2) // the line he moves along is then vertical
  shadowed(c)
  const f = horizontal ? -facing : -facing
  c.fillStyle = '#ffc83d'
  c.beginPath()
  c.ellipse(0, 0, 25, 12, 0, 0, TAU)
  c.fill()
  c.fillStyle = 'rgba(0,0,0,0.14)'
  c.fillRect(-25, -2, 50, 3)
  c.fillStyle = '#34c759'
  for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 33, f * 3, 9, 0, TAU); c.fill() }
  c.fillStyle = '#f2c9a0'
  c.beginPath()
  c.arc(0, f * 2, 9, 0, TAU)
  c.fill()
  c.fillStyle = '#3a2a1c'
  c.beginPath()
  c.arc(0, f * -1, 9, 0, TAU)
  c.fill()
  c.restore()
}

/** Everything the penalty game draws besides the ball: pitch, keeper, your glove, the pull, the power, the curl. */
function drawPenalty(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  const pen = sim.pen
  const horizontal = s.toyPitch === 'horizontal'
  const g = penGeo(width, floor, s.toyPitch)
  drawPitch(c, s, width, floor)
  // the penalty spot
  c.fillStyle = 'rgba(255,255,255,0.85)'
  c.beginPath()
  c.arc(pen.spot.x || g.spot.x, pen.spot.y || g.spot.y, 4, 0, TAU)
  c.fill()
  const [kx, ky] = keeperPoint(g, pen)
  drawKeeper(c, kx, ky, horizontal, g.sign)
  // your own goal, defended with the pointer, when the keeper shoots back
  if (s.toyKeeperShoots) {
    const [gx, gy] = glovePoint(g, pen)
    c.save()
    shadowed(c)
    c.fillStyle = '#34c759'
    c.strokeStyle = 'rgba(0,0,0,0.35)'
    c.lineWidth = 2
    c.beginPath()
    if (horizontal) c.roundRect(gx - 10, gy - 40, 20, 80, 10)
    else c.roundRect(gx - 40, gy - 10, 80, 20, 10)
    c.fill()
    c.stroke()
    c.restore()
    if (pen.back && ready(PICS.football)) c.drawImage(PICS.football, pen.back.x - 15, pen.back.y - 15, 30, 30)
  }
  // the pull
  const ball = sim.balls.football
  if (ball && pen.aim) {
    const l = launch(pen.aim)
    const len = Math.min(Math.hypot(pen.aim.x, pen.aim.y), PEN_MAX_PULL)
    const ang = Math.atan2(pen.aim.y, pen.aim.x)
    c.strokeStyle = 'rgba(255,255,255,0.55)'
    c.lineWidth = 3
    c.setLineDash([2, 7])
    c.beginPath()
    c.moveTo(ball.x, ball.y)
    c.lineTo(ball.x + Math.cos(ang) * len, ball.y + Math.sin(ang) * len)
    c.stroke()
    c.setLineDash([])
    // where it would go
    if (l.power > 0.04) {
      c.fillStyle = 'rgba(255,255,255,0.75)'
      for (const [px, py] of penPath(ball.x, ball.y, l.vx, l.vy, pen.spin)) {
        c.beginPath()
        c.arc(px, py, 2.6, 0, TAU)
        c.fill()
      }
    }
    const spot = gaugeSpot(ball.x, ball.y, floor)
    powerGauge(c, spot.px, spot.py, l.power)
    dial(c, spot.dx, spot.dy, pen.spin, 'FALSO · tekerlek')
  } else if (ball && pen.phase === 'ready') {
    c.fillStyle = 'rgba(255,255,255,0.9)'
    c.font = "600 12px 'Segoe UI', system-ui, sans-serif"
    c.textAlign = 'center'
    c.fillText('Topu geri çek ve bırak', ball.x, ball.y - ball.r - 14)
  }
}

/** The three-point line, the pull and the two bars (power, height) of the far-hoop mode. */
function drawShotAid(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  const h = hoop(width, floor, s.toyHoopSide)
  const lineX = h.near + (s.toyHoopSide === 'right' ? -1 : 1) * width * 0.45
  c.strokeStyle = 'rgba(255,255,255,0.55)'
  c.lineWidth = 2
  c.setLineDash([6, 8])
  c.beginPath()
  c.moveTo(lineX, floor - 90)
  c.lineTo(lineX, floor)
  c.stroke()
  c.setLineDash([])
  c.fillStyle = 'rgba(255,255,255,0.8)'
  c.font = "700 12px 'Segoe UI', system-ui, sans-serif"
  c.textAlign = 'center'
  c.fillText('3 SAYI ÇİZGİSİ', lineX, floor - 96)
  const ball = sim.balls.basket
  const shot = sim.shot
  if (!ball) return
  if (shot.aim) {
    const l = launchShot(shot.aim, width)
    const len = Math.min(Math.hypot(shot.aim.x, shot.aim.y), SHOT_MAX_PULL)
    const ang = Math.atan2(shot.aim.y, shot.aim.x)
    c.strokeStyle = 'rgba(255,255,255,0.6)'
    c.lineWidth = 3
    c.setLineDash([2, 7])
    c.beginPath()
    c.moveTo(ball.x, ball.y)
    c.lineTo(ball.x + Math.cos(ang) * len, ball.y + Math.sin(ang) * len)
    c.stroke()
    c.setLineDash([])
    if (s.toyShotLine && l.power > 0.04) {
      c.fillStyle = 'rgba(255,255,255,0.8)'
      for (const [px, py] of shotPath(ball.x, ball.y, l.vx, l.vy, SPEC.basket.gravity, floor, ball.r)) {
        c.beginPath()
        c.arc(px, py, 2.6, 0, TAU)
        c.fill()
      }
    }
    const spot = gaugeSpot(ball.x, ball.y, floor)
    powerGauge(c, spot.px, spot.py, l.power)
    dial(c, spot.dx, spot.dy, l.height, 'YÜKSEKLİK', 'height')
  } else if (shot.state === 'ready') {
    c.fillStyle = 'rgba(255,255,255,0.9)'
    c.font = "600 12px 'Segoe UI', system-ui, sans-serif"
    c.textAlign = 'center'
    c.fillText('Topu geri çek ve bırak', ball.x, ball.y - ball.r - 14)
  }
}

/** The pitch from above: grass, lines, and both goals in full. */
function drawPitch(c: CanvasRenderingContext2D, s: DockSettings, width: number, floor: number) {
  const o = s.toyPitch
  c.save()
  const grass = Math.max(0, Math.min(1, s.toyPitchAlpha))
  c.fillStyle = `rgba(30, 120, 62, ${grass})`
  c.fillRect(0, 0, width, floor)
  c.fillStyle = `rgba(255,255,255,${0.04 * (grass / 0.3)})`
  const stripe = o === 'horizontal' ? width / 12 : floor / 10
  for (let i = 0; i < 12; i += 2) {
    if (o === 'horizontal') c.fillRect(i * stripe, 0, stripe, floor)
    else c.fillRect(0, i * stripe, width, stripe)
  }
  c.strokeStyle = 'rgba(255,255,255,0.55)'
  c.lineWidth = 3
  c.strokeRect(6, 6, width - 12, floor - 12)
  c.beginPath()
  if (o === 'horizontal') { c.moveTo(width / 2, 6); c.lineTo(width / 2, floor - 6) } else { c.moveTo(6, floor / 2); c.lineTo(width - 6, floor / 2) }
  c.stroke()
  c.beginPath()
  c.arc(width / 2, floor / 2, 70, 0, TAU)
  c.stroke()
  // the boxes in front of the goals
  const [a, b] = goalBoxes(width, floor, o)
  c.lineWidth = 2
  c.strokeStyle = 'rgba(255,255,255,0.4)'
  for (const g of [a, b]) {
    if (o === 'horizontal') c.strokeRect(g === a ? 6 : width - 6 - 190, g.y - 60, 190, g.h + 120)
    else c.strokeRect(g.x - 60, g === a ? 6 : floor - 6 - 190, g.w + 120, 190)
  }
  // the goals, drawn whole: net, three sides, the mouth open towards the pitch
  for (const g of [a, b]) {
    c.fillStyle = 'rgba(255,255,255,0.14)'
    c.fillRect(g.x, g.y, g.w, g.h)
    c.strokeStyle = 'rgba(255,255,255,0.4)'
    c.lineWidth = 1
    c.beginPath()
    for (let i = 1; i < 9; i++) {
      c.moveTo(g.x, g.y + (g.h / 9) * i); c.lineTo(g.x + g.w, g.y + (g.h / 9) * i)
      c.moveTo(g.x + (g.w / 9) * i, g.y); c.lineTo(g.x + (g.w / 9) * i, g.y + g.h)
    }
    c.stroke()
    c.strokeStyle = '#ffffff'
    c.lineWidth = 6
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    if (o === 'horizontal') {
      if (g === a) { c.moveTo(g.x + g.w, g.y); c.lineTo(g.x, g.y); c.lineTo(g.x, g.y + g.h); c.lineTo(g.x + g.w, g.y + g.h) }
      else { c.moveTo(g.x, g.y); c.lineTo(g.x + g.w, g.y); c.lineTo(g.x + g.w, g.y + g.h); c.lineTo(g.x, g.y + g.h) }
    } else if (g === a) { c.moveTo(g.x, g.y + g.h); c.lineTo(g.x, g.y); c.lineTo(g.x + g.w, g.y); c.lineTo(g.x + g.w, g.y + g.h) }
    else { c.moveTo(g.x, g.y); c.lineTo(g.x, g.y + g.h); c.lineTo(g.x + g.w, g.y + g.h); c.lineTo(g.x + g.w, g.y) }
    c.stroke()
  }
  c.restore()
}

/** The boot seen from above: pointing the way the pointer is moving. */
function drawBootTop(c: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, angle: number) {
  if (!ready(PICS.boot)) return
  c.save()
  c.translate(x, y)
  shadowed(c)
  c.rotate(angle)
  c.drawImage(PICS.boot, -128, -37, 140, 84 * 0.9)
  c.restore()
  void vx
  void vy
}

function drawScene(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  if (s.toyBasket && s.toyBasketStyle === 'far') drawShotAid(c, s, sim, width, floor)
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
  if (s.toyFootball && s.toyFootballStyle === 'penalty') drawPenalty(c, s, sim, width, floor)
  else if (s.toyFootball && s.toyFootballStyle === 'free') drawPitch(c, s, width, floor)
  for (const id of MINI_IDS) if (miniOn(s, id)) sim.mini[id]?.draw(c, width, floor, floor, sim.pointer ? { x: sim.pointer.x, y: sim.pointer.y } : null)
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
    if (ball) drawBall(c, ball, kind, floor, kind === 'football' && s.toyFootball && s.toyFootballStyle === 'free')
  }
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function GameIcon({ id }: { id: GameId | MiniId }) {
  if (id === 'pong') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="9" width="4" height="14" rx="2" fill="#5aa2ff" /><rect x="25" y="12" width="4" height="14" rx="2" fill="#ff6a8a" /><circle cx="17" cy="15" r="3" fill="#fff" /></svg>
  if (id === 'bowling') return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="21" r="8" fill="#2b3a99" /><circle cx="9" cy="19" r="1.2" fill="#0a0f33" /><circle cx="12" cy="19" r="1.2" fill="#0a0f33" /><rect x="21" y="6" width="6" height="16" rx="3" fill="#fff" stroke="#d63a3a" strokeWidth="2" /></svg>
  if (id === 'dart') return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#15181f" /><circle cx="16" cy="16" r="9" fill="#efe3c2" /><circle cx="16" cy="16" r="5" fill="#c8312f" /><circle cx="16" cy="16" r="1.8" fill="#1f8a4b" /></svg>
  if (id === 'basket') return <img src={basketballUrl} alt="" />
  if (id === 'football') return <img src={soccerUrl} alt="" />
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#cfe84a" stroke="#8fa61a" strokeWidth="1" />
      <path d="M5 10 Q 14 16 5 22 M27 10 Q 18 16 27 22" fill="none" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
  )
}

/** The scoreboard: one card per game that is on, and the result card after a timed round. */
function Hud({ cards, result, showCursor, corner }: { cards: HudCard[]; result: HudResult | null; showCursor: boolean; corner: boolean }) {
  return (
    <>
      <div className={corner ? "hud hud--corner" : "hud"}>
        {cards.map((card) => (
          <div key={card.id} className={`hud-card${card.timed && card.active && card.left <= 10 ? ' hud-card--urgent' : ''}`} data-active={card.active}>
            <div className="hud-card__head">
              <span className="hud-card__icon"><GameIcon id={card.id} /></span>
              <b>{card.title}</b>
              <span className="hud-chip">{card.timed ? 'Süreye karşı' : 'Serbest'}</span>
              <button className="hud-card__cursor" data-game={card.id} aria-label="İmleci göster ya da gizle" title="İmleci göster / gizle">{showCursor ? '🖱' : '◌'}</button>
              <button className="hud-card__close" data-game={card.id} aria-label="Oyunu kapat" title="Oyunu kapat">✕</button>
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
    balls: {}, pointer: null, samples: [], drag: null, capture: false, scores: { ...DEFAULT_TOY_SCORES }, shotFrom: 0, pen: makePen(), penOn: false, penKey: '', shot: makeShot(), farOn: false, pitchKey: '', mini: {}, miniDown: false, miniWas: { pong: false, bowling: false, dart: false },
    games: { basket: newGame(), football: newGame(), bounce: newGame() },
    result: null, flash: null, respawn: 0, hover: false, size: '', armed: null, toolDir: 1, toolTilt: 0, toolPos: null, toolVx: 0, toolVy: 0, struck: {},
    bounce: { playing: false, combo: 0, respawn: 0 }, cursor: '',
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
    /** A panel game is over: its record is kept and the result card shown. */
    const finishMini = (id: MiniId, score: number) => {
      const key = MINI_INFO[id].best
      const best = st.scores[key]
      const wins = id === 'pong'
      const record = !wins && score > best
      if (record) saveScores({ [key]: score })
      st.result = { game: MINI_INFO[id].title, title: wins ? 'Kazandın!' : record ? 'Yeni rekor!' : 'Oyun bitti', score, unit: wins ? 'sayı' : id === 'bowling' ? 'lobut' : 'puan', best: wins ? st.scores.pongBest + 1 : record ? score : best, record, left: 4.5 }
      const sound = settingsRef.current.toySound
      if (record || wins) [523, 659, 784, 1047].forEach((f, i) => tone(sound, f, f, 0.2, 'triangle', 0.1, i * 0.12))
    }
    const envFor = (id: MiniId): Env => ({
      flash: (text, seconds = 1.2) => { st.flash = { text, left: seconds } },
      tone: (from, to, seconds, type = 'sine', volume = 0.1, delay = 0) => tone(settingsRef.current.toySound, from, to, seconds, type, volume, delay),
      finish: (score) => finishMini(id, score),
      win: () => saveScores({ pongBest: st.scores.pongBest + 1 }),
    })
    st.mini = { pong: new Pong(envFor('pong')), bowling: new Bowling(envFor('bowling')), dart: new Dart(envFor('dart')) }
    /** The panel game whose panel the point is over (only games that are on). */
    const miniAt = (x: number, y: number): MiniId | null => {
      const { w, h } = dims()
      for (const id of MINI_IDS) {
        const m = st.mini[id]
        if (m && miniOn(settingsRef.current, id) && inside(m.area(w, h, floorOf(settingsRef.current, h)), x, y)) return id
      }
      return null
    }
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
      const key = bestKeyOf(settingsRef.current, id)
      const best = st.scores[key]
      const record = g.round.score > best
      if (record) saveScores({ [key]: g.round.score })
      st.result = { game: GAME_INFO[id].title, title: record ? 'Yeni rekor!' : 'Süre doldu', score: g.round.score, unit: unitOf(settingsRef.current, id), best: record ? g.round.score : best, record, left: 4.5 }
      const sound = settingsRef.current.toySound
      if (record) [523, 659, 784, 1047].forEach((f, i) => tone(sound, f, f, 0.2, 'triangle', 0.1, i * 0.12))
      else tone(sound, 400, 200, 0.4, 'triangle', 0.1)
    }
    /** What can be picked up or started at a point: the basketball or the baseball. */
    const juggling = () => jugglingOf(settingsRef.current)
    const isRally = (kind: BallKind) => kind === 'bounce' || (kind === 'football' && juggling())
    const rallyId = (): GameId => (juggling() ? 'football' : 'bounce')
    const comboKey = (): keyof ToyScores => (juggling() ? 'juggleCombo' : 'bounceCombo')
    const grabAt = (x: number, y: number): { kind: 'ball'; ball: BallKind } | null => {
      for (const kind of ['bounce', 'football', 'basket'] as BallKind[]) {
        if (kind === 'football' && !juggling()) continue
        if (kind === 'basket' && farOn()) continue
        const b = st.balls[kind]
        if (b && Math.hypot(b.x - x, b.y - y) <= b.r + 8) return { kind: 'ball', ball: kind }
      }
      return null
    }
    /** Is the pointer close enough to a ball to turn into a hand, a boot or a racket? */
    const penaltyOn = () => settingsRef.current.toyFootball && settingsRef.current.toyFootballStyle === 'penalty'
    const farOn = () => settingsRef.current.toyBasket && settingsRef.current.toyBasketStyle === 'far'
    const armedFor = (x: number, y: number): 'basket' | 'football' | null => {
      for (const kind of penaltyOn() || juggling() ? (farOn() ? ([] as const) : (['basket'] as const)) : farOn() ? (['football'] as const) : (['football', 'basket'] as const)) {
        const b = st.balls[kind]
        if (b && !b.grabbed && Math.hypot(b.x - x, b.y - y) <= b.r + AURA[kind]) return kind
      }
      return null
    }
    /** Decides what the pointer is and whether the window takes the mouse. */
    /** The game whose close button (✕ on its scoreboard card) is under the pointer. */
    const closeAt = (x: number, y: number): { act: 'close' | 'cursor'; game: GameId | MiniId } | null => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.hud-card__close, .hud-card__cursor'))) {
        const r = el.getBoundingClientRect()
        if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) return { act: el.classList.contains('hud-card__cursor') ? 'cursor' : 'close', game: el.dataset.game as GameId | MiniId }
      }
      return null
    }
    const refresh = (x: number, y: number) => {
      const playing = st.bounce.playing
      st.armed = playing || st.drag ? null : armedFor(x, y)
      const over = playing || st.drag ? null : grabAt(x, y)
      const close = st.drag ? null : closeAt(x, y)
      const pb = st.balls.football
      const penHover = penaltyOn() && st.pen.phase === 'ready' && !!pb && Math.hypot(pb.x - x, pb.y - y) <= pb.r + 18
      const penBusy = penaltyOn() && (!!st.pen.aim || st.pen.phase === 'return')
      const sb = st.balls.basket
      const farHover = farOn() && st.shot.state === 'ready' && !!sb && Math.hypot(sb.x - x, sb.y - y) <= sb.r + 18
      const farBusy = farOn() && !!st.shot.aim
      const mini = miniAt(x, y)
      setCapture(!!over || !!st.armed || !!st.drag || playing || !!close || penHover || penBusy || farHover || farBusy || !!mini || st.miniDown)
      setCursor(close ? 'pointer' : mini || st.miniDown ? (mini === 'bowling' || settingsRef.current.toyShowCursor ? '' : 'none') : penBusy || farBusy ? (settingsRef.current.toyShowCursor ? '' : 'none') : penHover || farHover ? 'grab' : st.drag || st.armed || playing ? (settingsRef.current.toyShowCursor ? '' : 'none') : over ? 'grab' : '')
    }
    /** A rally of the racket and the baseball has ended: the ball touched the floor. */
    const dropBounce = () => {
      const b = st.bounce
      if (b.combo > st.scores[comboKey()]) saveScores({ [comboKey()]: b.combo })
      b.combo = 0
      const timed = st.games[rallyId()].round.active
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
      if (st.shot.aim && st.balls.basket) {
        st.shot.aim = { x: e.clientX - st.balls.basket.x, y: e.clientY - st.balls.basket.y }
        return
      }
      if (st.pen.aim && st.balls.football) {
        st.pen.aim = { x: e.clientX - st.balls.football.x, y: e.clientY - st.balls.football.y }
        return
      }
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
        }
        return
      }
      refresh(e.clientX, e.clientY)
    }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const closing = closeAt(e.clientX, e.clientY)
      if (closing) {
        if (closing.act === 'cursor') invoke('settings:update', { toyShowCursor: !settingsRef.current.toyShowCursor })
        else invoke('settings:update', { [closing.game === 'basket' ? 'toyBasket' : closing.game === 'football' ? 'toyFootball' : closing.game === 'bounce' ? 'toyBounce' : miniKey(closing.game)]: false })
        return
      }
      const mid = miniAt(e.clientX, e.clientY)
      if (mid) {
        st.miniDown = true
        st.mini[mid]!.down(e.clientX, e.clientY)
        setCapture(true)
        return
      }
      const bk = st.balls.basket
      if (farOn() && st.shot.state === 'ready' && bk && Math.hypot(bk.x - e.clientX, bk.y - e.clientY) <= bk.r + 18) {
        st.shot.aim = { x: e.clientX - bk.x, y: e.clientY - bk.y }
        setCapture(true)
        return
      }
      const fb = st.balls.football
      if (penaltyOn() && st.pen.phase === 'ready' && fb && Math.hypot(fb.x - e.clientX, fb.y - e.clientY) <= fb.r + 18) {
        st.pen.aim = { x: e.clientX - fb.x, y: e.clientY - fb.y }
        setCapture(true)
        return
      }
      const over = st.bounce.playing ? null : grabAt(e.clientX, e.clientY)
      if (!over) return
      st.samples = [[e.clientX, e.clientY, performance.now()]]
      st.armed = null
      if (over.kind === 'ball' && isRally(over.ball)) {
        // serve: the ball is thrown up and the pointer becomes the racket (or the boot)
        const ball = st.balls[over.ball]!
        ball.vx = (Math.random() - 0.5) * 160
        ball.vy = -1150
        ball.floorHits = 0
        st.bounce = { playing: true, combo: 0, respawn: 0 }
        startRound(over.ball as GameId)
        tone(settingsRef.current.toySound, 220, 520, 0.14, 'triangle', 0.1)
        refresh(e.clientX, e.clientY)
        return
      }
      setCursor(settingsRef.current.toyShowCursor ? '' : 'none')
      if (over.kind === 'ball') {
        const ball = st.balls[over.ball]!
        ball.grabbed = true
        ball.vx = 0
        ball.vy = 0
        ball.floorHits = 0
        if (over.ball === 'basket') startRound('basket')
        st.drag = { kind: 'ball', ball: over.ball, dx: ball.x - e.clientX, dy: ball.y - e.clientY }
      }
    }
    const onUp = (e?: MouseEvent) => {
      if (st.miniDown) {
        st.miniDown = false
        for (const id of MINI_IDS) if (miniOn(settingsRef.current, id)) st.mini[id]?.up(e?.clientX ?? 0, e?.clientY ?? 0)
        const q = st.pointer
        if (q) refresh(q.x, q.y)
        return
      }
      if (st.shot.aim) {
        const bk = st.balls.basket
        const l = launchShot(st.shot.aim, window.innerWidth)
        st.shot.aim = null
        if (bk && l.power > 0.06) {
          startRound('basket')
          bk.vx = l.vx
          bk.vy = l.vy
          bk.floorHits = 0
          bk.touches = 0
          st.shotFrom = bk.x
          st.shot = { ...st.shot, state: 'flight', t: 0, scored: false, end: 0 }
          tone(settingsRef.current.toySound, 260, 520, 0.12, 'triangle', 0.1)
        }
        const q = st.pointer
        if (q) refresh(q.x, q.y)
        return
      }
      if (st.pen.aim) {
        const fb = st.balls.football
        const l = launch(st.pen.aim)
        st.pen.aim = null
        if (fb && l.power > 0.06) {
          startRound('football')
          penShoot(st.pen, fb, window.innerWidth, floorOf(settingsRef.current, window.innerHeight), settingsRef.current.toyPitch, l.vx, l.vy)
          tone(settingsRef.current.toySound, 220, 90, 0.11, 'triangle', 0.18)
        }
        const q = st.pointer
        if (q) refresh(q.x, q.y)
        return
      }
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
        }
      }
      const p = st.pointer
      if (p) refresh(p.x, p.y)
    }
    /** A right click puts the racket down and ends the rally (and a timed round) at once. */
    const onContext = (e: MouseEvent) => {
      if (!st.bounce.playing) return
      e.preventDefault()
      const b = st.bounce
      if (b.combo > st.scores[comboKey()]) saveScores({ [comboKey()]: b.combo })
      b.playing = false
      b.combo = 0
      if (st.games[rallyId()].round.active) endRound(rallyId())
      const p = st.pointer
      if (p) refresh(p.x, p.y)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('contextmenu', onContext)
    const onWheel = (e: WheelEvent) => {
      const mid = st.pointer ? miniAt(st.pointer.x, st.pointer.y) : null
      if (mid) st.mini[mid]?.wheel(e.deltaY)
      if (!penaltyOn() || !(st.pen.aim || st.pen.phase === 'ready')) return
      st.pen.spin = Math.max(-1, Math.min(1, Math.round((st.pen.spin + (e.deltaY < 0 ? 0.2 : -0.2)) * 10) / 10))
    }
    window.addEventListener('wheel', onWheel, { passive: true })

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
        if (timed) best = `Rekor ${sc[bestKeyOf(cur, id)]}`
        else if (id === 'basket') best = `Toplam ${sc.basket} sayı`
        else if (id === 'football' && jugglingOf(cur)) best = `Seri ${st.bounce.combo}  ·  Rekor ${sc.juggleCombo}`
        else if (id === 'football') best = cur.toyFootballStyle === 'penalty' ? `Gol ${st.pen.goals}  ·  Kurtarılan ${st.pen.saves}${cur.toyKeeperShoots ? `  ·  Yenilen ${st.pen.conceded}` : ''}` : `Toplam ${sc.football}`
        else best = `Seri ${st.bounce.combo}  ·  Rekor ${sc.bounceCombo}`
        const hint = id === 'basket' ? (cur.toyBasketStyle === 'far' ? 'Hazır: topu geri çek, bırak' : 'Hazır: topu tutunca başlar') : id === 'bounce' || jugglingOf(cur) ? 'Hazır: topa tıkla ve başla' : cur.toyFootballStyle === 'penalty' ? 'Hazır: topu geri çek, bırak' : 'Hazır: topa vurunca başlar'
        cards.push({ id, title: GAME_INFO[id].title, unit: unitOf(cur, id), timed, active: g.round.active, score: timed ? g.round.score : g.session, left: Math.round(g.round.left * 10) / 10, best, hint })
      }
      for (const id of MINI_IDS) {
        if (!miniOn(cur, id)) continue
        const m = st.mini[id]
        if (!m) continue
        const h = m.hud()
        cards.push({ id, title: MINI_INFO[id].title, unit: h.unit, timed: false, active: h.active, score: h.score, left: 0, best: id === 'pong' ? `${h.best}  ·  Galibiyet ${st.scores.pongBest}` : `${h.best}  ·  Rekor ${st.scores[MINI_INFO[id].best]}`, hint: h.hint })
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

      // the toys that should exist right now
      const enabled: Record<BallKind, boolean> = {
        basket: cur.toyBasket,
        football: cur.toyFootball,
        bounce: cur.toyBounce,
      }

      // a changed screen size puts the balls back where they start, and nothing scores while they settle
      const sizeKey = `${w}x${h}`
      if (st.size !== sizeKey) {
        if (st.size) {
          for (const kind of Object.keys(st.balls) as BallKind[]) {
            const [x, y] = startPosition(kind, w, floor, side)
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
            if (kind === 'bounce' || kind === 'football') st.bounce = { playing: false, combo: 0, respawn: 0 }
          }
        } else if (!st.balls[kind]) {
          const [x, y] = startPosition(kind, w, floor, side)
          st.balls[kind] = makeBall(x, y - 120, SPEC[kind].r)
        }
      }
      // a game that is switched off, or set to free play, has no round running
      for (const id of GAME_IDS) {
        const g = st.games[id]
        if (g.round.active && (!enabledOf(cur, id) || modeOf(cur, id) === 'free')) g.round.active = false
        if (!enabledOf(cur, id)) g.session = 0
      }

      // ---- the pointer's tool: which ball it faces, how it swings, and every spot it passed through this frame ----
      const p = st.pointer
      let toolPath: { x: number; y: number }[] = []
      let toolKind: 'football' | 'bounce' | null = null
      if (p) {
        toolKind = st.bounce.playing ? (juggling() ? 'football' : 'bounce') : st.armed === 'football' ? st.armed : null
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
        if (toolKind === 'football') {
          const ball = st.balls[toolKind]
          if (ball && Math.abs(ball.x - p.x) > (juggling() ? 120 : 14)) st.toolDir = ball.x > p.x ? 1 : -1
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

      // far-hoop basketball: the ball waits on a spot, then flies, then goes back to a new spot
      const far = cur.toyBasket && cur.toyBasketStyle === 'far'
      if (far !== st.farOn) {
        st.farOn = far
        st.shot = makeShot()
        const bb = st.balls.basket
        if (bb) {
          const [sx, sy] = startPosition('basket', w, floor, side)
          Object.assign(bb, { x: sx, y: sy, vx: 0, vy: 0, floorHits: 0, touches: 0 })
        }
      }
      // the pitch (free kicks): the ball starts in the middle, and again when the shape of the pitch changes
      const pitchOn = cur.toyFootball && cur.toyFootballStyle === 'free'
      const pitchKey = pitchOn ? `${cur.toyPitch}|${w}x${floor}` : ''
      if (pitchKey !== st.pitchKey) {
        st.pitchKey = pitchKey
        const fb = st.balls.football
        if (pitchOn && fb) Object.assign(fb, { x: w / 2, y: floor / 2, vx: 0, vy: 0, floorHits: 0, touches: 0 })
      }
      // the penalty game takes over the football while it is the chosen kind of football
      const penalty = cur.toyFootball && cur.toyFootballStyle === 'penalty'
      const penKey = penalty ? `${cur.toyPitch}|${w}x${floor}` : ''
      if (penKey !== st.penKey) {
        st.penKey = penKey
        st.penOn = penalty
        const fb = st.balls.football
        st.pen = makePen()
        if (fb) {
          if (penalty) st.pen.spot = randomSpot(penGeo(w, floor, cur.toyPitch), w, floor)
          const [sx, sy] = penalty ? [st.pen.spot.x, st.pen.spot.y] : startPosition('football', w, floor, side)
          Object.assign(fb, { x: sx, y: sy, vx: 0, vy: 0, floorHits: 0, touches: 0 })
        }
      }
      for (const kind of ALL) {
        const ball = st.balls[kind]
        if (!ball) continue
        if (kind === 'football' && penalty) {
          penStep(st.pen, ball, dt, w, floor, cur.toyPitch, {
            goal: () => {
              saveScores({ football: st.scores.football + 1 })
              point('football')
              st.flash = { text: 'GOL!', left: 1.4 }
              tone(cur.toySound, 523, 523, 0.14, 'square', 0.07)
              tone(cur.toySound, 659, 659, 0.14, 'square', 0.07, 0.12)
              tone(cur.toySound, 784, 784, 0.3, 'square', 0.07, 0.24)
            },
            save: () => { st.flash = { text: 'KURTARDI!', left: 1.2 }; tone(cur.toySound, 200, 120, 0.2, 'sawtooth', 0.08) },
            miss: () => { st.flash = { text: 'DIŞARI', left: 1 }; tone(cur.toySound, 300, 150, 0.2, 'triangle', 0.08) },
            conceded: () => { st.flash = { text: 'GOL YEDİN', left: 1.3 }; tone(cur.toySound, 300, 110, 0.4, 'sawtooth', 0.1) },
            blocked: () => { st.flash = { text: 'KURTARDIN!', left: 1.2 }; tone(cur.toySound, 660, 990, 0.2, 'triangle', 0.1) },
          }, st.pointer ? { x: st.pointer.x, y: st.pointer.y } : null, cur.toyKeeperShoots)
          continue
        }
        if (kind === 'basket' && far && st.shot.state === 'ready') {
          if (!st.shot.spotX) st.shot.spotX = pickSpot(w, side)
          Object.assign(ball, { x: st.shot.spotX, y: floor - ball.r, vx: 0, vy: 0, floorHits: 0, touches: 0 })
          continue
        }
        const spec = SPEC[kind]
        const flat = kind === 'football' && pitchOn
        const world: World = flat ? { width: w, floor, gravity: 0, restitution: 0.72, rolling: 0 } : { width: w, floor, gravity: spec.gravity, restitution: spec.restitution, rolling: spec.rolling }
        const hitsBefore = ball.floorHits
        const prevY = ball.y
        const speedBefore = Math.abs(ball.vy)
        // a ball being served up off the floor, or waiting to be put back, stays out of the physics
        if (isRally(kind) && st.bounce.respawn > 0) {
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
        stepBall(ball, dt, world, kind === 'football' && juggling() ? [] : flat ? goalPosts(w, floor, cur.toyPitch) : segmentsFor(kind, w, floor, side))
        if (flat) slide(ball, dt)
        if (ball.floorHits > hitsBefore && speedBefore > 260) tone(cur.toySound, 150, 70, 0.09, 'sine', Math.min(0.2, speedBefore / 6000))
        if (ball.y > floor - ball.r) ball.y = floor - ball.r

        // the boot, the racket: solid, swept along the way the pointer travelled
        if (toolKind && p && ((toolKind === 'football' && kind === 'football') || (toolKind === 'bounce' && kind === 'bounce'))) {
          let touched = false
          for (const spot of toolPath) {
            for (const circle of toolCircles(toolKind, spot.x, spot.y, st.toolDir, st.toolTilt, kind === 'football' && pitchOn)) {
              // a rally ball lands on top of the racket: from underneath, or on its way up, it passes through (no sticking, no double count)
              if (isRally(kind) && (ball.y > circle.y + 6 || ball.vy < -120)) continue
              const e = toolKind === 'football' ? 0.7 : 0.95
              if (bounceOffMover(ball, circle.x, circle.y, circle.r, tv.vx, tv.vy, e)) {
                touched = true
                if (isRally(kind)) {
                  ball.y = Math.min(ball.y, circle.y - circle.r - ball.r - 1)
                  // a rally ball is kept alive: it always goes back up, steered by where on the racket it landed
                  if (ball.vy > -720) ball.vy = -720 - Math.min(260, Math.abs(tv.vy) * 0.2)
                  ball.vx = Math.max(-900, Math.min(900, ball.vx * 0.5 + (ball.x - circle.x) * 5 + tv.vx * 0.2))
                }
              }
            }
          }
          if (touched && hitOk(kind)) {
            if (kind === 'football' && !juggling()) {
              startRound('football')
              tone(cur.toySound, 220, 90, 0.11, 'triangle', 0.18)
            } else {
              point(rallyId())
              st.bounce.combo += 1
              tone(cur.toySound, 380 + Math.min(st.bounce.combo, 14) * 35, 260, 0.08, 'square', 0.08)
            }
          }
        }

        if (kind === 'basket') {
          const hp = hoop(w, floor, side)
          if (ball.grabbed) {
            // while the ball is in the hand: where the shot starts from, and a clean slate for the rim
            ball.touches = 0
            ball.floorHits = 0
            st.shotFrom = ball.x
          }
          if (scoredThroughRim(prevY, ball, hp.rimY, hp.lo, hp.hi)) {
            // a shot from far away is worth three, one that touches nothing is a clean swish
            const far = Math.abs(hp.near - st.shotFrom) > w * 0.45
            const swish = ball.touches === 0 && ball.floorHits === 0
            const points = far ? 3 : 2
            saveScores({ basket: st.scores.basket + points })
            for (let i = 0; i < points; i++) point('basket')
            st.flash = { text: swish ? (far ? 'DELİKSİZ ÜÇLÜK!' : 'DELİKSİZ!') : far ? 'ÜÇLÜK!' : 'BASKET!', left: 1.4 }
            st.shot.scored = true
            tone(cur.toySound, 660, 660, 0.12, 'sine', 0.12)
            tone(cur.toySound, 990, 990, 0.2, 'sine', 0.12, 0.1)
            if (swish) tone(cur.toySound, 1320, 1320, 0.25, 'sine', 0.1, 0.22)
          }
        } else if (kind === 'football' && pitchOn && st.respawn <= 0 && !ball.grabbed) {
          if (inWhichGoal(ball, w, floor, cur.toyPitch) >= 0) {
            saveScores({ football: st.scores.football + 1 })
            point('football')
            st.flash = { text: 'GOL!', left: 1.4 }
            st.respawn = 1.2
            tone(cur.toySound, 523, 523, 0.14, 'square', 0.07)
            tone(cur.toySound, 659, 659, 0.14, 'square', 0.07, 0.12)
            tone(cur.toySound, 784, 784, 0.3, 'square', 0.07, 0.24)
          }
        }
        if (kind === 'basket' && far && st.shot.state === 'flight') {
          st.shot.t += dt
          if (st.shot.end <= 0) {
            const gone = ball.x < -40 || ball.x > w + 40 || ball.floorHits >= 2 || st.shot.t > 7
            if (st.shot.scored) st.shot.end = 1
            else if (gone) st.shot.end = 0.4
          } else {
            st.shot.end -= dt
            if (st.shot.end <= 0) st.shot = { ...makeShot(), spotX: pickSpot(w, side) }
          }
        }
        if (isRally(kind) && st.bounce.playing && st.bounce.respawn <= 0 && ball.y >= floor - ball.r - 1 && (ball.floorHits > 0 || (st.bounce.combo > 0 && ball.vy > -40))) {
          dropBounce()
        }
      }
      if (st.respawn > 0) {
        st.respawn -= dt
        const ball = st.balls.football
        if (st.respawn <= 0 && ball) {
          ball.x = w / 2
          ball.y = floor / 2
          ball.vx = 0
          ball.vy = 0
        }
      }
      // the panel games
      for (const id of MINI_IDS) {
        const on = miniOn(cur, id)
        const m = st.mini[id]
        if (!m) continue
        if (on) m.step(dt, st.pointer ? { x: st.pointer.x, y: st.pointer.y } : null, st.miniDown, w, h, floor)
        else if (st.miniWas[id]) m.reset()
        st.miniWas[id] = on
      }
      for (const id of GAME_IDS) {
        const r = st.games[id].round
        if (r.active) {
          r.left -= dt
          if (r.left <= 0) {
            endRound(id)
            if (id === rallyId() && (id === 'bounce' || juggling())) {
              st.bounce.playing = false
              st.bounce.respawn = 0
              if (st.bounce.combo > st.scores[comboKey()]) saveScores({ [comboKey()]: st.bounce.combo })
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
        if (p) {
          const dragged = st.drag && st.drag.kind === 'ball' ? st.balls[st.drag.ball] : null
          if (dragged) {
            if (st.drag && st.drag.kind === 'ball' && st.drag.ball === 'basket') drawGrip(c, dragged)
            else drawFist(c, p.x, p.y)
          } else if (st.armed === 'basket') drawReach(c, p.x, p.y)
          else if (toolKind === 'football') {
            if (cur.toyFootball && cur.toyFootballStyle === 'free') drawBootTop(c, p.x, p.y, st.toolVx, st.toolVy, Math.hypot(st.toolVx, st.toolVy) > 60 ? Math.atan2(st.toolVy, st.toolVx) : 0)
            else drawBoot(c, p.x, p.y, st.toolDir, st.toolTilt)
          }
          else if (toolKind === 'bounce') {
            // the racket lies flat, face up, its head centred on the pointer and its handle trailing to the left;
            // it leans a little into the sideways swing
            const lean = Math.max(-0.3, Math.min(0.3, st.toolVx / 4200))
            const gx = p.x - Math.cos(lean) * RACKET_REACH
            const gy = p.y - Math.sin(lean) * RACKET_REACH
            drawRacket(c, gx, gy, 1, lean)
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
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div className="toys" ref={root}>
      <canvas ref={canvas} className="toys__canvas" />
      <Hud cards={hud.cards} result={hud.result} showCursor={s.toyShowCursor} corner={s.toyFootball && (s.toyFootballStyle === 'free' || s.toyFootballStyle === 'penalty') && s.toyPitch === 'vertical'} />
    </div>
  )
}
