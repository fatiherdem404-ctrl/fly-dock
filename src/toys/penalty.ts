// The penalty game of the football toy, on the same pitch seen from above as the free kicks: the goal with the keeper is
// at the far end (right, or at the top on a vertical pitch). The ball is pulled back like a sling (the pull sets
// direction and power), the mouse wheel sets the curve ("falso") and the keeper moves along his line after it.
// With the keeper's return shot on, he then fires one back at your own goal, which the pointer defends as a glove.
import { Ball, bounceOffMover, makeBall, stepBall, World } from './ball'
import { GOAL_W, Pitch, goalBoxes, goalPosts, inWhichGoal } from './pitch'

export const PEN_MAX_PULL = 230
const SPEED_PER_PX = 6.6
/** Slowing down on the grass, per second, and how fast a spinning ball turns (rad/s at 1000 px/s and full spin). */
const FRICTION = 1.05
const CURL_ROT = 0.7
const KEEPER_R = 30
const GLOVE_R = 36

export interface Pen {
  phase: 'ready' | 'flight' | 'result' | 'return' | 'returned'
  /** The pull that is being dragged: from the ball to the pointer. */
  aim: { x: number; y: number } | null
  spin: number
  timer: number
  /** The keeper along his line (a lateral coordinate), where he is going, and his reaction. */
  keeper: { pos: number; target: number; vel: number; delay: number; speed: number }
  /** The keeper's shot at your goal, and the glove (a lateral coordinate) that defends it. */
  back: Ball | null
  glove: number
  gloveVel: number
  /** Where the ball waits for the next free kick: it changes every time. */
  spot: { x: number; y: number }
  /** The ball has touched the keeper (or the glove) on its way: it counts as a save unless it still goes in. */
  touched: boolean
  goals: number
  saves: number
  conceded: number
  verdict: string
  done: boolean
}

export const makePen = (): Pen => ({
  phase: 'ready', aim: null, spin: 0, timer: 0,
  keeper: { pos: 0, target: 0, vel: 0, delay: 0, speed: 520 },
  back: null, glove: 0, gloveVel: 0, spot: { x: 0, y: 0 }, touched: false, goals: 0, saves: 0, conceded: 0, verdict: '', done: false,
})

export interface Geo {
  pitch: Pitch
  /** Which goal is shot at (index in goalBoxes) and which is yours. */
  targetIdx: number
  ownIdx: number
  /** The coordinate of the goal mouths along the shooting axis, and the sign of "towards the target goal" along it. */
  targetLine: number
  ownLine: number
  sign: 1 | -1
  /** The middle of the goals along the other axis. */
  center: number
  spot: { x: number; y: number }
}

export function geo(width: number, floor: number, pitch: Pitch): Geo {
  const [a, b] = goalBoxes(width, floor, pitch)
  if (pitch === 'horizontal') {
    const line = b.x
    const dist = Math.min(520, width * 0.4)
    return { pitch, targetIdx: 1, ownIdx: 0, targetLine: line, ownLine: a.x + a.w, sign: 1, center: floor / 2, spot: { x: line - dist, y: floor / 2 } }
  }
  const line = a.y + a.h
  const dist = Math.min(420, floor * 0.45)
  return { pitch, targetIdx: 0, ownIdx: 1, targetLine: line, ownLine: b.y, sign: -1, center: width / 2, spot: { x: width / 2, y: line + dist } }
}

/**
 * A new place to take the free kick from: in the attacking half, well outside the box, never right at the goal.
 * Between about a third and just over half of the pitch's length away from the goal line, and anywhere across.
 */
export function randomSpot(g: Geo, width: number, floor: number): { x: number; y: number } {
  const r = Math.random
  const extent = g.pitch === 'horizontal' ? width : floor
  const dist = extent * (0.34 + r() * 0.2)
  const side = (g.pitch === 'horizontal' ? floor : width) / 2 - 110
  const [x, y] = place(g, g.targetLine - g.sign * dist, g.center + (r() * 2 - 1) * Math.min(side, 340))
  return { x, y }
}

/** The lateral coordinate (along the goal line) of a point, and a point from an along / lateral pair. */
const lat = (g: Geo, x: number, y: number) => (g.pitch === 'horizontal' ? y : x)
const along = (g: Geo, x: number, y: number) => (g.pitch === 'horizontal' ? x : y)
const place = (g: Geo, along1: number, lat1: number): [number, number] => (g.pitch === 'horizontal' ? [along1, lat1] : [lat1, along1])

/** The point the keeper stands at, on his line. */
export function keeperPoint(g: Geo, pen: Pen): [number, number] {
  const pos = pen.keeper.pos || g.center
  return place(g, g.targetLine - g.sign * 22, pos)
}
/** The glove's point on your own line. */
export function glovePoint(g: Geo, pen: Pen): [number, number] {
  const pos = pen.glove || g.center
  return place(g, g.ownLine + g.sign * 22, pos)
}

