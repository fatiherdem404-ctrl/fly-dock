// The football pitch seen from above: two goals, drawn in full inside the screen, either one on each side (horizontal)
// or one at the bottom and one at the top (vertical), like a real pitch. The ball slides and slows down on its own.
import type { Ball, Segment } from './ball'

export type Pitch = 'horizontal' | 'vertical'

export const GOAL_W = 230
export const GOAL_D = 78

export interface GoalBox {
  x: number
  y: number
  w: number
  h: number
}

/** The two goals as boxes inside the pitch (width x height of the playable area). */
export function goalBoxes(width: number, height: number, pitch: Pitch): [GoalBox, GoalBox] {
  if (pitch === 'horizontal') {
    const y = height / 2 - GOAL_W / 2
    return [
      { x: 0, y, w: GOAL_D, h: GOAL_W },
      { x: width - GOAL_D, y, w: GOAL_D, h: GOAL_W },
    ]
  }
  const x = width / 2 - GOAL_W / 2
  return [
    { x, y: 0, w: GOAL_W, h: GOAL_D },
    { x, y: height - GOAL_D, w: GOAL_W, h: GOAL_D },
  ]
}

/** The posts and the sides of both goals: the ball bounces off them, and can only get in through the mouth. */
export function goalPosts(width: number, height: number, pitch: Pitch): Segment[] {
  const out: Segment[] = []
  const [a, b] = goalBoxes(width, height, pitch)
  const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({ ax, ay, bx, by, restitution: 0.55 })
  for (const g of [a, b]) {
    if (pitch === 'horizontal') {
      const mouthX = g === a ? g.x + g.w : g.x
      out.push(seg(g.x, g.y, g.x + g.w, g.y), seg(g.x, g.y + g.h, g.x + g.w, g.y + g.h), seg(mouthX, g.y, mouthX, g.y), seg(mouthX, g.y + g.h, mouthX, g.y + g.h))
    } else {
      const mouthY = g === a ? g.y + g.h : g.y
      out.push(seg(g.x, g.y, g.x, g.y + g.h), seg(g.x + g.w, g.y, g.x + g.w, g.y + g.h), seg(g.x, mouthY, g.x, mouthY), seg(g.x + g.w, mouthY, g.x + g.w, mouthY))
    }
  }
  return out
}

/** Which goal the ball is in (0 = left / top, 1 = right / bottom), or -1. The whole ball has to be over the line. */
export function inWhichGoal(ball: Ball, width: number, height: number, pitch: Pitch): number {
  const boxes = goalBoxes(width, height, pitch)
  for (let i = 0; i < 2; i++) {
    const g = boxes[i]
    const inside = pitch === 'horizontal'
      ? ball.y > g.y + ball.r * 0.4 && ball.y < g.y + g.h - ball.r * 0.4 && (i === 0 ? ball.x < g.x + g.w - ball.r : ball.x > g.x + ball.r)
      : ball.x > g.x + ball.r * 0.4 && ball.x < g.x + g.w - ball.r * 0.4 && (i === 0 ? ball.y < g.y + g.h - ball.r : ball.y > g.y + ball.r)
    if (inside) return i
  }
  return -1
}

/** Slows a sliding ball down: grass, not ice. */
export function slide(ball: Ball, dt: number) {
  const k = Math.exp(-0.85 * dt)
  ball.vx *= k
  ball.vy *= k
  if (Math.hypot(ball.vx, ball.vy) < 6) {
    ball.vx = 0
    ball.vy = 0
  }
}
