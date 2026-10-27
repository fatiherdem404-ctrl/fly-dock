import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DockItem, DockSettings, RunningApp } from '@/types'
import DockIcon from './DockIcon'
import Separator from './Separator'

interface DockProps {
  items: DockItem[]
  settings: DockSettings
  runningApps: RunningApp[]
  iconSrcById: Record<string, string>
  onActivate: (item: DockItem) => void
  onLayoutChange: (width: number, height: number) => void
  onEmptyContextMenu: () => void
  onIconContextMenu: (item: DockItem) => void
}

const GAP = 10 // px between icon centers at rest, feeds the magnification falloff

/** Cosine falloff: 1 at distance 0, tapering to 0 past `radiusPx`. Feels closer to
 *  the macOS "wave" than a hard linear or gaussian curve, and is cheap to compute
 *  on every mousemove for a couple dozen icons. */
function falloff(distance: number, radiusPx: number): number {
  if (distance >= radiusPx) return 0
  return (Math.cos((distance / radiusPx) * Math.PI) + 1) / 2
}

const CURVE_TO_TRANSITION: Record<DockSettings['animationCurve'], string> = {
  linear: 'linear',
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
}

export default function Dock({ items, settings, runningApps, iconSrcById, onActivate, onLayoutChange, onEmptyContextMenu, onIconContextMenu }: DockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<number | null>(null) // mouse position along the dock axis, in px

  const isHorizontal = settings.position === 'bottom' || settings.position === 'top'
  const radiusPx = (settings.magnifiedSize + GAP) * settings.magnificationRadius

  const runningByPath = useMemo(() => {
    const map = new Map<string, RunningApp>()
    for (const app of runningApps) map.set(app.exePath.toLowerCase(), app)
    return map
  }, [runningApps])

  const handlePointerMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPointer(isHorizontal ? e.clientX - rect.left : e.clientY - rect.top)
    },
    [isHorizontal],
  )

  const handlePointerLeave = useCallback(() => setPointer(null), [])

  // Compute each icon's rest-position center along the axis (before magnification
  // shifts things around) so the falloff distance is stable frame to frame.
  const baseCenters = useMemo(() => {
    let cursor = GAP / 2
    return items.map((item) => {
      const w = item.type === 'separator' ? settings.iconSize * 0.4 : settings.iconSize
      const center = cursor + w / 2
      cursor += w + GAP
      return center
    })
  }, [items, settings.iconSize])

  const sizes = useMemo(() => {
    return items.map((item, i) => {
      if (item.type === 'separator') return settings.iconSize * 0.4
      if (pointer === null) return settings.iconSize
      const distance = Math.abs(pointer - baseCenters[i])
      const t = falloff(distance, radiusPx)
      return settings.iconSize + t * (settings.magnifiedSize - settings.iconSize)
    })
  }, [items, pointer, baseCenters, radiusPx, settings.iconSize, settings.magnifiedSize])

  // Report total content size back to main so it can resize/reposition the frameless window.
  useEffect(() => {
    if (!containerRef.current) return
    const totalMain = sizes.reduce((sum, s) => sum + s + GAP, GAP)
    const totalCross = settings.magnifiedSize + 24 // breathing room for the magnification pop + dock chrome
    onLayoutChange(isHorizontal ? totalMain : totalCross, isHorizontal ? totalCross : totalMain)
  }, [sizes, isHorizontal, settings.magnifiedSize, onLayoutChange])

  const transition = CURVE_TO_TRANSITION[settings.animationCurve]

  return (
    <div
      ref={containerRef}
      className={`dock dock--${settings.position} theme-${settings.theme}`}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onContextMenu={(e) => {
        e.preventDefault()
        onEmptyContextMenu()
      }}
    >
      <div className="dock__surface" />
      <div className="dock__row">
        {items.map((item, i) =>
          item.type === 'separator' ? (
            <Separator key={item.id} size={sizes[i]} orientation={isHorizontal ? 'vertical' : 'horizontal'} transition={transition} />
          ) : (
            <DockIcon
              key={item.id}
              item={item}
              size={sizes[i]}
              transition={transition}
              iconSrc={iconSrcById[item.id]}
              isRunning={!!(item.targetPath && runningByPath.has(item.targetPath.toLowerCase()))}
              onClick={() => onActivate(item)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onIconContextMenu(item)
              }}
            />
          ),
        )}
      </div>
    </div>
  )
}