/** The launch speed from a pull. */
export function launch(pull: { x: number; y: number }): { vx: number; vy: number; power: number } {
  const len = Math.hypot(pull.x, pull.y)
  const k = Math.min(len, PEN_MAX_PULL)
  if (len < 4) return { vx: 0, vy: 0, power: 0 }
  return { vx: (-pull.x / len) * k * SPEED_PER_PX, vy: (-pull.y / len) * k * SPEED_PER_PX, power: k / PEN_MAX_PULL }
}

/** A ball's velocity after dt: turned by the spin, slowed by the grass. */
function bend(vx: number, vy: number, spin: number, dt: number): [number, number] {
  const speed = Math.hypot(vx, vy)
  const w = spin * CURL_ROT * (speed / 1000)
  const c = Math.cos(w * dt), s = Math.sin(w * dt)
  const k = Math.exp(-FRICTION * dt)
  return [(vx * c - vy * s) * k, (vx * s + vy * c) * k]
}

/** Where the ball crosses the goal line, and when, ignoring walls and the keeper (the keeper reads this). */
export function predict(g: Geo, x: number, y: number, vx: number, vy: number, spin: number): { lat: number; t: number } | null {
  let t = 0
  for (let i = 0; i < 600; i++) {
    const dt = 1 / 120
    ;[vx, vy] = bend(vx, vy, spin, dt)
    x += vx * dt
    y += vy * dt
    t += dt
    if ((along(g, x, y) - g.targetLine) * g.sign >= 0) return { lat: lat(g, x, y), t }
    if (Math.hypot(vx, vy) < 20) return null
  }
  return null
}

/** The dotted path shown while aiming. */
export function path(x: number, y: number, vx: number, vy: number, spin: number, count = 34): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < count * 6; i++) {
    const dt = 1 / 60
    ;[vx, vy] = bend(vx, vy, spin, dt)
    x += vx * dt
    y += vy * dt
    if (i % 6 === 5) out.push([x, y])
    if (Math.hypot(vx, vy) < 20) break
  }
  return out
}

export interface PenEvents {
  goal(): void
  save(): void
  miss(): void
  conceded(): void
  blocked(): void
}

/** Sends the ball. */
export function shoot(pen: Pen, ball: Ball, width: number, floor: number, pitch: Pitch, vx: number, vy: number) {
  const g = geo(width, floor, pitch)
  ball.vx = vx
  ball.vy = vy
  ball.floorHits = 0
  ball.touches = 0
  pen.phase = 'flight'
  pen.timer = 0
  pen.done = false
  pen.touched = false
  const hit = predict(g, ball.x, ball.y, vx, vy, pen.spin)
  // the keeper reads the shot with a little delay and a little error, and can only be so fast
  const k = pen.keeper
  const half = GOAL_W / 2
  if (hit) {
    const wild = Math.random() < 0.15 ? (Math.random() < 0.5 ? -80 : 80) : 0
    k.target = Math.max(g.center - half + 20, Math.min(g.center + half - 20, hit.lat + (Math.random() - 0.5) * 150 + wild))
  } else k.target = g.center
  k.delay = 0.2 + Math.random() * 0.22 + Math.min(0.2, Math.hypot(vx, vy) / 9000)
  k.speed = 380 + Math.random() * 200
}

const world = (width: number, floor: number): World => ({ width, floor, gravity: 0, restitution: 0.6, rolling: 0 })

