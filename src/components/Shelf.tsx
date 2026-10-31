import type { CSSProperties } from 'react'
import type { DockPosition } from '@/shared/types'

export interface Radii {
  tl: number
  tr: number
  bl: number
  br: number
}

type Pt = [number, number]

const len = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1])
const toward = (p: Pt, q: Pt, d: number): Pt => {
  const l = len(p, q) || 1
  return [p[0] + ((q[0] - p[0]) / l) * d, p[1] + ((q[1] - p[1]) / l) * d]
}

/** Point `d` px along a polyline, and how many of its vertices (after the first) were walked past. */
function walk(chain: Pt[], d: number): { point: Pt; passed: number } {
  let left = d
  for (let i = 0; i < chain.length - 1; i++) {
    const l = len(chain[i], chain[i + 1])
    if (left <= l) return { point: toward(chain[i], chain[i + 1], left), passed: i }
    left -= l
  }
  return { point: chain[chain.length - 1], passed: chain.length - 2 }
}

/**
 * Outline of the whole shelf seen from the front: the sloping top (narrower at the back) and the front face under it,
 * one silhouette, so a rounded bottom corner cuts the thickness too. A bottom radius bigger than the front face is
 * thick keeps going up along the sloping side, so the slider always has a visible effect.
 */
export function shelfPath(width: number, topHeight: number, edge: number, taper: number, r: Radii): string {
  const h = topHeight + edge
  const t = Math.min(taper, width / 2 - 2)
  const f = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  const backL: Pt = [t, 0]
  const backR: Pt = [width - t, 0]
  const frontTopR: Pt = [width, topHeight]
  const frontTopL: Pt = [0, topHeight]
  const botR: Pt = [width, h]
  const botL: Pt = [0, h]
  const hasFace = edge > 0.5

  // right and left sides, walked upward from the bottom corner
  const sideR = hasFace ? [botR, frontTopR, backR] : [botR, backR]
  const sideL = hasFace ? [botL, frontTopL, backL] : [botL, backL]
  const slant = len(backR, hasFace ? frontTopR : botR)
  const maxUp = (chain: Pt[]) => (chain.length === 3 ? len(chain[0], chain[1]) + slant * 0.55 : slant * 0.55)
  const bottomLen = width
  const rbr = Math.max(0, Math.min(r.br, maxUp(sideR), bottomLen / 2))
  const rbl = Math.max(0, Math.min(r.bl, maxUp(sideL), bottomLen / 2))
  const upR = walk(sideR, rbr)
  const upL = walk(sideL, rbl)
  const consumedR = hasFace && upR.passed >= 1 // the corner between slope and front face was rounded away
  const consumedL = hasFace && upL.passed >= 1

  // back corners: limited by the top edge and by what is left of the sloping side
  const topLen = len(backL, backR)
  const slantLeftR = Math.max(0, slant - (consumedR ? rbr - edge : 0))
  const slantLeftL = Math.max(0, slant - (consumedL ? rbl - edge : 0))
  const rtr = Math.max(0, Math.min(r.tr, topLen / 2, slantLeftR / 2))
  const rtl = Math.max(0, Math.min(r.tl, topLen / 2, slantLeftL / 2))
  const small = hasFace ? Math.min(1.5, edge / 2) : 0

  let d = `M ${f(toward(backL, backR, rtl))} L ${f(toward(backR, backL, rtr))}`
  const afterBackR = toward(backR, hasFace ? frontTopR : botR, rtr)
  d += ` Q ${f(backR)} ${f(afterBackR)}`
  if (hasFace && !consumedR) {
    d += ` L ${f(toward(frontTopR, backR, small))} Q ${f(frontTopR)} ${f(toward(frontTopR, botR, small))}`
  }
  d += ` L ${f(upR.point)} Q ${f(botR)} ${f(toward(botR, botL, rbr))}`
  d += ` L ${f(toward(botL, botR, rbl))} Q ${f(botL)} ${f(upL.point)}`
  if (hasFace && !consumedL) {
    d += ` L ${f(toward(frontTopL, botL, small))} Q ${f(frontTopL)} ${f(toward(frontTopL, backL, small))}`
  }
  d += ` L ${f(toward(backL, hasFace ? frontTopL : botL, rtl))} Q ${f(backL)} ${f(toward(backL, backR, rtl))} Z`
  return d
}

export const shelfTaper = (depth: number, plateHeight: number, length: number) => Math.max(0, Math.min(depth * 0.9, plateHeight * 1.3, length * 0.25))

interface ShelfProps {
  length: number
  /** Whole thickness: the sloping top surface plus the front face. */
  thickness: number
  /** Height of the front face (the glass edge you see from the front). */
  edge: number
  depth: number
  side: DockPosition
  /** Corner radii in the shelf's own frame (bottom = the screen-edge side). */
  radii: Radii
  opacity: number
  /** Draw the user's own texture on the top and front (the 'custom' desk style). */
  textured?: boolean
  mode?: 'tile' | 'fit'
}

/**
 * A real shelf: sloping glass top (trapezoid, so the sides lean in), a lit rim along its edges and a solid front face
 * directly under the front edge, the way the macOS Dock draws it. Drawn once "from the front" and turned to suit
 * whichever screen edge the dock is on. Colours come from the desk style classes of the parent dock.
 */
export default function Shelf({ length, thickness, edge, depth, side, radii, opacity, textured = false, mode = 'tile' }: ShelfProps) {
  const layer = textured ? <span className={`dock__desk-texture dock__desk-texture--${mode}`} /> : null
  const top = Math.max(1, thickness - edge)
  const taper = shelfTaper(depth, top, length)
  const d = shelfPath(length, top, edge, taper, radii)

  const vertical = side === 'left' || side === 'right'
  const turn: CSSProperties = vertical
    ? { left: '50%', top: '50%', width: length, height: thickness, transform: `translate(-50%, -50%) rotate(${side === 'left' ? 90 : -90}deg)` }
    : { left: 0, top: 0, width: length, height: thickness, transform: side === 'top' ? 'scaleY(-1)' : undefined }

  return (
    <div className="dock__shelf" style={{ ...turn, opacity }}>
      <div className="dock__shelf-clip" style={{ width: length, height: thickness, clipPath: `path('${d}')` }}>
        <div className="dock__shelf-front" style={{ top, height: edge, width: length }}>{layer}</div>
        <div className="dock__desk dock__shelf-surface" style={{ width: length, height: top }}>
          {layer}
          <span className="dock__desk-tint" />
          <span className="dock__desk-sheen" />
        </div>
      </div>
      <svg className="dock__shelf-lines" width={length} height={thickness} viewBox={`0 0 ${length} ${thickness}`} aria-hidden="true">
        <path d={d} fill="none" className="dock__shelf-outline" />
        {edge > 0 && <path d={`M 0 ${top} L ${length} ${top}`} fill="none" className="dock__shelf-front-edge" />}
      </svg>
    </div>
  )
}
