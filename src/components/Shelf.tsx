import type { CSSProperties } from 'react'
import type { DockPosition } from '@/shared/types'

export interface Radii {
  tl: number
  tr: number
  bl: number
  br: number
}

type Pt = [number, number]

/** A closed path through `points` with every corner rounded by its own radius (clamped to what the edges allow). */
export function roundedPolygon(points: Pt[], radii: number[]): string {
  const n = points.length
  const entry: Pt[] = []
  const exit: Pt[] = []
  points.forEach((v, i) => {
    const prev = points[(i + n - 1) % n]
    const next = points[(i + 1) % n]
    const toPrev: Pt = [prev[0] - v[0], prev[1] - v[1]]
    const toNext: Pt = [next[0] - v[0], next[1] - v[1]]
    const lp = Math.hypot(...toPrev) || 1
    const ln = Math.hypot(...toNext) || 1
    const d = Math.max(0, Math.min(radii[i], lp / 2, ln / 2))
    entry.push([v[0] + (toPrev[0] / lp) * d, v[1] + (toPrev[1] / lp) * d])
    exit.push([v[0] + (toNext[0] / ln) * d, v[1] + (toNext[1] / ln) * d])
  })
  const f = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  let d = `M ${f(exit[0])}`
  for (let i = 1; i < n; i++) d += ` L ${f(entry[i])} Q ${f(points[i])} ${f(exit[i])}`
  d += ` L ${f(entry[0])} Q ${f(points[0])} ${f(exit[0])} Z`
  return d
}

/**
 * Outline of the whole shelf seen from the front: the sloping top (narrower at the back) and the front face under it,
 * one silhouette, so a rounded bottom corner cuts the thickness too.
 */
export function shelfPath(width: number, topHeight: number, edge: number, taper: number, r: Radii): string {
  const h = topHeight + edge
  const t = Math.min(taper, width / 2 - 2)
  const points: Pt[] = [
    [t, 0], // back left
    [width - t, 0], // back right
    [width, topHeight], // front right, where the slope meets the front face
    [width, h], // bottom right
    [0, h], // bottom left
    [0, topHeight], // front left
  ]
  return roundedPolygon(points, [r.tl, r.tr, edge > 0 ? 1.5 : r.br, r.br, r.bl, edge > 0 ? 1.5 : r.bl])
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
}

/**
 * A real shelf: sloping glass top (trapezoid, so the sides lean in), a lit rim along its edges and a solid front face
 * directly under the front edge, the way the macOS Dock draws it. Drawn once "from the front" and turned to suit
 * whichever screen edge the dock is on. Colours come from the desk style classes of the parent dock.
 */
export default function Shelf({ length, thickness, edge, depth, side, radii, opacity }: ShelfProps) {
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
        <div className="dock__shelf-front" style={{ top, height: edge, width: length }} />
        <div className="dock__desk dock__shelf-surface" style={{ width: length, height: top }}>
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