/** One frame of the penalty game. */
export function step(pen: Pen, ball: Ball, dt: number, width: number, floor: number, pitch: Pitch, ev: PenEvents, pointer: { x: number; y: number } | null, back: boolean) {
  const g = geo(width, floor, pitch)
  const k = pen.keeper
  const half = GOAL_W / 2 - 16
  if (!k.pos) k.pos = g.center
  if (!pen.glove) pen.glove = g.center
  const posts = goalPosts(width, floor, pitch)
  const prevKeeper = k.pos
  const prevGlove = pen.glove
  // the glove follows the pointer along your own line (smoothed), always
  if (pointer) {
    const want = Math.max(g.center - half, Math.min(g.center + half, lat(g, pointer.x, pointer.y)))
    pen.glove += (want - pen.glove) * Math.min(1, dt * 16)
  }
  pen.gloveVel = dt > 0 ? (pen.glove - prevGlove) / dt : 0

  if (pen.phase === 'flight') {
    pen.timer += dt
    ;[ball.vx, ball.vy] = bend(ball.vx, ball.vy, pen.spin, dt)
    stepBall(ball, dt, world(width, floor), posts)
    if (pen.timer > k.delay) k.pos += Math.sign(k.target - k.pos) * Math.min(Math.abs(k.target - k.pos), k.speed * dt)
    k.vel = dt > 0 ? (k.pos - prevKeeper) / dt : 0
    const [kx, ky] = keeperPoint(g, pen)
    const kvx = pitch === 'horizontal' ? 0 : k.vel
    const kvy = pitch === 'horizontal' ? k.vel : 0
    // the keeper is solid: the ball bounces off him, and only then do we know what became of it
    if (!pen.done && bounceOffMover(ball, kx, ky, KEEPER_R, kvx, kvy, 0.45)) pen.touched = true
    if (!pen.done && inWhichGoal(ball, width, floor, pitch) === g.targetIdx) {
      pen.done = true
      pen.goals += 1
      pen.verdict = 'GOL!'
      ev.goal()
      end(pen, 1.4)
      return
    }
    if (!pen.done && (Math.hypot(ball.vx, ball.vy) < 25 || pen.timer > 6)) {
      pen.done = true
      if (pen.touched) {
        pen.saves += 1
        pen.verdict = 'KURTARDI!'
        ev.save()
      } else {
        pen.verdict = ball.touches > 0 ? 'DİREK!' : 'DIŞARI'
        ev.miss()
      }
      end(pen, 1.2)
    }
    return
  }

  if (pen.phase === 'result') {
    pen.timer -= dt
    ;[ball.vx, ball.vy] = bend(ball.vx, ball.vy, 0, dt)
    stepBall(ball, dt, world(width, floor), posts)
    k.pos += (g.center - k.pos) * Math.min(1, dt * 2.5)
    if (pen.timer <= 0) {
      pen.verdict = ''
      pen.spot = randomSpot(g, width, floor)
      Object.assign(ball, { x: pen.spot.x, y: pen.spot.y, vx: 0, vy: 0, floorHits: 0, touches: 0 })
      if (back) keeperShot(pen, width, floor, pitch)
      else pen.phase = 'ready'
    }
    return
  }

  if (pen.phase === 'return' || pen.phase === 'returned') {
    const b = pen.back
    if (!b) { pen.phase = 'ready'; return }
    ;[b.vx, b.vy] = bend(b.vx, b.vy, 0, dt)
    stepBall(b, dt, world(width, floor), posts)
    if (pen.phase === 'return') {
      pen.timer += dt
      const [gx, gy] = glovePoint(g, pen)
      const gvx = pitch === 'horizontal' ? 0 : pen.gloveVel
      const gvy = pitch === 'horizontal' ? pen.gloveVel : 0
      if (!pen.done && bounceOffMover(b, gx, gy, GLOVE_R, gvx, gvy, 0.45)) pen.touched = true
      if (!pen.done && inWhichGoal(b, width, floor, pitch) === g.ownIdx) {
        pen.done = true
        pen.conceded += 1
        pen.verdict = 'GOL YEDİN'
        ev.conceded()
        pen.phase = 'returned'
        pen.timer = 1.2
      } else if (!pen.done && (Math.hypot(b.vx, b.vy) < 25 || pen.timer > 6)) {
        pen.done = true
        pen.verdict = pen.touched ? 'KURTARDIN!' : 'DIŞARI'
        if (pen.touched) ev.blocked()
        pen.phase = 'returned'
        pen.timer = pen.touched ? 1.2 : 0.8
      }
    } else {
      pen.timer -= dt
      if (pen.timer <= 0) {
        pen.back = null
        pen.verdict = ''
        pen.phase = 'ready'
      }
    }
    return
  }
  // ready: the ball waits on its spot (unless it is being pulled back) and the keeper settles in the middle
  if (!pen.spot.x) pen.spot = randomSpot(g, width, floor)
  Object.assign(ball, { x: pen.spot.x, y: pen.spot.y, vx: 0, vy: 0 })
  k.pos += (g.center - k.pos) * Math.min(1, dt * 4)
}

/** After a shot has been decided: wait a moment. */
function end(pen: Pen, seconds: number) {
  pen.phase = 'result'
  pen.timer = seconds
}

/** Fires the keeper's return shot at your own goal. */
export function keeperShot(pen: Pen, width: number, floor: number, pitch: Pitch) {
  const g = geo(width, floor, pitch)
  const [ox, oy] = place(g, g.targetLine - g.sign * 90, g.center + (Math.random() - 0.5) * 120)
  const targetLat = g.center + (Math.random() - 0.5) * (GOAL_W - 60)
  const [tx, ty] = place(g, g.ownLine, targetLat)
  const dx = tx - ox, dy = ty - oy
  const L = Math.hypot(dx, dy)
  const T = 0.95 + Math.random() * 0.4
  const speed = (L * FRICTION) / (1 - Math.exp(-FRICTION * T))
  const b = makeBall(ox, oy, 15)
  b.vx = (dx / L) * speed
  b.vy = (dy / L) * speed
  pen.back = b
  pen.phase = 'return'
  pen.done = false
  pen.touched = false
  pen.timer = 0
  pen.verdict = ''
}
