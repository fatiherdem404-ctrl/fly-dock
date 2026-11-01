// The basketball's "hoop across the screen" mode: the ball waits on a spot, the pull sets power and (through its
// direction) the height of the arc, and a dotted line can show where it will go.

export const SHOT_MAX_PULL = 230
const SPEED_PER_PX = 6.4

export interface Shot {
  /** The ball's pull while it is being aimed: from the ball to the pointer. */
  aim: { x: number; y: number } | null
  state: 'ready' | 'flight'
  /** Where the ball waits (x), and the time the current shot has been flying. */
  spotX: number
  t: number
  scored: boolean
  /** Counts down once a shot is over, then the ball goes back to a new spot. */
  end: number
}

export const makeShot = (): Shot => ({ aim: null, state: 'ready', spotX: 0, t: 0, scored: false, end: 0 })

/** The launch speed of a pull, how hard it is (0..1) and how steep (0 flat .. 1 straight up). */
export function launchShot(pull: { x: number; y: number }): { vx: number; vy: number; power: number; height: number } {
  const len = Math.hypot(pull.x, pull.y)
  if (len < 4) return { vx: 0, vy: 0, power: 0, height: 0 }
  const k = Math.min(len, SHOT_MAX_PULL)
  const vx = (-pull.x / len) * k * SPEED_PER_PX
  const vy = (-pull.y / len) * k * SPEED_PER_PX
  const angle = Math.atan2(-vy, Math.abs(vx))
  return { vx, vy, power: k / SHOT_MAX_PULL, height: Math.max(0, Math.min(1, angle / (Math.PI / 2))) }
}

/** The dotted path of a shot: the same gravity the real ball feels, until it would reach the floor. */
export function shotPath(x: number, y: number, vx: number, vy: number, gravity: number, floor: number, r: number, count = 30): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < count * 4; i++) {
    const dt = 1 / 60
    vy += gravity * dt
    x += vx * dt
    y += vy * dt
    if (y > floor - r) break
    if (i % 4 === 3) out.push([x, y])
  }
  return out
}

/** A new waiting spot on the far side of the screen from the hoop, some of them behind the three-point line. */
export function pickSpot(width: number, side: 'left' | 'right'): number {
  const f = 0.1 + Math.random() * 0.5
  return side === 'right' ? width * f : width * (1 - f)
}
