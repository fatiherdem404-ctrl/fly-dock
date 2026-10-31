import { useEffect, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import type { DockSettings, ToyScores } from '@/shared/types'
import { DEFAULT_TOY_SCORES } from '@/shared/types'
import { Ball, Segment, World, inGoal, kickBall, makeBall, scoredThroughRim, stepBall, throwVelocity } from '@/toys/ball'
import { Pet, drop, makePet, pickUp, stepPet, stroke } from '@/toys/pet'
import PetSprite from '@/toys/PetSprite'

type BallKind = 'basket' | 'football' | 'tennis'

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
  /** Text flashed in the middle of the screen: SEPET!, GOL! … */
  flash: { text: string; left: number } | null
  /** A scored football is put back in the middle when this runs out. */
  respawn: number
  hover: boolean
  /** Size of the window the toys were last placed for. */
  size: string
}

const SPEC: Record<BallKind, { r: number; gravity: number; restitution: number; rolling: number }> = {
  basket: { r: 24, gravity: 2000, restitution: 0.72, rolling: 1.2 },
  football: { r: 28, gravity: 1900, restitution: 0.62, rolling: 0.9 },
  tennis: { r: 13, gravity: 1500, restitution: 0.86, rolling: 0.7 },
}
const GOAL_DEPTH = 64
const GOAL_HEIGHT = 150
const NET_HEIGHT = 96
const TAU = Math.PI * 2

/** The line the toys stand on: the top of the dock when it sits at the bottom, else the bottom of the work area. */
function floorOf(s: DockSettings, height: number): number {
  if (s.position !== 'bottom' || s.autoHide) return height
  return Math.max(height * 0.4, height - s.edgeOffset - (s.iconSize + s.deskPadTop + s.deskPadBottom))
}

function hoop(width: number, floor: number) {
  const rimY = Math.max(150, floor - 330)
  return { rimY, rimRight: width - 26, rimLeft: width - 26 - 84, boardTop: rimY - 100, boardBottom: rimY + 12, boardX: width - 22 }
}

function segmentsFor(kind: BallKind, width: number, floor: number): Segment[] {
  if (kind === 'basket') {
    const h = hoop(width, floor)
    return [
      { ax: h.boardX, ay: h.boardTop, bx: h.boardX, by: h.boardBottom, restitution: 0.5 },
      { ax: h.rimLeft, ay: h.rimY, bx: h.rimLeft, by: h.rimY, restitution: 0.55 },
      { ax: h.rimRight, ay: h.rimY, bx: h.rimRight, by: h.rimY, restitution: 0.55 },
    ]
  }
  if (kind === 'football') {
    const top = floor - GOAL_HEIGHT
    return [
      { ax: 0, ay: top, bx: GOAL_DEPTH, by: top, restitution: 0.5 },
      { ax: width - GOAL_DEPTH, ay: top, bx: width, by: top, restitution: 0.5 },
    ]
  }
  const x = width / 2
  return [
    { ax: x, ay: floor - NET_HEIGHT, bx: x, by: floor, restitution: 0.3 },
    { ax: x, ay: floor - NET_HEIGHT, bx: x, by: floor - NET_HEIGHT, restitution: 0.6 },
  ]
}

