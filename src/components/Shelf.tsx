import type { CSSProperties } from 'react'
import type { DeskShape, DockPosition } from '@/shared/types'

/** Outline of the shelf's top surface: a trapezoid, wide at the front (screen edge), narrower at the back. */
export function trapezoidPath(width: number, height: number, taper: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, height / 2, width / 4)) // back corners
  const rb = Math.min(r, 1.5) // front corners stay almost square so the front face joins them cleanly
  const t = Math.min(taper, width / 2 - r - 1)
  return [
    `M ${t + r} 0`,
    `L ${width - t - r} 0`,
    `Q ${width - t} 0 ${width - t + r * 0.45} ${r * 0.9}`,
    `L ${width - rb * 0.45} ${height - rb * 0.9}`,
    `Q ${width} ${height} ${width - rb} ${height}`,
    `L ${rb} ${height}`,
    `Q 0 ${height} ${rb * 0.45} ${height - rb * 0.9}`,
    `L ${t - r * 0.45} ${r * 0.9}`,
    `Q ${t} 0 ${t + r} 0`,
    'Z',
  ].join(' ')
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
  shape: DeskShape
  opacity: number
}

/**
 * A real shelf: sloping glass top (trapezoid, so the sides lean in), a lit rim along its edges and a solid front face
 * directly under the front edge, the way the macOS Dock draws it. Drawn once "from the front" and turned to suit
 * whichever screen edge the dock is on. Colours come from the desk style classes of the parent dock.
 */
export default function Shelf({ length, thickness, edge, depth, side, shape, opacity }: ShelfProps) {
  const top = Math.max(1, thickness - edge)
  const taper = shelfTaper(depth, top, length)
  const radius = shape === 'square' ? 2 : shape === 'rounded' ? 7 : Math.min(14, top / 2.4)
  const d = trapezoidPath(length, top, taper, radius)
  const frontRadius = shape === 'square' ? 0 : Math.min(edge / 2, 6)

  const vertical = side === 'left' || side === 'right'
  const turn: CSSProperties = vertical
    ? { left: '50%', top: '50%', width: length, height: thickness, transform: `translate(-50%, -50%) rotate(${side === 'left' ? 90 : -90}deg)` }
    : { left: 0, top: 0, width: length, height: thickness, transform: side === 'top' ? 'scaleY(-1)' : undefined }

  return (
    <div className="dock__shelf" style={{ ...turn, opacity }}>
      <div className="dock__shelf-front" style={{ top, height: edge, width: length, borderRadius: `0 0 ${frontRadius}px ${frontRadius}px` }} />
      <div className="dock__desk dock__shelf-surface" style={{ width: length, height: top, clipPath: `path('${d}')` }}>
        <span className="dock__desk-tint" />
        <span className="dock__desk-sheen" />
      </div>
      <svg className="dock__shelf-lines" width={length} height={top} viewBox={`0 0 ${length} ${top}`} aria-hidden="true">
        <path d={d} fill="none" className="dock__shelf-outline" />
      </svg>
    </div>
  )
}
