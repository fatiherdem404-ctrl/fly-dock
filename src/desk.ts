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
  none: 'Rafsız (boş)',
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
  custom: 'Özel doku',
}

/** Depth and opacity each style looks best with; picking a style in settings applies these. */
export const DESK_PRESETS: Record<DeskStyle, { depth: number; opacity: number; edge: number; scale: number }> = {
  none: { depth: 0, opacity: 1, edge: 0, scale: 100 },
  glass: { depth: 0, opacity: 1, edge: 0, scale: 100 },
  azure: { depth: 0, opacity: 1, edge: 0, scale: 100 },
  glass3d: { depth: 34, opacity: 0.95, edge: 8, scale: 100 },
  wood: { depth: 26, opacity: 1, edge: 10, scale: 80 },
  metal: { depth: 22, opacity: 1, edge: 8, scale: 100 },
  marble: { depth: 24, opacity: 1, edge: 8, scale: 55 },
  neon: { depth: 0, opacity: 1, edge: 0, scale: 100 },
  crystal: { depth: 30, opacity: 0.92, edge: 8, scale: 70 },
  matte: { depth: 18, opacity: 1, edge: 8, scale: 100 },
  mirror: { depth: 28, opacity: 0.95, edge: 8, scale: 100 },
  wall: { depth: 22, opacity: 1, edge: 10, scale: 80 },
  custom: { depth: 28, opacity: 1, edge: 8, scale: 100 },
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
  none: [0, 0], glass: [60, 60], azure: [60, 60], neon: [60, 60],
  glass3d: [14, 5], wood: [10, 4], metal: [10, 4], marble: [10, 4], crystal: [14, 5], matte: [10, 4], mirror: [14, 5], wall: [8, 3], custom: [10, 4],
}

export interface DeskTexture {
  url: string
  w: number
  h: number
}

/** The separator look for the current desk when the setting is "auto": what reads best on that material. */
export function separatorKind(s: Pick<DockSettings, 'separatorStyle' | 'deskStyle' | 'deskDepth'>): 'line' | 'groove' | 'dots' | 'glow' | 'none' {
  if (s.separatorStyle !== 'auto') return s.separatorStyle
  switch (s.deskStyle) {
    case 'neon':
    case 'azure':
      return 'glow'
    case 'wood':
    case 'metal':
    case 'marble':
    case 'wall':
    case 'custom':
    case 'matte':
      return 'groove'
    default:
      return 'line'
  }
}

/**
 * Size and look of the separator bar from the settings: its length along the dock, and the CSS variables the
 * stylesheet reads (thickness, colour, roundness, left/right borders). Anything left at its default is not set,
 * so the look chosen for the desk stays in charge.
 */
export function separatorStyle(s: DockSettings, slot: number): { length: number; vars: Record<string, string> } {
  const vars: Record<string, string> = {}
  const borders = Math.max(0, s.sepBorderL) + Math.max(0, s.sepBorderR)
  // the bar must fit in its slot and be wide enough to show its borders
  const wanted = s.sepThickness > 0 ? s.sepThickness : 0
  if (wanted || borders) vars['--sep-w'] = `${Math.min(Math.max(wanted, borders + 1), Math.max(2, slot - 2))}px`
  if (s.sepColor) vars['--sep-fill'] = s.sepColor
  if (s.sepRadius !== 2) vars['--sep-r'] = `${s.sepRadius}px`
  if (s.sepBorderL > 0) vars['--sep-bl'] = `${s.sepBorderL}px`
  if (s.sepBorderR > 0) vars['--sep-br'] = `${s.sepBorderR}px`
  if (s.sepBorderLColor) vars['--sep-blc'] = s.sepBorderLColor
  if (s.sepBorderRColor) vars['--sep-brc'] = s.sepBorderRColor
  return { length: (s.iconSize * Math.min(Math.max(s.sepHeight, 10), 100)) / 100, vars }
}

export function deskStyleVars(s: DockSettings, _thickness: number, _side: DockPosition, texture: DeskTexture | null = null): { rootVars: Record<string, string>; plate: CSSProperties } {
  return {
    rootVars: {
      '--tex-scale': String(s.deskTexScale / 100),
      ...(texture && s.deskStyle === 'custom'
        ? { '--tex-url': `url("${texture.url}")`, '--tex-w': String(texture.w), '--tex-h': String(texture.h), '--tex-x': String(s.deskTexX), '--tex-y': String(s.deskTexY), '--tex-rot': String(s.deskTexRotate) }
        : {}),
      '--desk-tint': s.deskColor || 'transparent',
      '--desk-opacity': String(s.deskOpacity),
      '--desk-depth': `${s.deskDepth}px`,
    },
    // a shelf (depth > 0) is drawn by the Shelf component; only the flat plate uses these
    plate: { opacity: s.deskOpacity, borderRadius: `${s.deskRadTL}px ${s.deskRadTR}px ${s.deskRadBR}px ${s.deskRadBL}px` },
  }
}
