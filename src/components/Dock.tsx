import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DockItem, DockSettings, RunningState } from '@/shared/types'
import { invoke } from '@/api'
import { isSettled, layoutRow, springFor, speedToMs, stepSpring, targetLifts, targetSizes } from '@/physics'
import { deskStyleVars, hoverProfile } from '@/desk'
import { dockGeometry, fitToScreen, DESK_INSET } from '@/layout'
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

const DRAG_TYPE = 'application/x-dock-item'

declare global {
  interface Window {
    /** Frame times (ms) of the last animation frames; read by the perf check. */
    __dockFrames?: number[]
  }
}

export default function Dock({ items, settings: wanted, running, icons, launching, hidden, flat, onActivate }: DockProps) {
  const horizontal = wanted.position === 'bottom' || wanted.position === 'top'

  // One calculation decides the window size, the resting row and every padding, so nothing can be cut off.
  const types = useMemo(() => items.map((i) => i.type), [items])
  const longestLabel = useMemo(() => items.reduce((m, i) => Math.max(m, (i.label ?? (i.type === 'trash' ? 'Çöp kutusu' : '')).length), 0), [items])
  // what the settings ask for, eased until the dock fits along its screen edge
  const edgeLength = horizontal ? window.screen.availWidth : window.screen.availHeight
  const settings = useMemo(() => fitToScreen(wanted, types, flat, longestLabel, edgeLength), [wanted, types, flat, longestLabel, edgeLength])
  const { iconSize, iconSpacing: GAP } = settings
  const hover = hoverProfile(settings)
  const geo = useMemo(() => dockGeometry(settings, types, flat, longestLabel), [settings, types, flat, longestLabel])
  const { pads, baseOffset, edge, liftMax, restThickness, maxThickness, restStart } = geo
  const reflect = settings.deskStyle === 'mirror' && !flat
  const rest = useMemo(
    () => ({ left: geo.restLeft, width: geo.restWidth, length: geo.restLength, separator: geo.separator }),
    [geo],
  )

  useEffect(() => {
    // A system-drawn shelf (acrylic/mica) is a separate window and cannot be animated in step with the icons,
    // so it stays still: sized for the resting row plus the room magnification needs, never moved.
    invoke('dock:layout', { main: geo.main, cross: geo.cross, shelfMain: geo.restLength + pads.mainStart + pads.mainEnd + geo.overshoot, shelfCross: restThickness })
  }, [geo, pads.mainStart, pads.mainEnd, restThickness])

  // ---- spring animation of icon sizes and lifts ----
  const sizes = useRef<number[]>([])
  const velocity = useRef<number[]>([])
  const lifts = useRef<number[]>([])
  const liftVelocity = useRef<number[]>([])
  const pointer = useRef<number | null>(null) // main-axis pointer in rest space, null when away
  const lastPointer = useRef(geo.restLength / 2)
  const raf = useRef(0)
  const [, repaint] = useState(0)
  const spring = useMemo(() => springFor(settings.animationCurve, speedToMs(settings.speed, settings.speedMs)), [settings.animationCurve, settings.speed, settings.speedMs])

  const goal = useCallback(() => {
    const p = settings.magnification ? pointer.current : null
    const common = { restLeft: rest.left, restWidth: rest.width, separator: rest.separator, pointer: p, iconSize, radiusIcons: settings.magnificationRadius, gap: GAP, curve: settings.falloff }
    return {
      sizes: targetSizes({ ...common, magnifiedSize: iconSize * settings.maxScale, gain: hover.sizeGain }),
      lifts: targetLifts({ ...common, liftMax }),
    }
  }, [rest, iconSize, GAP, hover.sizeGain, liftMax, settings.magnification, settings.magnificationRadius, settings.maxScale, settings.falloff])

  const step = useCallback(
    (last: number) => (now: number) => {
      const frameMs = now - last
      const frames = (window.__dockFrames ??= [])
      if (frames.length >= 300) frames.shift()
      frames.push(frameMs)
      const dt = Math.min(frameMs / 1000, 0.05)
      const target = goal()
      let moving = false
      const advance = (pos: number[], vel: number[], to: number[]) =>
        to.forEach((t, i) => {
          const [x, v] = stepSpring(pos[i] ?? t, vel[i] ?? 0, t, dt, spring)
          if (isSettled(x, v, t)) {
            pos[i] = t
            vel[i] = 0
          } else {
            pos[i] = x
            vel[i] = v
            moving = true
          }
        })
      advance(sizes.current, velocity.current, target.sizes)
      advance(lifts.current, liftVelocity.current, target.lifts)
      repaint((n) => n + 1)
      raf.current = moving ? requestAnimationFrame(step(now)) : 0
    },
    [spring, goal],
  )

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(step(performance.now()))
  }, [step])

  // Item list or settings changed: re-seed arrays and settle.
  useEffect(() => {
    sizes.current = items.map((_, i) => sizes.current[i] ?? rest.width[i])
    velocity.current = items.map((_, i) => velocity.current[i] ?? 0)
    lifts.current = items.map((_, i) => lifts.current[i] ?? 0)
    liftVelocity.current = items.map((_, i) => liftVelocity.current[i] ?? 0)
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
    if (crossDistanceFromEdge(e) > maxThickness + liftMax + 8) {
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
  const locked = settings.lockItems
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
    const overTrash = !!(e.target as HTMLElement).closest('[data-item-type="trash"]')
    if (locked && !overTrash) return
    e.preventDefault()
    e.dataTransfer.dropEffect = dragging ? 'move' : 'copy'
    const overGroup = !!(e.target as HTMLElement).closest('[data-item-type="group"]')
    if (overGroup) {
      track(e)
      return setInsertAt(null)
    }
    track(e)
    setInsertAt(overTrash ? null : insertionIndex(mainCoord(e) - restStart))
  }

  const onDrop = async (e: React.DragEvent) => {
    if (!acceptsDrop(e)) return
    e.preventDefault()
    const at = insertionIndex(mainCoord(e) - restStart)
    setInsertAt(null)
    const target = (e.target as HTMLElement).closest('[data-item-type]') as HTMLElement | null
    const overTrash = target?.dataset.itemType === 'trash'
    const overGroup = target?.dataset.itemType === 'group' ? target.dataset.itemId : undefined
    const internal = e.dataTransfer.getData(DRAG_TYPE)
    if (internal) {
      setDragging(null)
      if (locked) return
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
    else if (overGroup) invoke('group:add', overGroup, paths)
    else if (!locked) invoke('items:add-paths', paths, at)
  }

  // ---- render ----
  const current = items.map((_, i) => sizes.current[i] ?? rest.width[i])
  const row = layoutRow({ sizes: current, restLeft: rest.left, restWidth: rest.width, gap: GAP, restStart, anchor: lastPointer.current })
  const { positions, length } = row
  // Safety net for a window the screen forced smaller than planned: keep the whole desk inside it.
  const windowMainNow = horizontal ? window.innerWidth : window.innerHeight
  const surfaceMax = row.length + pads.mainStart + pads.mainEnd
  const rowStart = surfaceMax >= windowMainNow ? pads.mainStart : Math.min(Math.max(row.start, pads.mainStart), windowMainNow - row.length - pads.mainEnd)

  // The desk is as thick as the biggest icon when it is set to grow, so a magnified icon stays on the glass.
  const biggest = current.reduce((m, sz, i) => (items[i]?.type === 'separator' ? m : Math.max(m, sz)), iconSize)
  const biggestLift = lifts.current.reduce((m, l) => Math.max(m, l), 0)
  const thickness = settings.shelfGrows ? Math.max(restThickness, biggest + biggestLift + pads.crossEdge + pads.crossFar + baseOffset) : restThickness
  const surfaceStart = rowStart - pads.mainStart
  const surfaceLength = length + pads.mainStart + pads.mainEnd

  const side = settings.position
  const edgeStyle = (main: number, cross: number, w: number, h: number): React.CSSProperties => {
    const box = { width: horizontal ? w : h, height: horizontal ? h : w }
    const mainProp = horizontal ? { left: main } : { top: main }
    const crossProp = { [side]: cross }
    return { position: 'absolute', ...box, ...mainProp, ...crossProp }
  }

  const desk = deskStyleVars(settings, thickness, side)
  void maxThickness

  return (
    <div
      className={`dock dock--${side} dock--show-${settings.showAnimation}${hidden ? ' dock--hidden' : ''}${flat ? ' dock--flat' : ''} dock--desk-${settings.deskStyle}${reflect ? ' dock--reflect' : ''}`}
      style={{ ...desk.rootVars, '--label-size': `${settings.labelSize}px`, '--label-font': settings.labelFont || 'inherit', '--anim-ms': `${speedToMs(settings.speed, settings.speedMs)}ms` } as React.CSSProperties}
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
      {edge > 0 && <div className="dock__desk dock__desk-body" style={{ ...edgeStyle(surfaceStart, DESK_INSET, surfaceLength, thickness - edge), ...desk.plate }} />}
      <div className="dock__desk" style={{ ...edgeStyle(surfaceStart, edge + DESK_INSET, surfaceLength, thickness - edge), ...desk.plate }}>
        <span className="dock__desk-tint" />
        <span className="dock__desk-sheen" />
      </div>

      {items.map((item, i) => {
        const size = current[i]
        const base = edgeStyle(rowStart + positions[i], pads.crossEdge + baseOffset + DESK_INSET + (lifts.current[i] ?? 0), size, size)
        if (item.type === 'separator') {
          return (
            <div key={item.id} className="dock__separator" data-horizontal={horizontal} style={{ ...base, [horizontal ? 'height' : 'width']: iconSize * 0.7 }}
              draggable={!locked} onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, item.id); setDragging(item.id) }}
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
            launchAnimation={settings.launchAnimation}
            indicator={settings.indicatorStyle}
            position={side}
            showLabel={settings.labelMode === 'always' || (settings.labelMode === 'hover' && pointer.current !== null && Math.abs(pointer.current - (rest.left[i] + rest.width[i] / 2)) < rest.width[i] / 2 + GAP / 2)}
            dragging={dragging === item.id}
            locked={locked}
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
          style={edgeStyle(rowStart + (insertAt < items.length ? positions[insertAt] - GAP / 2 : length) - 1, pads.crossEdge + baseOffset + DESK_INSET, 2, iconSize)}
        />
      )}
    </div>
  )
}

/** True when a drag ended outside the dock window: the user flicked the icon away to remove it. */
function outside(e: React.DragEvent): boolean {
  return e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight
}
