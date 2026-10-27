import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DockItem, DockSettings, RunningState } from '@/shared/types'
import { invoke } from '@/api'
import { SPRINGS, isSettled, layoutRow, stepSpring, targetSizes } from '@/physics'
import DockIcon from './DockIcon'

interface DockProps {
  items: DockItem[]
  settings: DockSettings
  running: RunningState
  icons: Record<string, string>
  launching: Set<string>
  hidden: boolean
  flat: boolean
  onActivate: (item: DockItem) => void
}

const GAP = 8 // px between icons at rest
const PAD = 10 // surface padding along the dock axis
const PAD_CROSS = 8 // surface padding on the cross axis
const SEPARATOR = 0.35 // separator width as a share of the icon size
const TOOLTIP_ROOM = 34

const DRAG_TYPE = 'application/x-dock-item'

declare global {
  interface Window {
    /** Frame times (ms) of the last animation frames; read by the perf check. */
    __dockFrames?: number[]
  }
}

export default function Dock({ items, settings, running, icons, launching, hidden, flat, onActivate }: DockProps) {
  const horizontal = settings.position === 'bottom' || settings.position === 'top'
  const { iconSize, magnifiedSize } = settings

  // ---- rest layout (no magnification): the stable coordinate space for pointer maths ----
  const rest = useMemo(() => {
    let cursor = 0
    const left: number[] = []
    const width: number[] = []
    items.forEach((item, i) => {
      const w = item.type === 'separator' ? iconSize * SEPARATOR : iconSize
      left.push(cursor)
      width.push(w)
      cursor += w + (i < items.length - 1 ? GAP : 0)
    })
    return { left, width, length: cursor, separator: items.map((i) => i.type === 'separator') }
  }, [items, iconSize])

  const growth = (magnifiedSize - iconSize) * (settings.magnificationRadius + 1) * 0.5 + 12
  const restThickness = iconSize + PAD_CROSS * 2
  const maxThickness = magnifiedSize + PAD_CROSS * 2
  const windowMain = Math.ceil(rest.length + PAD * 2 + growth * 2)
  const windowCross = Math.ceil(maxThickness + TOOLTIP_ROOM + 6)
  const restStart = (windowMain - rest.length) / 2

  useEffect(() => {
    // A system-drawn shelf (acrylic/mica) is a separate window and cannot be animated in step with the icons,
    // so it stays still: sized for the resting row plus the room magnification needs, never moved.
    invoke('dock:layout', { main: windowMain, cross: windowCross, shelfMain: rest.length + PAD * 2 + growth, shelfCross: restThickness })
  }, [windowMain, windowCross, rest.length, restThickness, growth])

  // ---- spring animation of icon sizes ----
  const sizes = useRef<number[]>([])
  const velocity = useRef<number[]>([])
  const pointer = useRef<number | null>(null) // main-axis pointer in rest space, null when away
  const lastPointer = useRef(rest.length / 2)
  const raf = useRef(0)
  const [, repaint] = useState(0)

  const goal = useCallback(
    () =>
      targetSizes({
        restLeft: rest.left,
        restWidth: rest.width,
        separator: rest.separator,
        pointer: settings.magnification ? pointer.current : null,
        iconSize,
        magnifiedSize,
        radiusIcons: settings.magnificationRadius,
        gap: GAP,
      }),
    [rest, iconSize, magnifiedSize, settings.magnification, settings.magnificationRadius],
  )

  const step = useCallback(
    (last: number) => (now: number) => {
      const frameMs = now - last
      const frames = (window.__dockFrames ??= [])
      if (frames.length >= 300) frames.shift()
      frames.push(frameMs)
      const dt = Math.min(frameMs / 1000, 0.05)
      const spring = SPRINGS[settings.animationCurve]
      let moving = false
      goal().forEach((target, i) => {
        const [x, v] = stepSpring(sizes.current[i] ?? target, velocity.current[i] ?? 0, target, dt, spring)
        if (isSettled(x, v, target)) {
          sizes.current[i] = target
          velocity.current[i] = 0
        } else {
          sizes.current[i] = x
          velocity.current[i] = v
          moving = true
        }
      })
      repaint((n) => n + 1)
      raf.current = moving ? requestAnimationFrame(step(now)) : 0
    },
    [settings.animationCurve, goal],
  )

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(step(performance.now()))
  }, [step])

  // Item list or sizes changed: re-seed arrays and settle.
  useEffect(() => {
    sizes.current = items.map((_, i) => sizes.current[i] ?? rest.width[i])
    velocity.current = items.map((_, i) => velocity.current[i] ?? 0)
    cancelAnimationFrame(raf.current)
    raf.current = 0
    kick()
  }, [items, rest, kick])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // ---- pointer handling ----
  const mainCoord = (e: { clientX: number; clientY: number }) => (horizontal ? e.clientX : e.clientY)
  const crossDistanceFromEdge = (e: { clientX: number; clientY: number }) => {
    const size = horizontal ? window.innerHeight : window.innerWidth
    const c = horizontal ? e.clientY : e.clientX
    return settings.position === 'bottom' || settings.position === 'right' ? size - c : c
  }

  const track = (e: { clientX: number; clientY: number }) => {
    if (crossDistanceFromEdge(e) > maxThickness + 8) {
      pointer.current = null
    } else {
      pointer.current = mainCoord(e) - restStart
      lastPointer.current = Math.min(Math.max(pointer.current, 0), rest.length)
    }
    kick()
  }
  const leave = () => {
    pointer.current = null
    kick()
  }

  // ---- drag and drop ----
  const [dragging, setDragging] = useState<string | null>(null)
  const [insertAt, setInsertAt] = useState<number | null>(null)

  const trashIndex = items.findIndex((i) => i.type === 'trash')
  const insertionIndex = (p: number) => {
    const limit = trashIndex >= 0 ? trashIndex : items.length
    for (let i = 0; i < limit; i++) if (p < rest.left[i] + rest.width[i] / 2) return i
    return limit
  }

  const acceptsDrop = (e: React.DragEvent) => e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(DRAG_TYPE)

  const onDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = dragging ? 'move' : 'copy'
    track(e)
    setInsertAt(insertionIndex(mainCoord(e) - restStart))
  }

  const onDrop = async (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return
    e.preventDefault()
    const at = insertionIndex(mainCoord(e) - restStart)
    setInsertAt(null)
    const overTrash = (e.target as HTMLElement).closest('[data-item-type="trash"]')
    const internal = e.dataTransfer.getData(DRAG_TYPE)
    if (internal) {
      setDragging(null)
      if (overTrash) return void invoke('items:remove', internal)
      const from = items.findIndex((i) => i.id === internal)
      if (from < 0) return
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(at > from ? at - 1 : at, 0, moved)
      invoke('items:set', next)
      return
    }
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.api.pathFor(f))
      .filter(Boolean)
    if (!paths.length) return
    if (overTrash) invoke('trash:drop', paths)
    else invoke('items:add-paths', paths, at)
  }

  // ---- render ----
  const current = items.map((_, i) => sizes.current[i] ?? rest.width[i])
  const row = layoutRow({ sizes: current, restLeft: rest.left, restWidth: rest.width, gap: GAP, restStart, anchor: lastPointer.current })
  const { positions, length } = row
  const rowStart = row.start

  // The surface is as thick as the biggest icon, so a magnified icon never pokes out of the glass.
  const biggest = current.reduce((m, s, i) => (items[i]?.type === 'separator' ? m : Math.max(m, s)), iconSize)
  const thickness = Math.max(restThickness, biggest + PAD_CROSS * 2)
  const surfaceStart = rowStart - PAD
  const surfaceLength = length + PAD * 2

  const side = settings.position
  const edgeStyle = (main: number, cross: number, w: number, h: number): React.CSSProperties => {
    const box = { width: horizontal ? w : h, height: horizontal ? h : w }
    const mainProp = horizontal ? { left: main } : { top: main }
    const crossProp = { [side]: cross }
    return { position: 'absolute', ...box, ...mainProp, ...crossProp }
  }

  return (
    <div
      className={`dock dock--${side}${hidden ? ' dock--hidden' : ''}${flat ? ' dock--flat' : ''}`}
      onMouseMove={track}
      onMouseLeave={leave}
      onDragOver={onDragOver}
      onDragLeave={() => setInsertAt(null)}
      onDrop={onDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        invoke('menu:show', { kind: 'empty' })
      }}
    >
      <div className="dock__surface" style={edgeStyle(surfaceStart, 0, surfaceLength, thickness)} />
      {items.map((item, i) => {
        const size = current[i]
        const base = edgeStyle(rowStart + positions[i], PAD_CROSS, size, size)
        if (item.type === 'separator') {
          return (
            <div key={item.id} className="dock__separator" data-horizontal={horizontal} style={{ ...base, [horizontal ? 'height' : 'width']: iconSize * 0.7 }}
              draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, item.id); setDragging(item.id) }}
              onDragEnd={(e) => { setDragging(null); if (outside(e)) invoke('items:remove', item.id) }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); invoke('menu:show', { kind: 'icon', itemId: item.id }) }}
            />
          )
        }
        return (
          <DockIcon
            key={item.id}
            item={item}
            style={base}
            iconSrc={icons[item.id]}
            running={settings.showRunningIndicators ? running[item.id] : undefined}
            launching={launching.has(item.id)}
            position={side}
            hovered={pointer.current !== null && Math.abs(pointer.current - (rest.left[i] + rest.width[i] / 2)) < rest.width[i] / 2 + GAP / 2}
            dragging={dragging === item.id}
            onClick={() => onActivate(item)}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, item.id)
              e.dataTransfer.effectAllowed = 'move'
              setDragging(item.id)
            }}
            onDragEnd={(e) => {
              setDragging(null)
              setInsertAt(null)
              if (outside(e)) invoke('items:remove', item.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              invoke('menu:show', { kind: 'icon', itemId: item.id })
            }}
          />
        )
      })}
      {insertAt !== null && (
        <div
          className="dock__insert"
          style={edgeStyle(rowStart + (insertAt < items.length ? positions[insertAt] - GAP / 2 : length) - 1, PAD_CROSS, 2, iconSize)}
        />
      )}
    </div>
  )
}

/** True when a drag ended outside the dock window: the user flicked the icon away to remove it. */
function outside(e: React.DragEvent): boolean {
  return e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight
}
