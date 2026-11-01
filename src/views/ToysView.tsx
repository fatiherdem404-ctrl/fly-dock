import { useEffect, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import type { DockSettings, ToyScores } from '@/shared/types'
import { DEFAULT_TOY_SCORES } from '@/shared/types'
import { Ball, Segment, World, inGoal, kickBall, makeBall, scoredThroughRim, stepBall, throwVelocity } from '@/toys/ball'
import { Pet, drop, makePet, pickUp, stepPet, stroke } from '@/toys/pet'
import PetSprite from '@/toys/PetSprite'

type GameKind = 'basket' | 'football' | 'tennis'
/** The pet's own playthings: the cat's ball of yarn and the dog's stick. */
type PlayKind = 'yarn' | 'stick'
type BallKind = GameKind | PlayKind
type Round = { active: boolean; left: number; score: number }

const ALL: BallKind[] = ['basket', 'football', 'tennis', 'yarn', 'stick']
const ROUND_SECONDS = 60

/** Everything that moves lives here, outside React: the animation loop reads and writes it every frame. */
interface Sim {
  balls: Partial<Record<BallKind, Ball>>
  pet: Pet | null
  pointer: { x: number; y: number; vx: number; vy: number; t: number } | null
  samples: [number, number, number][]
  drag: { kind: 'ball'; ball: BallKind; dx: number; dy: number } | { kind: 'pet'; dx: number; dy: number; moved: number; at: number } | null
  capture: boolean
  scores: ToyScores
  rally: number
  /** The 60-second rounds of basketball and football. */
  rounds: Record<'basket' | 'football', Round>
  /** Text flashed in the middle of the screen: SEPET!, GOL! … */
  flash: { text: string; sub?: string; left: number } | null
  /** A scored football is put back when this runs out. */
  respawn: number
  hover: boolean
  /** Size of the window the toys were last placed for. */
  size: string
  /** The football boot or tennis racket the pointer has turned into, with the way it is swinging. */
  armed: 'football' | 'tennis' | null
  toolDir: 1 | -1
  toolAngle: number
  /** The dog has the stick in its mouth. */
  carried: boolean
  /** The stick was thrown and lies free for the dog to fetch. */
  stickThrown: boolean
  /** Where the stick was thrown from: the dog brings it back there. */
  throwFrom: number
  cursor: string
}

const SPEC: Record<BallKind, { r: number; gravity: number; restitution: number; rolling: number }> = {
  basket: { r: 24, gravity: 2000, restitution: 0.72, rolling: 1.2 },
  football: { r: 28, gravity: 1900, restitution: 0.62, rolling: 0.9 },
  tennis: { r: 13, gravity: 1500, restitution: 0.86, rolling: 0.7 },
  yarn: { r: 15, gravity: 1800, restitution: 0.5, rolling: 0.8 },
  stick: { r: 9, gravity: 1900, restitution: 0.3, rolling: 3.2 },
}
const GOAL_DEPTH = 64
const GOAL_HEIGHT = 150
const NET_HEIGHT = 96
const TAU = Math.PI * 2
/** How close the pointer has to come before it turns into a boot or a racket. */
const AURA: Record<'football' | 'tennis', number> = { football: 80, tennis: 110 }

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
  const g = c.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r)
  if (kind === 'basket') { g.addColorStop(0, '#ffb066'); g.addColorStop(1, '#c9591b') }
  else if (kind === 'football') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd3da') }
  else if (kind === 'yarn') { g.addColorStop(0, '#ff9ec4'); g.addColorStop(1, '#d6447f') }
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
  } else if (kind === 'basket') {
    c.strokeStyle = 'rgba(40,18,6,0.75)'
    c.lineWidth = Math.max(1.5, b.r * 0.07)
    c.beginPath()
    c.moveTo(-b.r, 0); c.lineTo(b.r, 0)
    c.moveTo(0, -b.r); c.lineTo(0, b.r)
    c.moveTo(-b.r * 0.7, -b.r * 0.7); c.quadraticCurveTo(-b.r * 0.25, 0, -b.r * 0.7, b.r * 0.7)
    c.moveTo(b.r * 0.7, -b.r * 0.7); c.quadraticCurveTo(b.r * 0.25, 0, b.r * 0.7, b.r * 0.7)
    c.stroke()
  } else if (kind === 'football') {
    c.fillStyle = '#23262e'
    const patch = (cx: number, cy: number, rr: number) => {
      c.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
    }
    patch(0, 0, b.r * 0.34)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2
      patch(Math.cos(a) * b.r * 0.78, Math.sin(a) * b.r * 0.78, b.r * 0.2)
    }
    c.strokeStyle = 'rgba(35,38,46,0.55)'
    c.lineWidth = 1.2
    c.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2
      c.moveTo(Math.cos(a) * b.r * 0.32, Math.sin(a) * b.r * 0.32)
      c.lineTo(Math.cos(a) * b.r * 0.62, Math.sin(a) * b.r * 0.62)
    }
    c.stroke()
  } else {
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

/** A football boot with cleats and a sock: the toe is at the pointer, the leg trails behind it. */
function drawBoot(c: CanvasRenderingContext2D, x: number, y: number, dir: number, angle: number) {
  c.save()
  c.translate(x, y)
  c.scale(dir, 1)
  c.rotate(angle)
  c.shadowColor = 'rgba(0,0,0,0.35)'
  c.shadowBlur = 8
  c.lineCap = 'round'
  c.lineJoin = 'round'
  // the leg, trailing back and up
  c.strokeStyle = '#f4f6fb'
  c.lineWidth = 18
  c.beginPath(); c.moveTo(-32, -12); c.lineTo(-112, -50); c.stroke()
  c.strokeStyle = '#d7263d'
  c.lineWidth = 17
  c.beginPath(); c.moveTo(-60, -25); c.lineTo(-76, -33); c.stroke()
  c.shadowBlur = 0
  // the boot
  c.fillStyle = '#16181f'
  c.beginPath()
  c.moveTo(-38, -19); c.lineTo(-16, -19); c.quadraticCurveTo(-4, -17, 7, -7); c.quadraticCurveTo(12, 0, 7, 6); c.lineTo(-38, 6); c.closePath()
  c.fill()
  c.fillStyle = '#d7263d'
  c.beginPath()
  c.moveTo(-36, -17); c.lineTo(-17, -17); c.quadraticCurveTo(-6, -15, 4, -6); c.quadraticCurveTo(7, 0, 4, 3); c.lineTo(-36, 3); c.closePath()
  c.fill()
  c.strokeStyle = '#ffffff'
  c.lineWidth = 1.6
  c.beginPath()
  for (let i = 0; i < 4; i++) { c.moveTo(-26 + i * 7, -16 + i * 1.4); c.lineTo(-22 + i * 7, -9 + i * 1.8) }
  c.stroke()
  // sole and cleats
  c.fillStyle = '#e9ecf3'
  c.fillRect(-38, 3, 47, 4)
  c.fillStyle = '#7d8696'
  for (const cx of [-33, -20, -7, 5]) c.fillRect(cx, 7, 5, 5)
  c.restore()
}

/** A tennis racket: the grip is at the pointer and the head leads the swing. */
function drawRacket(c: CanvasRenderingContext2D, x: number, y: number, dir: number, angle: number) {
  c.save()
  c.translate(x, y)
  c.scale(dir, 1)
  c.rotate(angle)
  c.shadowColor = 'rgba(0,0,0,0.35)'
  c.shadowBlur = 8
  c.lineCap = 'round'
  c.strokeStyle = '#2b2f3a'
  c.lineWidth = 7
  c.beginPath(); c.moveTo(0, 0); c.lineTo(26, 0); c.stroke()
  c.strokeStyle = '#c9d2e3'
  c.lineWidth = 3
  c.beginPath(); c.moveTo(26, 0); c.lineTo(44, 0); c.stroke()
  c.shadowBlur = 0
  c.fillStyle = 'rgba(255,255,255,0.14)'
  c.beginPath(); c.ellipse(66, 0, 26, 21, 0, 0, TAU); c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.55)'
  c.lineWidth = 1
  c.beginPath()
  for (let i = -3; i <= 3; i++) { c.moveTo(66 - 23, i * 6); c.lineTo(66 + 23, i * 6); c.moveTo(66 + i * 7, -17); c.lineTo(66 + i * 7, 17) }
  c.stroke()
  c.strokeStyle = '#e8452c'
  c.lineWidth = 4.5
  c.beginPath(); c.ellipse(66, 0, 26, 21, 0, 0, TAU); c.stroke()
  c.restore()
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size = 16, align: CanvasTextAlign = 'center') {
  c.font = `700 ${size}px 'Segoe UI', system-ui, sans-serif`
  c.textAlign = align
  c.textBaseline = 'middle'
  c.lineWidth = 4
  c.strokeStyle = 'rgba(10,14,28,0.7)'
  c.lineJoin = 'round'
  c.strokeText(text, x, y)
  c.fillStyle = '#ffffff'
  c.fillText(text, x, y)
}

