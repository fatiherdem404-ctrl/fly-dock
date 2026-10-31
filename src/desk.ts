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
export const DESK_PRESETS: Record<DeskStyle, { depth: number; opacity: number }> = {
  glass: { depth: 0, opacity: 1 },
  azure: { depth: 0, opacity: 1 },
  glass3d: { depth: 34, opacity: 0.95 },
  wood: { depth: 26, opacity: 1 },
  metal: { depth: 22, opacity: 1 },
  marble: { depth: 24, opacity: 1 },
  neon: { depth: 0, opacity: 1 },
  crystal: { depth: 30, opacity: 0.92 },
  matte: { depth: 18, opacity: 1 },
  mirror: { depth: 28, opacity: 0.95 },
  wall: { depth: 22, opacity: 1 },
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

export function deskStyleVars(s: DockSettings, _thickness: number, side: DockPosition): { rootVars: Record<string, string>; plate: CSSProperties } {
  return {
    rootVars: {
      '--desk-tint': s.deskColor || 'transparent',
      '--desk-opacity': String(s.deskOpacity),
      '--desk-depth': `${s.deskDepth}px`,
    },
    plate: { ...deskTransform(s.deskDepth, side), opacity: s.deskOpacity, borderRadius: s.deskShape === 'pill' ? '999px' : s.deskShape === 'square' ? '6px' : undefined },
  }
}
