// Pure dock maths, kept free of React and the DOM so it can be unit-tested (see tests/physics.test.mjs).
import type { AnimationCurve } from './shared/types'

/** Cosine falloff: 1 at distance 0, tapering smoothly to 0 at `radius`. */
export function falloff(distance: number, radius: number): number {
  if (distance >= radius) return 0
  return (Math.cos((distance / radius) * Math.PI) + 1) / 2
}

export interface SpringParams {
  /** Stiffness: higher settles faster. */
  k: number
  /** Damping ratio: 1 is critically damped (fastest approach without overshoot). */
  zeta: number
}

export const SPRINGS: Record<AnimationCurve, SpringParams> = {
  spring: { k: 700, zeta: 1 },
  bounce: { k: 380, zeta: 0.55 },
  ease: { k: 360, zeta: 1 },
  linear: { k: 1100, zeta: 1 },
}

const SUBSTEP = 1 / 240

/** Advances one spring by `dt` seconds. Sub-stepped so the result barely depends on the frame rate. */
export function stepSpring(x: number, v: number, target: number, dt: number, p: SpringParams): [number, number] {
  const damping = 2 * Math.sqrt(p.k) * p.zeta
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    v += (p.k * (target - x) - damping * v) * h
    x += v * h
  }
  return [x, v]
}

export const REST_EPSILON = 0.05

export function isSettled(x: number, v: number, target: number): boolean {
  return Math.abs(target - x) <= REST_EPSILON && Math.abs(v) <= REST_EPSILON
}

/** Target size of each slot for a pointer position in rest space (null = pointer away). */
export function targetSizes(opts: {
  restLeft: number[]
  restWidth: number[]
  separator: boolean[]
  pointer: number | null
  iconSize: number
  magnifiedSize: number
  radiusIcons: number
  gap: number
}): number[] {
  const { restLeft, restWidth, separator, pointer, iconSize, magnifiedSize, radiusIcons, gap } = opts
  const radius = (iconSize + gap) * radiusIcons * 1.15
  return restLeft.map((left, i) => {
    if (separator[i]) return restWidth[i]
    if (pointer === null) return iconSize
    return iconSize + falloff(Math.abs(pointer - (left + restWidth[i] / 2)), radius) * (magnifiedSize - iconSize)
  })
}

export interface RowLayout {
  /** Offset of each slot from the start of the row. */
  positions: number[]
  length: number
  /** Where the row starts, so the point under the pointer stays under the pointer. */
  start: number
}

/**
 * Lays the row out for the current slot sizes. The point of the rest row the pointer is over keeps its
 * screen position while the slots around it grow, like the macOS Dock.
 */
export function layoutRow(opts: {
  sizes: number[]
  restLeft: number[]
  restWidth: number[]
  gap: number
  restStart: number
  anchor: number
}): RowLayout {
  const { sizes, restLeft, restWidth, gap, restStart, anchor } = opts
  const positions: number[] = []
  let cursor = 0
  sizes.forEach((s, i) => {
    positions.push(cursor)
    cursor += s + (i < sizes.length - 1 ? gap : 0)
  })
  if (sizes.length === 0) return { positions, length: 0, start: restStart }
  let index = sizes.length - 1
  for (let i = 0; i < sizes.length; i++) {
    if (anchor <= restLeft[i] + restWidth[i] + gap / 2) {
      index = i
      break
    }
  }
  const frac = Math.min(Math.max((anchor - restLeft[index]) / restWidth[index], 0), 1)
  const mapped = positions[index] + frac * sizes[index]
  return { positions, length: cursor, start: restStart + anchor - mapped }
}
