// Pure dock maths, kept free of React and the DOM so it can be unit-tested (see tests/physics.test.mjs).
import type { AnimationCurve, FalloffCurve, SpeedPreset } from './shared/types'

/** Influence of the pointer on a slot: 1 at distance 0, tapering to 0 at `radius`, in one of four shapes. */
export function falloff(distance: number, radius: number, curve: FalloffCurve = 'cosine'): number {
  if (distance >= radius) return 0
  const t = distance / radius
  switch (curve) {
    case 'linear':
      return 1 - t
    case 'sharp':
      return ((Math.cos(t * Math.PI) + 1) / 2) ** 2
    case 'gaussian': {
      const edge = Math.exp(-4.5)
      return (Math.exp(-4.5 * t * t) - edge) / (1 - edge)
    }
    default:
      return (Math.cos(t * Math.PI) + 1) / 2
  }
}

const SPEED_MS: Record<Exclude<SpeedPreset, 'custom'>, number> = { fast: 220, medium: 350, slow: 600 }

/** How long a spring should take to settle for the chosen speed setting. */
export function speedToMs(speed: SpeedPreset, customMs: number): number {
  return speed === 'custom' ? Math.min(Math.max(customMs, 80), 2000) : SPEED_MS[speed]
}

/** Spring parameters for a motion type, stiffened or relaxed so it settles in about `ms` (350 ms is the baseline). */
export function springFor(curve: AnimationCurve, ms: number): SpringParams {
  const base = SPRINGS[curve]
  return { k: base.k * (350 / ms) ** 2, zeta: base.zeta }
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
  curve?: FalloffCurve
  /** Share of the size gain that is applied (the lift animations grow icons less). */
  gain?: number
}): number[] {
  const { restLeft, restWidth, separator, pointer, iconSize, magnifiedSize, radiusIcons, gap, curve = 'cosine', gain = 1 } = opts
  const radius = (iconSize + gap) * radiusIcons * 1.15
  return restLeft.map((left, i) => {
    if (separator[i]) return restWidth[i]
    if (pointer === null) return iconSize
    return iconSize + falloff(Math.abs(pointer - (left + restWidth[i] / 2)), radius, curve) * (magnifiedSize - iconSize) * gain
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

/** How far each slot rises off the desk (px) for the lift and wave animations. */
export function targetLifts(opts: {
  restLeft: number[]
  restWidth: number[]
  separator: boolean[]
  pointer: number | null
  iconSize: number
  radiusIcons: number
  gap: number
  curve?: FalloffCurve
  liftMax: number
}): number[] {
  const { restLeft, restWidth, separator, pointer, iconSize, radiusIcons, gap, curve = 'cosine', liftMax } = opts
  const radius = (iconSize + gap) * radiusIcons * 1.15
  return restLeft.map((left, i) => {
    if (separator[i] || pointer === null) return 0
    return falloff(Math.abs(pointer - (left + restWidth[i] / 2)), radius, curve) * liftMax
  })
}
