// Size of the dock window, worked out from the settings so that nothing can ever be cut off:
// the biggest icon, its lift, the label above it, the desk padding and the 3D desk all fit, for every
// pointer position and on every side of the screen. Pure maths, unit-tested in tests/physics.test.mjs.
import type { DockSettings } from './shared/types'
import { layoutRow, targetSizes } from './physics'
import { hoverProfile } from './desk'

export interface Pads {
  /** Padding at the start / end of the row along the dock. */
  mainStart: number
  mainEnd: number
  /** Padding on the screen-edge side / the open side of the icons. */
  crossEdge: number
  crossFar: number
}

/** The four screen-side paddings, mapped onto the dock's own axes for the chosen edge. */
export function padsFor(s: Pick<DockSettings, 'position' | 'deskPadTop' | 'deskPadBottom' | 'deskPadLeft' | 'deskPadRight'>): Pads {
  const { deskPadTop: t, deskPadBottom: b, deskPadLeft: l, deskPadRight: r } = s
  switch (s.position) {
    case 'top': return { mainStart: l, mainEnd: r, crossEdge: t, crossFar: b }
    case 'left': return { mainStart: t, mainEnd: b, crossEdge: l, crossFar: r }
    case 'right': return { mainStart: t, mainEnd: b, crossEdge: r, crossFar: l }
    default: return { mainStart: l, mainEnd: r, crossEdge: b, crossFar: t }
  }
}

export const SEPARATOR_SHARE = 0.35
/** The desk stands one pixel off the window edge so its border on the screen-edge side is never clipped. */
export const DESK_INSET = 1

export const LABEL_MAX_WIDTH = 200

/** Height a label needs above (or beside) its icon: text, padding, the gap to the icon and a little air. */
export function labelRoom(s: Pick<DockSettings, 'labelMode' | 'labelSize'>): number {
  return s.labelMode === 'never' ? 0 : Math.ceil(s.labelSize * 1.4 + 8 + 8 + 6)
}

/** Width of the widest label, estimated from its length (labels are cut with an ellipsis at LABEL_MAX_WIDTH). */
export function labelWidth(s: Pick<DockSettings, 'labelMode' | 'labelSize'>, longestLabel: number): number {
  return s.labelMode === 'never' ? 0 : Math.min(LABEL_MAX_WIDTH, Math.ceil(longestLabel * s.labelSize * 0.62 + 24))
}

export interface Geometry {
  restLeft: number[]
  restWidth: number[]
  separator: boolean[]
  restLength: number
  pads: Pads
  /** Biggest an icon can get (px), including spring overshoot. */
  maxIcon: number
  liftMax: number
  /** Distance the icons stand off the screen edge (room for the reflection of a mirror desk). */
  baseOffset: number
  /** Front face of the desk (part of baseOffset). */
  edge: number
  /** Thickness of the desk at rest and when it is as thick as it can get. */
  restThickness: number
  maxThickness: number
  /** How far the row can stick out past its resting ends. */
  overshoot: number
  /** Window size along the dock and across it, and where the resting row starts inside the window. */
  main: number
  cross: number
  restStart: number
}

/**
 * A dock cannot be longer than the screen edge it sits on. When the settings ask for more, magnification
 * is eased first, then the icons are scaled down, until the window fits.
 */
export function fitToScreen(s: DockSettings, types: string[], flat: boolean, longestLabel: number, available: number): DockSettings {
  let cur = s
  for (let i = 0; i < 60; i++) {
    if (dockGeometry(cur, types, flat, longestLabel).main <= available) return cur
    cur =
      cur.magnification && cur.maxScale > 1.02
        ? { ...cur, maxScale: Math.max(1, Math.round((cur.maxScale - 0.05) * 100) / 100) }
        : { ...cur, iconSize: Math.max(16, Math.floor(cur.iconSize * 0.94)), iconSpacing: Math.floor(cur.iconSpacing * 0.9) }
  }
  return cur
}

