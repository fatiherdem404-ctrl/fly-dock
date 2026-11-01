// The penalty game of the football toy: one goal on the right with a keeper in it. The ball is pulled back like a
// sling (the pull sets direction and power), the mouse wheel sets the curve ("falso") and the keeper dives after it.
// With the keeper's return shot on, he then fires one back at a goal on the left that the pointer defends.
import { Ball, World, stepBall } from './ball'

export const PEN_GOAL_H = 190
export const PEN_GOAL_D = 84
export const PEN_MAX_PULL = 230
const SPEED_PER_PX = 6.6
const GRAVITY = 1900
/** Sideways (vertical on screen) swerve of a curled ball, px/s² at full spin and 1000 px/s. */
const CURL = 900

export interface Pen {
  phase: 'ready' | 'flight' | 'result' | 'return' | 'returned'
  /** The pull that is being dragged: from the ball to the pointer. */
  aim: { x: number; y: number } | null
  spin: number
  timer: number
  keeper: { y: number; ty: number; delay: number; speed: number; reach: number; dive: number }
  /** The keeper's shot at your goal. */
  back: { x: number; y: number; vx: number; vy: number } | null
  glove: number
  goals: number
  saves: number
  conceded: number
  verdict: string
  /** Did the keeper's shot already get decided (so it is counted once)? */
  done: boolean
}

export const makePen = (): Pen => ({
  phase: 'ready', aim: null, spin: 0, timer: 0,
  keeper: { y: 0, ty: 0, delay: 0, speed: 540, reach: 40, dive: 0 },
  back: null, glove: 0, goals: 0, saves: 0, conceded: 0, verdict: '', done: false,
})

export const goalX = (width: number) => width - PEN_GOAL_D - 40
export const spotOf = (width: number, floor: number, r: number): [number, number] => [width * 0.3, floor - r]
const keeperRest = (floor: number) => floor - 46

/** The launch speed from a pull. */
export function launch(pull: { x: number; y: number }): { vx: number; vy: number; power: number } {
  const len = Math.hypot(pull.x, pull.y)
  const k = Math.min(len, PEN_MAX_PULL)
  const power = k / PEN_MAX_PULL
  if (len < 4) return { vx: 0, vy: 0, power: 0 }
  return { vx: (-pull.x / len) * k * SPEED_PER_PX, vy: (-pull.y / len) * k * SPEED_PER_PX, power }
}

/** Where the ball will be when it gets to x = line, ignoring the keeper: the same maths as the real flight, step by step. */
export function predict(x: number, y: number, vx: number, vy: number, spin: number, line: number, floor: number, r: number): { y: number; t: number } | null {
  let t = 0
  for (let i = 0; i < 400; i++) {
    const dt = 1 / 120
    vy += GRAVITY * dt + spin * CURL * (Math.abs(vx) / 1000) * dt
    x += vx * dt
    y += vy * dt
    t += dt
    if (y > floor - r) return null
    if (x >= line) return { y, t }
  }
  return null
}