const startPosition = (kind: BallKind, width: number, floor: number): [number, number] =>
  kind === 'basket' ? [width - 280, floor - SPEC.basket.r] : kind === 'football' ? [width * 0.62, floor - SPEC.football.r] : [width * 0.3, floor - SPEC.tennis.r]

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
  c.ellipse(b.x, floor - 2, b.r * Math.max(0.35, 1 - height / 700), b.r * 0.22, 0, 0, TAU)
  c.fill()
  c.save()
  c.translate(b.x, b.y)
  c.rotate(b.angle)
  const g = c.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r)
  if (kind === 'basket') { g.addColorStop(0, '#ffb066'); g.addColorStop(1, '#c9591b') }
  else if (kind === 'football') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd3da') }
  else { g.addColorStop(0, '#e9ff6a'); g.addColorStop(1, '#a9c91d') }
  c.fillStyle = g
  c.beginPath()
  c.arc(0, 0, b.r, 0, TAU)
  c.fill()
  c.lineCap = 'round'
  if (kind === 'basket') {
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

function drawScene(c: CanvasRenderingContext2D, s: DockSettings, sim: Sim, width: number, floor: number) {
  if (s.toyBasket) {
    const h = hoop(width, floor)
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
      c.moveTo(h.rimLeft + (h.rimRight - h.rimLeft) * t, h.rimY)
      c.lineTo(h.rimLeft + 14 + (h.rimRight - h.rimLeft - 28) * t, h.rimY + 46)
    }
    for (let j = 1; j <= 3; j++) {
      const y = h.rimY + j * 12
      const inset = (j * 14) / 3.8
      c.moveTo(h.rimLeft + inset, y)
      c.lineTo(h.rimRight - inset, y)
    }
    c.stroke()
    c.strokeStyle = '#ff7a2f'
    c.lineWidth = 5
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(h.rimLeft, h.rimY)
    c.lineTo(h.rimRight, h.rimY)
    c.stroke()
    label(c, `Sepet: ${sim.scores.basket}`, h.boardX - 40, h.boardTop - 14, 15)
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
    label(c, `Gol: ${sim.scores.football}`, GOAL_DEPTH + 36, top - 14, 15)
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
    label(c, `Seri: ${sim.rally}  ·  En iyi: ${sim.scores.tennisBest}`, x, top - 16, 15)
  }
  if (sim.flash) {
    const t = Math.min(1, sim.flash.left / 0.4)
    c.globalAlpha = t
    label(c, sim.flash.text, width / 2, floor * 0.3 - (1 - t) * 10, 54)
    c.globalAlpha = 1
  }
  for (const kind of ['basket', 'football', 'tennis'] as BallKind[]) {
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
  const settingsRef = useRef(s)
  settingsRef.current = s
  const sim = useRef<Sim>({ balls: {}, pet: null, pointer: null, samples: [], drag: null, capture: false, scores: { ...DEFAULT_TOY_SCORES }, rally: 0, flash: null, respawn: 0, hover: false, size: '' })

  useEffect(() => {
    const st = sim.current
    ;(window as unknown as { __toys: Sim }).__toys = st
    invoke('toys:scores').then((scores) => (st.scores = scores))
    const setCapture = (on: boolean) => {
      if (st.capture === on) return
      st.capture = on
      invoke('toys:capture', on)
    }
    const saveScores = (patch: Partial<ToyScores>) => {
      st.scores = { ...st.scores, ...patch }
      invoke('toys:scores', patch)
    }
    const dims = () => ({ w: window.innerWidth, h: window.innerHeight })
    const petBox = () => {
      const cur = settingsRef.current
      const p = st.pet
      if (!p || !cur.toyPet) return null
      const size = cur.toyPetSize
      return { x: p.x - size / 2, y: p.y - size * 0.93, w: size, h: size * 0.93 }
    }
    const hit = (x: number, y: number): { kind: 'ball'; ball: BallKind } | { kind: 'pet' } | null => {
      for (const kind of ['tennis', 'football', 'basket'] as BallKind[]) {
        const b = st.balls[kind]
        if (b && Math.hypot(b.x - x, b.y - y) <= b.r + 8) return { kind: 'ball', ball: kind }
      }
      const box = petBox()
      if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return { kind: 'pet' }
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
      for (const kind of ['basket', 'football', 'tennis'] as BallKind[]) {
        const ball = st.balls[kind]
        if (ball && kickBall(ball, e.clientX, e.clientY, vx, vy)) {
          tone(settingsRef.current.toySound, 300, 150, 0.08, 'triangle', 0.14)
          if (kind === 'tennis') {
            st.rally += 1
            if (st.rally > st.scores.tennisBest) saveScores({ tennisBest: st.rally })
          }
        }
      }
      const over = hit(e.clientX, e.clientY)
      setCapture(!!over)
      const hovering = over?.kind === 'pet'
      if (hovering !== st.hover) {
        st.hover = hovering
        if (petEl.current) petEl.current.dataset.hover = String(hovering)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const over = hit(e.clientX, e.clientY)
      if (!over) return
      st.samples = [[e.clientX, e.clientY, performance.now()]]
      if (over.kind === 'ball') {
        const ball = st.balls[over.ball]!
        ball.grabbed = true
        ball.vx = 0
        ball.vy = 0
        ball.floorHits = 0
        st.drag = { kind: 'ball', ball: over.ball, dx: ball.x - e.clientX, dy: ball.y - e.clientY }
      } else if (st.pet) {
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
          if (d.ball === 'tennis') st.rally = 0
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
      if (p) setCapture(!!hit(p.x, p.y))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)

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

      // a changed screen size puts the balls back where they start, and nothing scores while they settle
      const sizeKey = `${w}x${h}`
      if (st.size !== sizeKey) {
        if (st.size) {
          for (const kind of Object.keys(st.balls) as BallKind[]) {
            const [x, y] = startPosition(kind, w, floor)
            Object.assign(st.balls[kind]!, { x, y: y - 120, vx: 0, vy: 0 })
          }
          st.respawn = 0.6
        }
        st.size = sizeKey
      }

      // toys come and go with the settings
      const enabled: Record<BallKind, boolean> = { basket: cur.toyBasket, football: cur.toyFootball, tennis: cur.toyTennis }
      for (const kind of ['basket', 'football', 'tennis'] as BallKind[]) {
        if (!enabled[kind]) delete st.balls[kind]
        else if (!st.balls[kind]) {
          const [x, y] = startPosition(kind, w, floor)
          st.balls[kind] = makeBall(x, y - 120, SPEC[kind].r)
        }
      }
      if (!cur.toyPet) st.pet = null
      else if (!st.pet) st.pet = makePet(w * 0.3, floor)

      for (const kind of ['basket', 'football', 'tennis'] as BallKind[]) {
        const ball = st.balls[kind]
        if (!ball) continue
        const spec = SPEC[kind]
        const world: World = { width: w, floor, gravity: spec.gravity, restitution: spec.restitution, rolling: spec.rolling }
        const hitsBefore = ball.floorHits
        const prevY = ball.y
        const speedBefore = Math.abs(ball.vy)
        stepBall(ball, dt, world, segmentsFor(kind, w, floor))
        if (ball.floorHits > hitsBefore && speedBefore > 260) tone(cur.toySound, 150, 70, 0.09, 'sine', Math.min(0.2, speedBefore / 6000))
        if (ball.y > floor - ball.r) ball.y = floor - ball.r
        if (kind === 'basket') {
          const hp = hoop(w, floor)
          if (scoredThroughRim(prevY, ball, hp.rimY, hp.rimLeft, hp.rimRight)) {
            saveScores({ basket: st.scores.basket + 1 })
            st.flash = { text: 'SEPET!', left: 1.1 }
            tone(cur.toySound, 660, 660, 0.12, 'sine', 0.12)
            tone(cur.toySound, 990, 990, 0.2, 'sine', 0.12, 0.1)
          }
        } else if (kind === 'football' && st.respawn <= 0 && !ball.grabbed) {
          if (inGoal(ball, 'left', w, GOAL_DEPTH, floor, GOAL_HEIGHT) || inGoal(ball, 'right', w, GOAL_DEPTH, floor, GOAL_HEIGHT)) {
            saveScores({ football: st.scores.football + 1 })
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
          ball.x = startPosition('football', w, floor)[0]
          ball.y = floor - 260
          ball.vx = 0
          ball.vy = 0
        }
      }
      if (st.flash) {
        st.flash.left -= dt
        if (st.flash.left <= 0) st.flash = null
      }

      const pet = st.pet
      if (pet && petEl.current) {
        stepPet(pet, dt, { width: w, floor, pointer: st.pointer, chase: cur.toyPetChase, size: cur.toyPetSize, rand: Math.random })
        const size = cur.toyPetSize
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
    <div className="toys">
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