const roundLine = (round: Round, name: string, best: number) =>
  round.active ? `${name}: ${round.score}  ·  ${Math.ceil(round.left)} sn  ·  Rekor ${best}` : `Rekor ${best}  ·  başlamak için topa dokun`

/** Where the racket's head is while the grip is at (x, y): the head leads the swing. */
const racketHead = (x: number, y: number, dir: number, angle: number): [number, number] => [x + dir * Math.cos(angle) * 66, y + Math.sin(angle) * 66]

function drawScene(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  if (s.toyBasket) {
    const h = hoop(width, floor, s.toyHoopSide)
    const outward = s.toyHoopSide === 'right' ? -1 : 1
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
    label(c, roundLine(sim.rounds.basket, 'Sepet', sim.scores.basketBest), h.boardX + outward * 150, h.boardTop - 16, 14)
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
    label(c, roundLine(sim.rounds.football, 'Gol', sim.scores.footballBest), GOAL_DEPTH + 150, top - 14, 14)
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
    label(c, `Seri: ${sim.rally}  ·  Rekor: ${sim.scores.tennisBest}`, x, top - 16, 14)
  }
  if (sim.flash) {
    const t = Math.min(1, sim.flash.left / 0.4)
    c.globalAlpha = t
    label(c, sim.flash.text, width / 2, floor * 0.3 - (1 - t) * 10, 54)
    if (sim.flash.sub) label(c, sim.flash.sub, width / 2, floor * 0.3 + 44 - (1 - t) * 10, 22)
    c.globalAlpha = 1
  }
  for (const kind of ALL) {
    const ball = sim.balls[kind]
    if (ball) drawBall(c, ball, kind, floor)
  }
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
  const petEl = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const settingsRef = useRef(s)
  settingsRef.current = s
  const sim = useRef<Sim>({
    balls: {}, pet: null, pointer: null, samples: [], drag: null, capture: false, scores: { ...DEFAULT_TOY_SCORES }, rally: 0,
    rounds: { basket: { active: false, left: 0, score: 0 }, football: { active: false, left: 0, score: 0 } },
    flash: null, respawn: 0, hover: false, size: '', armed: null, toolDir: 1, toolAngle: -0.15, carried: false, stickThrown: false, throwFrom: 0, cursor: '',
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
    const startRound = (kind: 'basket' | 'football') => {
      const r = st.rounds[kind]
      if (r.active) return
      r.active = true
      r.left = ROUND_SECONDS
      r.score = 0
      tone(settingsRef.current.toySound, 440, 880, 0.18, 'triangle', 0.1)
    }
    const point = (kind: 'basket' | 'football') => {
      const r = st.rounds[kind]
      if (r.active) r.score += 1
    }
    const petBox = () => {
      const cur = settingsRef.current
      const p = st.pet
      if (!p || !cur.toyPet) return null
      const size = cur.toyPetSize
      return { x: p.x - size / 2, y: p.y - size * 0.93, w: size, h: size * 0.93 }
    }
    /** What can be picked up at a point: basketball, yarn, stick or the pet. */
    const grabAt = (x: number, y: number): { kind: 'ball'; ball: BallKind } | { kind: 'pet' } | null => {
      for (const kind of ['yarn', 'stick', 'basket'] as BallKind[]) {
        const b = st.balls[kind]
        if (b && Math.hypot(b.x - x, b.y - y) <= b.r + (kind === 'stick' ? 26 : 8)) return { kind: 'ball', ball: kind }
      }
      const box = petBox()
      if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return { kind: 'pet' }
      return null
    }
    /** Is the pointer close enough to the football or tennis ball to turn into a boot or a racket? */
    const armedFor = (x: number, y: number): 'football' | 'tennis' | null => {
      for (const kind of ['football', 'tennis'] as const) {
        const b = st.balls[kind]
        if (b && !b.grabbed && Math.hypot(b.x - x, b.y - y) <= b.r + AURA[kind]) return kind
      }
      return null
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
      if (Math.hypot(vx, vy) > 140) {
        st.toolDir = vx >= 0 ? 1 : -1
        const target = Math.max(-1, Math.min(1, Math.atan2(vy, Math.abs(vx))))
        st.toolAngle += (target - st.toolAngle) * 0.35
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
        } else if (st.pet) {
          d.moved += Math.hypot(e.movementX, e.movementY)
          st.pet.x = e.clientX + d.dx
          st.pet.y = e.clientY + d.dy
        }
        return
      }
      const sound = settingsRef.current.toySound
      // the boot and the racket hit the football and the tennis ball; the yarn is only nudged by the bare pointer
      st.armed = armedFor(e.clientX, e.clientY)
      const football = st.balls.football
      if (football && st.armed === 'football' && kickBall(football, e.clientX, e.clientY, vx, vy, 180, 14)) {
        startRound('football')
        tone(sound, 220, 90, 0.11, 'triangle', 0.18)
      }
      const tennis = st.balls.tennis
      if (tennis && st.armed === 'tennis') {
        const [hx, hy] = racketHead(e.clientX, e.clientY, st.toolDir, st.toolAngle)
        if (kickBall(tennis, hx, hy, vx, vy, 150, 22)) {
          tone(sound, 520, 260, 0.07, 'square', 0.08)
          st.rally += 1
          if (st.rally > st.scores.tennisBest) saveScores({ tennisBest: st.rally })
        }
      }
      const yarn = st.balls.yarn
      if (yarn && kickBall(yarn, e.clientX, e.clientY, vx, vy)) tone(sound, 330, 200, 0.06, 'triangle', 0.08)
      const over = grabAt(e.clientX, e.clientY)
      setCapture(!!over || !!st.armed)
      setCursor(st.armed ? 'none' : over ? (over.kind === 'pet' ? 'pointer' : 'grab') : '')
      const hovering = over?.kind === 'pet'
      if (hovering !== st.hover) {
        st.hover = hovering
        if (petEl.current) petEl.current.dataset.hover = String(hovering)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const over = grabAt(e.clientX, e.clientY)
      if (!over) return
      st.samples = [[e.clientX, e.clientY, performance.now()]]
      st.armed = null
      setCursor('grabbing')
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
      if (p) {
        st.armed = armedFor(p.x, p.y)
        const over = grabAt(p.x, p.y)
        setCapture(!!over || !!st.armed)
        setCursor(st.armed ? 'none' : over ? 'grab' : '')
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)

    const endRound = (kind: 'basket' | 'football') => {
      const r = st.rounds[kind]
      r.active = false
      const best = kind === 'basket' ? st.scores.basketBest : st.scores.footballBest
      const noun = kind === 'basket' ? 'sepet' : 'gol'
      const record = r.score > best
      if (record) saveScores(kind === 'basket' ? { basketBest: r.score } : { footballBest: r.score })
      st.flash = { text: record ? 'YENİ REKOR!' : 'SÜRE DOLDU', sub: `${r.score} ${noun}${record ? '' : `  ·  Rekor ${best}`}`, left: 3 }
      const sound = settingsRef.current.toySound
      if (record) [523, 659, 784, 1047].forEach((f, i) => tone(sound, f, f, 0.2, 'triangle', 0.1, i * 0.12))
      else tone(sound, 400, 200, 0.4, 'triangle', 0.1)
    }

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
        tennis: cur.toyTennis,
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
          }
        } else if (!st.balls[kind]) {
          const [x, y] = startPosition(kind, w, floor, side, st.pet?.x)
          st.balls[kind] = makeBall(x, y - 120, SPEC[kind].r)
        }
      }
      if (!cur.toyPet) st.pet = null
      else if (!st.pet) st.pet = makePet(w * 0.3, floor)

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
      for (const kind of ['basket', 'football'] as const) {
        const r = st.rounds[kind]
        if (r.active) {
          r.left -= dt
          if (r.left <= 0) endRound(kind)
        }
      }
      if (st.flash) {
        st.flash.left -= dt
        if (st.flash.left <= 0) st.flash = null
      }

      const pet = st.pet
      if (pet && petEl.current) {
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
          stick.x = pet.x + pet.dir * size * 0.42
          stick.y = pet.y - size * 0.3
          stick.vx = 0
          stick.vy = 0
          stick.angle = pet.dir > 0 ? 0.35 : -0.35
        }
        const el = petEl.current
        el.style.transform = `translate(${Math.round(pet.x - size / 2)}px, ${Math.round(pet.y - size * 0.93)}px)`
        if (el.dataset.state !== pet.state) el.dataset.state = pet.state
        const dir = String(pet.dir)
        if (el.dataset.dir !== dir) el.dataset.dir = dir
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
        const p = st.pointer
        if (p && st.armed && !st.drag) {
          if (st.armed === 'football') drawBoot(c, p.x, p.y, st.toolDir, st.toolAngle)
          else drawRacket(c, p.x, p.y, st.toolDir, st.toolAngle)
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className="toys" ref={root}>
      <canvas ref={canvas} className="toys__canvas" />
      <div ref={petEl} className="pet" data-state="idle" data-dir="1" style={{ width: s.toyPetSize, height: s.toyPetSize, display: s.toyPet ? 'block' : 'none' }}>
        <PetSprite kind={s.toyPetKind} />
        <span className="pet__name">{s.toyPetName || 'Dostum'}</span>
        <span className="pet__hearts"><i>♥</i><i>♥</i><i>♥</i></span>
        <span className="pet__zzz">z z</span>
      </div>
    </div>
  )
}