/** The dotted path shown while aiming. */
export function path(x: number, y: number, vx: number, vy: number, spin: number, floor: number, r: number, count = 26): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < count * 5; i++) {
    const dt = 1 / 60
    vy += GRAVITY * dt + spin * CURL * (Math.abs(vx) / 1000) * dt
    x += vx * dt
    y += vy * dt
    if (y > floor - r) break
    if (i % 5 === 4) out.push([x, y])
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
export function shoot(pen: Pen, ball: Ball, width: number, floor: number, vx: number, vy: number) {
  ball.vx = vx
  ball.vy = vy
  ball.floorHits = 0
  ball.touches = 0
  pen.phase = 'flight'
  pen.timer = 0
  pen.done = false
  const line = goalX(width)
  const hit = predict(ball.x, ball.y, vx, vy, pen.spin, line, floor, ball.r)
  // the keeper reads the shot with a little delay and a little error, and can only be so fast
  const k = pen.keeper
  const top = floor - PEN_GOAL_H
  const aimAt = hit ? Math.max(top + 30, Math.min(floor - 36, hit.y + (Math.random() - 0.5) * 170 + (Math.random() < 0.15 ? (Math.random() < 0.5 ? -90 : 90) : 0))) : keeperRest(floor)
  k.ty = aimAt
  k.delay = 0.2 + Math.random() * 0.22 + Math.min(0.2, Math.hypot(vx, vy) / 9000)
  k.speed = 400 + Math.random() * 180
  k.dive = hit ? 1 : 0
}

/** One frame of the penalty game. The ball itself is moved with the usual physics, plus the curl. */
export function step(pen: Pen, ball: Ball, dt: number, width: number, floor: number, ev: PenEvents, glove: number) {
  const line = goalX(width)
  const top = floor - PEN_GOAL_H
  const k = pen.keeper
  pen.glove += (glove - pen.glove) * Math.min(1, dt * 14)
  if (k.y === 0) k.y = keeperRest(floor)

  if (pen.phase === 'flight') {
    pen.timer += dt
    // curl: a vertical swerve that grows with the speed along the ground
    ball.vy += pen.spin * CURL * (Math.abs(ball.vx) / 1000) * dt
    const world: World = { width: width * 2, floor, gravity: GRAVITY, restitution: 0.55, rolling: 0.9 }
    stepBall(ball, dt, world, [{ ax: line, ay: top, bx: width, by: top, restitution: 0.55 }])
    // the keeper
    if (pen.timer > k.delay && k.dive) k.y += Math.sign(k.ty - k.y) * Math.min(Math.abs(k.ty - k.y), k.speed * dt)
    else if (!k.dive) k.y += (keeperRest(floor) - k.y) * Math.min(1, dt * 4)
    const kx = line + 34
    if (!pen.done && Math.abs(ball.x - kx) < k.reach && Math.abs(ball.y - k.y) < 30 + ball.r * 0.5) {
      pen.done = true
      pen.saves += 1
      ball.vx = -Math.abs(ball.vx) * 0.35
      ball.vy = -260
      pen.verdict = 'KURTARDI!'
      ev.save()
      end(pen, 1.3)
      return
    }
    if (!pen.done && ball.x >= line + 6 && ball.y > top && ball.y < floor) {
      pen.done = true
      pen.goals += 1
      pen.verdict = 'GOL!'
      ev.goal()
      end(pen, 1.4)
      return
    }
    // gone: over the bar, behind the line high up, off the screen, or the ball has stopped
    if (!pen.done && (ball.x > width + 40 || ball.x < -40 || (ball.x > line && ball.y <= top - 6) || (pen.timer > 1 && Math.hypot(ball.vx, ball.vy) < 40))) {
      pen.done = true
      pen.verdict = 'DIŞARI'
      ev.miss()
      end(pen, 1.1)
    }
    return
  }

  if (pen.phase === 'result') {
    pen.timer -= dt
    stepBall(ball, dt, { width: width * 2, floor, gravity: GRAVITY, restitution: 0.5, rolling: 0.9 }, [])
    k.y += (keeperRest(floor) - k.y) * Math.min(1, dt * 3)
    if (pen.timer <= 0) {
      pen.verdict = ''
      const [sx, sy] = spotOf(width, floor, ball.r)
      Object.assign(ball, { x: sx, y: sy, vx: 0, vy: 0, floorHits: 0, touches: 0 })
      pen.phase = 'ready'
    }
    return
  }

  if (pen.phase === 'return') {
    // the keeper's shot at the goal on the left, which the pointer defends
    const b = pen.back
    if (!b) { pen.phase = 'ready'; return }
    b.vy += GRAVITY * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y > floor - 14) { b.y = floor - 14; b.vy *= -0.5 }
    const gx = 60
    if (!pen.done && b.x <= gx + 14) {
      pen.done = true
      const reach = 56
      if (Math.abs(b.y - pen.glove) < reach) {
        pen.verdict = 'KURTARDIN!'
        ev.blocked()
        b.vx = Math.abs(b.vx) * 0.4
        b.vy = -300
      } else if (b.y > top - 20) {
        pen.conceded += 1
        pen.verdict = 'GOL YEDİN'
        ev.conceded()
      } else {
        pen.verdict = 'DIŞARI'
      }
      pen.phase = 'returned'
      pen.timer = 1.2
    }
    if (b.x < -60) { pen.done = true; pen.phase = 'returned'; pen.timer = 0.6 }
    return
  }

  if (pen.phase === 'returned') {
    pen.timer -= dt
    const b = pen.back
    if (b) {
      b.vy += GRAVITY * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.y > floor - 14) { b.y = floor - 14; b.vy *= -0.4; b.vx *= 0.8 }
    }
    if (pen.timer <= 0) {
      pen.back = null
      pen.verdict = ''
      pen.phase = 'ready'
    }
    return
  }
  // ready: the ball waits on the spot (unless it is being pulled back) and the keeper bounces on his toes
  const [sx, sy] = spotOf(width, floor, ball.r)
  Object.assign(ball, { x: sx, y: sy, vx: 0, vy: 0 })
  k.y += (keeperRest(floor) - k.y) * Math.min(1, dt * 5)
}

/** After a shot has been decided: wait, then (maybe) the keeper's turn. */
function end(pen: Pen, seconds: number) {
  pen.phase = 'result'
  pen.timer = seconds
}

/** Fires the keeper's return shot at the left goal. */
export function keeperShot(pen: Pen, width: number, floor: number) {
  const x0 = goalX(width) - 30
  const y0 = floor - 60
  const gx = 60
  const speed = 760 + Math.random() * 420
  const T = (x0 - gx) / speed
  const target = floor - 20 - Math.random() * (PEN_GOAL_H - 40)
  pen.back = { x: x0, y: y0, vx: -speed, vy: (target - y0 - 0.5 * GRAVITY * T * T) / T }
  pen.phase = 'return'
  pen.done = false
  pen.verdict = ''
}
