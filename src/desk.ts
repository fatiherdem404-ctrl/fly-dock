import type { CSSProperties } from 'react'
import type { DeskStyle, DockPosition, DockSettings } from '@/shared/types'

/** How a hover animation splits the pointer's influence between growing icons and raising them off the desk. */
export function hoverProfile(s: Pick<DockSettings, 'hoverAnimation' | 'iconSize' | 'maxScale'>): { sizeGain: number; liftMax: number } {
  const grow = s.iconSize * (s.maxScale - 1)
  switch (s.hoverAnimation) {
    case 'lift':
      return { sizeGain: 0.25, liftMax: grow * 0.9 }
    case 'wave':
      return { sizeGain: 0.6, liftMax: grow * 0.55 }
    default:
      return { sizeGain: 1, liftMax: 0 }
  }
}

export const DESK_LABELS: Record<DeskStyle, string> = {
  glass: 'Koyu cam',
  azure: 'Mavi çerçeve',
  glass3d: '3B cam raf',
  wood: 'Ahşap',
  metal: 'Metal',
  marble: 'Mermer',
  neon: 'Neon',
  crystal: 'Kristal',
  matte: 'Mat siyah',
  mirror: 'Yansımalı zemin',
  wall: 'Tuğla',
}

/** Depth and opacity each style looks best with; picking a style in settings applies these. */
export const DESK_PRESETS: Record<DeskStyle, { depth: number; opacity: number; edge: number }> = {
  glass: { depth: 0, opacity: 1, edge: 0 },
  azure: { depth: 0, opacity: 1, edge: 0 },
  glass3d: { depth: 34, opacity: 0.95, edge: 8 },
  wood: { depth: 26, opacity: 1, edge: 10 },
  metal: { depth: 22, opacity: 1, edge: 8 },
  marble: { depth: 24, opacity: 1, edge: 8 },
  neon: { depth: 0, opacity: 1, edge: 0 },
  crystal: { depth: 30, opacity: 0.92, edge: 8 },
  matte: { depth: 18, opacity: 1, edge: 8 },
  mirror: { depth: 28, opacity: 0.95, edge: 8 },
  wall: { depth: 22, opacity: 1, edge: 10 },
}

const ORIGIN: Record<DockPosition, string> = { bottom: '50% 100%', top: '50% 0%', left: '0% 50%', right: '100% 50%' }

/** Tilt in degrees for a desk depth: more depth lays the desk down further. */
export function tiltFor(depth: number): number {
  return depth <= 0 ? 0 : Math.min(70, 28 + depth * 0.9)
}

/** The 3D transform that lays the desk down like a shelf seen from above and in front. */
export function deskTransform(depth: number, side: DockPosition): { transform?: string; transformOrigin?: string } {
  const tilt = tiltFor(depth)
  if (tilt === 0) return {}
  const stretch = 1 / Math.cos((tilt * Math.PI) / 180)
  const rotate = side === 'bottom' ? `rotateX(${tilt}deg)` : side === 'top' ? `rotateX(${-tilt}deg)` : side === 'left' ? `rotateY(${tilt}deg)` : `rotateY(${-tilt}deg)`
  const scale = side === 'bottom' || side === 'top' ? `scaleY(${stretch})` : `scaleX(${stretch})`
  return { transform: `perspective(640px) ${rotate} ${scale}`, transformOrigin: ORIGIN[side] }
}

/**
 * The four screen corners as the shelf sees them. The shelf is drawn with its front (screen-edge) side at the bottom
 * and then turned for the chosen edge, so each screen corner lands on a different shelf corner.
 */
export function shelfRadii(s: Pick<DockSettings, 'deskRadTL' | 'deskRadTR' | 'deskRadBL' | 'deskRadBR'>, side: DockPosition) {
  const { deskRadTL: tl, deskRadTR: tr, deskRadBL: bl, deskRadBR: br } = s
  switch (side) {
    case 'top': return { tl: bl, tr: br, bl: tl, br: tr } // flipped: the front is at the top of the screen
    case 'left': return { tl: tr, tr: br, bl: tl, br: bl } // turned clockwise: the front is the left edge
    case 'right': return { tl: bl, tr: tl, bl: br, br: tr } // turned counter-clockwise: the front is the right edge
    default: return { tl, tr, bl, br }
  }
}

/** Looks of the desk by style: the radii that suit the material (pill glass, a squarer wooden shelf). */
export const DESK_RADII: Record<DeskStyle, [number, number]> = {
  glass: [60, 60], azure: [60, 60], neon: [60, 60],
  glass3d: [14, 5], wood: [10, 4], metal: [10, 4], marble: [10, 4], crystal: [14, 5], matte: [10, 4], mirror: [14, 5], wall: [8, 3],
}

export function deskStyleVars(s: DockSettings, _thickness: number, _side: DockPosition): { rootVars: Record<string, string>; plate: CSSProperties } {
  return {
    rootVars: {
      '--desk-tint': s.deskColor || 'transparent',
      '--desk-opacity': String(s.deskOpacity),
      '--desk-depth': `${s.deskDepth}px`,
    },
    // a shelf (depth > 0) is drawn by the Shelf component; only the flat plate uses these
    plate: { opacity: s.deskOpacity, borderRadius: `${s.deskRadTL}px ${s.deskRadTR}px ${s.deskRadBR}px ${s.deskRadBL}px` },
  }
}
