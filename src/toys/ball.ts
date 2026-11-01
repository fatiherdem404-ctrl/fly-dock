// Ball physics for the desktop toys (basketball, football, tennis). Pure functions on plain objects so the maths can be
// tested without a window. Units are pixels and seconds; y grows downwards and the floor is a horizontal line.

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Visual spin in radians, advanced from the rolling speed. */
  angle: number
  /** True while the user holds it: physics leaves it alone. */
  grabbed: boolean
  /** Floor hits since the pointer last touched the ball (tennis counts rallies with it). */
  floorHits: number
}

export interface World {
  width: number
  /** y of the floor line (the top of the dock, or the bottom of the work area). */
  floor: number
  gravity: number
  /** Bounciness 0..1 for floor and walls. */
  restitution: number
  /** Share of horizontal speed lost per second while rolling on the floor. */
  rolling: number
}

/** A straight wall piece the ball bounces off; a zero-length one is a post or a rim end. */
export interface Segment {
  ax: number
  ay: number
  bx: number
  by: number
  restitution: number
}

export const MAX_SPEED = 3200

export function makeBall(x: number, y: number, r: number): Ball {
  return { x, y, vx: 0, vy: 0, r, angle: 0, grabbed: false, floorHits: 0 }
}

/** Pushes the ball out of a segment and reflects its speed along the contact normal. Returns true on contact. */
export function collideSegment(ball: Ball, s: Segment): boolean {
  const dx = s.bx - s.ax
  const dy = s.by - s.ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((ball.x - s.ax) * dx + (ball.y - s.ay) * dy) / len2))
  const px = s.ax + dx * t
  const py = s.ay + dy * t
  let nx = ball.x - px
  let ny = ball.y - py
  const dist = Math.hypot(nx, ny)
  if (dist >= ball.r) return false
  if (dist === 0) {
    nx = 0
    ny = -1
  } else {
    nx /= dist
    ny /= dist
  }
  ball.x = px + nx * ball.r
  ball.y = py + ny * ball.r
  const vn = ball.vx * nx + ball.vy * ny
  if (vn < 0) {
    ball.vx -= (1 + s.restitution) * vn * nx
    ball.vy -= (1 + s.restitution) * vn * ny
  }
  return true
}

function substep(ball: Ball, dt: number, world: World, segments: Segment[]) {
  ball.vy += world.gravity * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  const e = world.restitution
  if (ball.x < ball.r) {
    ball.x = ball.r
    ball.vx = Math.abs(ball.vx) * e
  } else if (ball.x > world.width - ball.r) {
    ball.x = world.width - ball.r
    ball.vx = -Math.abs(ball.vx) * e
  }
  if (ball.y < ball.r) {
    ball.y = ball.r
    ball.vy = Math.abs(ball.vy) * e
  }
  for (const s of segments) collideSegment(ball, s)
  if (ball.y > world.floor - ball.r) {
    ball.y = world.floor - ball.r
    if (ball.vy > 90) {
      ball.vy = -ball.vy * e
      ball.floorHits += 1
    } else {
      ball.vy = 0
    }
    if (ball.vy === 0) ball.vx *= Math.max(0, 1 - world.rolling * dt)
  }
}

/** Advances a free ball; fast balls are split into small steps so they never tunnel through a wall. */
export function stepBall(ball: Ball, dt: number, world: World, segments: Segment[] = []) {
  if (ball.grabbed) return
  const dtc = Math.min(dt, 0.05)
  const speed = Math.hypot(ball.vx, ball.vy)
  const steps = Math.max(1, Math.min(16, Math.ceil((speed * dtc) / (ball.r * 0.5))))
  for (let i = 0; i < steps; i++) substep(ball, dtc / steps, world, segments)
  const v = Math.hypot(ball.vx, ball.vy)
  if (v > MAX_SPEED) {
    ball.vx *= MAX_SPEED / v
    ball.vy *= MAX_SPEED / v
  }
  ball.angle += (ball.vx / ball.r) * dtc
}

/**
 * The pointer as a moving circle: when it runs into the ball fast enough it gives the ball a push along the contact
 * line. Returns true when the ball was hit. A resting pointer never moves the ball.
 */
export function kickBall(ball: Ball, px: number, py: number, pvx: number, pvy: number, minSpeed = 260, pointerR = 9): boolean {
  const dx = ball.x - px
  const dy = ball.y - py
  const dist = Math.hypot(dx, dy)
  if (dist >= ball.r + pointerR || dist === 0) return false
  const nx = dx / dist
  const ny = dy / dist
  const approach = pvx * nx + pvy * ny // pointer speed towards the ball
  if (approach < minSpeed * 0.5 || Math.hypot(pvx, pvy) < minSpeed) return false
  ball.vx = ball.vx * 0.2 + nx * approach * 1.25 + pvx * 0.25
  ball.vy = ball.vy * 0.2 + ny * approach * 1.25 + pvy * 0.25
  ball.x = px + nx * (ball.r + pointerR)
  ball.y = py + ny * (ball.r + pointerR)
  ball.floorHits = 0
  const v = Math.hypot(ball.vx, ball.vy)
  if (v > MAX_SPEED) {
    ball.vx *= MAX_SPEED / v
    ball.vy *= MAX_SPEED / v
  }
  return true
}

/** Throw speed from the last pointer samples [x, y, t(ms)]: the average over the final ~90 ms. */
export function throwVelocity(samples: [number, number, number][]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  let first = samples[0]
  for (const s of samples) {
    if (last[2] - s[2] <= 90) {
      first = s
      break
    }
  }
  const dt = (last[2] - first[2]) / 1000
  if (dt <= 0) return { vx: 0, vy: 0 }
  const clamp = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v))
  return { vx: clamp((last[0] - first[0]) / dt), vy: clamp((last[1] - first[1]) / dt) }
}

/** Did the ball come down through the rim opening between its two ends this step? */
export function scoredThroughRim(prevY: number, ball: Ball, rimY: number, leftX: number, rightX: number): boolean {
  return ball.vy > 0 && prevY < rimY && ball.y >= rimY && ball.x > leftX + 4 && ball.x < rightX - 4
}

/** Counts a goal when the ball sits inside a goal mouth. */
export function inGoal(ball: Ball, side: 'left' | 'right', width: number, depth: number, floor: number, height: number): boolean {
  const inside = side === 'left' ? ball.x < depth : ball.x > width - depth
  return inside && ball.y > floor - height + ball.r * 0.5
}

/**
 * A solid circle that moves (a racket head, the toe of a boot) running into the ball: the ball is pushed out of it and
 * bounces off like off a moving wall, so a resting racket still returns a falling ball and a swung one sends it flying.
 * Returns true on contact.
 */
export function bounceOffMover(ball: Ball, cx: number, cy: number, cr: number, cvx: number, cvy: number, restitution = 0.85): boolean {
  const dx = ball.x - cx
  const dy = ball.y - cy
  const dist = Math.hypot(dx, dy)
  const reach = ball.r + cr
  if (dist >= reach || dist === 0) return false
  const nx = dx / dist
  const ny = dy / dist
  ball.x = cx + nx * reach
  ball.y = cy + ny * reach
  const rel = (ball.vx - cvx) * nx + (ball.vy - cvy) * ny
  if (rel < 0) {
    ball.vx -= (1 + restitution) * rel * nx
    ball.vy -= (1 + restitution) * rel * ny
  }
  ball.floorHits = 0
  const v = Math.hypot(ball.vx, ball.vy)
  if (v > MAX_SPEED) {
    ball.vx *= MAX_SPEED / v
    ball.vy *= MAX_SPEED / v
  }
  return true
}