export function dockGeometry(s: DockSettings, types: string[], flat: boolean, longestLabel = 0): Geometry {
  const iconSize = s.iconSize
  const gap = s.iconSpacing
  const pads = padsFor(s)
  const hover = hoverProfile(s)
  const scale = s.magnification ? s.maxScale : 1
  // the bouncy spring overshoots its target by about 13 % of the way travelled
  const bounce = s.animationCurve === 'bounce' ? 1.13 : 1
  const maxIcon = iconSize + (iconSize * scale - iconSize) * hover.sizeGain * bounce
  const liftMax = s.magnification ? hover.liftMax * bounce : 0

  const restLeft: number[] = []
  const restWidth: number[] = []
  let cursor = 0
  types.forEach((type, i) => {
    const w = type === 'separator' ? iconSize * SEPARATOR_SHARE : iconSize
    restLeft.push(cursor)
    restWidth.push(w)
    cursor += w + (i < types.length - 1 ? gap : 0)
  })
  const restLength = cursor
  const separator = types.map((t) => t === 'separator')

  // Worst case along the dock: how much wider the row can get. A quick flick of the pointer moves the anchor
  // before the icons have shrunk again, so the row can stick out by its whole widening on either side.
  let overshoot = 0
  if (s.magnification && types.length > 0) {
    const samples = 64
    for (let k = 0; k <= samples; k++) {
      const pointer = (restLength * k) / samples
      const sizes = targetSizes({ restLeft, restWidth, separator, pointer, iconSize, magnifiedSize: iconSize + (maxIcon - iconSize) / hover.sizeGain, radiusIcons: s.magnificationRadius, gap, curve: s.falloff, gain: hover.sizeGain })
      const row = layoutRow({ sizes, restLeft, restWidth, gap, restStart: 0, anchor: pointer })
      overshoot = Math.max(overshoot, row.length - restLength)
    }
  }
  overshoot = Math.ceil(overshoot) + 4

  // a shelf (depth > 0) has a front face; glass and mirror shelves also reflect the icons standing on them
  const shelf = s.deskDepth > 0 && !flat
  const reflect = (s.deskStyle === 'mirror' || s.deskStyle === 'glass3d') && !flat
  const edge = shelf ? Math.max(0, s.deskEdge) : 0
  const baseOffset = (reflect ? Math.round(iconSize * 0.4) : 0) + edge
  const restThickness = iconSize + pads.crossEdge + pads.crossFar + baseOffset
  const maxThickness = (s.shelfGrows ? maxIcon + liftMax : iconSize) + pads.crossEdge + pads.crossFar + baseOffset
  // The icons themselves stand on the edge-side padding; what pokes past the far side must fit too.
  const farExtent = baseOffset + pads.crossEdge + maxIcon + liftMax + pads.crossFar
  const deskReach = shelf ? 8 : 0 // the soft shadow under a shelf
  const vertical = s.position === 'left' || s.position === 'right'
  const labelW = labelWidth(s, longestLabel)
  // a label sits above a horizontal dock (needs height) and beside a vertical one (needs its width)
  const labelCross = vertical ? (labelW ? labelW + 8 : 0) : labelRoom(s)
  const cross = Math.ceil(Math.max(maxThickness, farExtent) + labelCross + deskReach + 6 + DESK_INSET * 2)
  const rowMain = restLength + 2 * (overshoot + Math.max(pads.mainStart, pads.mainEnd))
  // along a horizontal dock the widest label must also fit, even when the row itself is short
  const main = Math.ceil(vertical ? rowMain : Math.max(rowMain, labelW + 8))
  return {
    restLeft, restWidth, separator, restLength, pads, maxIcon, liftMax, baseOffset, edge,
    restThickness, maxThickness, overshoot, main, cross,
    restStart: (main - restLength) / 2,
  }
}
