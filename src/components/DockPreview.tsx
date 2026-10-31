import { useEffect, useMemo, useRef, useState } from 'react'
import type { DockSettings } from '@/shared/types'
import { isSettled, layoutRow, speedToMs, springFor, stepSpring, targetLifts, targetSizes } from '@/physics'
import { deskStyleVars, hoverProfile, shelfRadii, separatorKind, separatorStyle } from '@/desk'
import Shelf from './Shelf'
import { useTexture } from '@/useTexture'
import { padsFor, DESK_INSET } from '@/layout'

const COLORS = ['#ff7a59', '#4da3ff', '#8be28b', '#f5c542', '#b57bff', '#ff6fa8']
/** The preview row: icon numbers, with one separator slot so its look can be judged. */
const SLOTS: (number | 'sep')[] = [0, 1, 'sep', 2, 3, 4, 5]
const GLYPHS = ['◐', '▣', '✦', '♪', '☁', '✉']

/** A live miniature of the dock that sweeps a pointer across itself, driven by the same maths as the real dock. */
export default function DockPreview({ settings, launchTick = 0, height = 190 }: { settings: DockSettings; launchTick?: number; height?: number }) {
  const hover = hoverProfile(settings)
  const gap = settings.iconSpacing
  const iconSize = Math.min(settings.iconSize, 56)
  const scale = iconSize / settings.iconSize
  const count = SLOTS.length
  const rest = useMemo(() => {
    const left: number[] = []
    const width: number[] = []
    let cursor = 0
    SLOTS.forEach((slot, i) => {
      const w = slot === 'sep' ? iconSize * 0.35 : iconSize
      left.push(cursor)
      width.push(w)
      cursor += w + (i < SLOTS.length - 1 ? gap : 0)
    })
    return { left, width, length: cursor, separator: SLOTS.map((slot) => slot === 'sep') }
  }, [count, iconSize, gap])

  const sizes = useRef<number[]>([])
  const vel = useRef<number[]>([])
  const lifts = useRef<number[]>([])
  const liftVel = useRef<number[]>([])
  const [, repaint] = useState(0)
  const [launching, setLaunching] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!launchTick) return
    setLaunching(true)
    const timer = setTimeout(() => setLaunching(false), 1600)
    return () => clearTimeout(timer)
  }, [launchTick])

  const spring = useMemo(() => springFor(settings.animationCurve, speedToMs(settings.speed, settings.speedMs)), [settings.animationCurve, settings.speed, settings.speedMs])
  const liftMax = settings.magnification ? hover.liftMax * scale : 0
  const maxSize = iconSize + (iconSize * settings.maxScale - iconSize) * hover.sizeGain
  const pads = padsFor({ ...settings, position: 'bottom' })
  const shelfMode = settings.deskDepth > 0
  const edge = shelfMode ? Math.max(0, settings.deskEdge) : 0
  const restThickness = iconSize + pads.crossEdge + pads.crossFar + edge
  const crossRoom = restThickness + (maxSize - iconSize) + liftMax + 26

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const t0 = last
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      // sweep: glide across, linger on each end, step away
      const phase = ((now - t0) / 1000) % 6
      const pointer = !settings.magnification || phase > 4.8 ? null : rest.length * (0.5 - 0.5 * Math.cos((Math.min(phase, 4.8) / 4.8) * Math.PI * 2 * 0.5 + 0.0))
      const common = { restLeft: rest.left, restWidth: rest.width, separator: rest.separator, pointer, iconSize, radiusIcons: settings.magnificationRadius, gap, curve: settings.falloff }
      const goalSizes = targetSizes({ ...common, magnifiedSize: iconSize * settings.maxScale, gain: hover.sizeGain })
      const goalLifts = targetLifts({ ...common, liftMax })
      const advance = (pos: number[], v: number[], to: number[]) =>
        to.forEach((t, i) => {
          const [x, nv] = stepSpring(pos[i] ?? t, v[i] ?? 0, t, dt, spring)
          pos[i] = isSettled(x, nv, t) ? t : x
          v[i] = isSettled(x, nv, t) ? 0 : nv
        })
      advance(sizes.current, vel.current, goalSizes)
      advance(lifts.current, liftVel.current, goalLifts)
      lastPointer.current = pointer ?? lastPointer.current
      repaint((n) => n + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rest, iconSize, gap, spring, liftMax, hover.sizeGain, settings.magnification, settings.magnificationRadius, settings.maxScale, settings.falloff])

  const lastPointer = useRef(rest.length / 2)
  const current = Array.from({ length: count }, (_, i) => sizes.current[i] ?? iconSize)
  const restStart = (width - rest.length) / 2
  const row = layoutRow({ sizes: current, restLeft: rest.left, restWidth: rest.width, gap, restStart, anchor: Math.min(Math.max(lastPointer.current, 0), rest.length) })
  const biggest = Math.max(...current.filter((_, i) => SLOTS[i] !== 'sep'))
  const biggestLift = Math.max(0, ...lifts.current)
  const thickness = settings.shelfGrows ? Math.max(restThickness, biggest + biggestLift + pads.crossEdge + pads.crossFar + edge) : restThickness
  const reflect = settings.deskStyle === 'mirror' || settings.deskStyle === 'glass3d'
  const baseOffset = (reflect ? Math.round(iconSize * 0.4) : 0) + edge
  const texture = useTexture(settings.deskStyle === 'custom' ? settings.deskTexFile : '')
  const desk = deskStyleVars(settings, thickness, 'bottom', texture)
  const sep = separatorStyle(settings, iconSize * 0.35)

  return (
    <div ref={box} className="preview" style={{ height: Math.max(height, crossRoom + 40) }}>
      <div
        className={`dock dock--bottom dock--desk-${settings.deskStyle}${reflect ? ' dock--reflect' : ''}`}
        style={{ ...desk.rootVars, '--label-size': `${settings.labelSize}px` } as React.CSSProperties}
      >
        {shelfMode ? (
          <div style={{ position: 'absolute', left: row.start - pads.mainStart, width: row.length + pads.mainStart + pads.mainEnd, height: thickness, bottom: DESK_INSET }}>
            <Shelf length={row.length + pads.mainStart + pads.mainEnd} thickness={thickness} edge={edge} depth={settings.deskDepth} side="bottom" radii={shelfRadii(settings, 'bottom')} opacity={settings.deskOpacity} textured={settings.deskStyle === 'custom'} mode={settings.deskTexMode} />
          </div>
        ) : (
          <div className="dock__desk" style={{ position: 'absolute', left: row.start - pads.mainStart, width: row.length + pads.mainStart + pads.mainEnd, height: thickness, bottom: DESK_INSET, ...desk.plate }}>
            {settings.deskStyle === 'custom' && <span className={`dock__desk-texture dock__desk-texture--${settings.deskTexMode}`} />}
            <span className="dock__desk-tint" />
            <span className="dock__desk-sheen" />
          </div>
        )}

        {SLOTS.map((slot, i) => {
          if (slot === 'sep') {
            return <div key="sep" className="dock__separator" data-kind={separatorKind(settings)} data-horizontal="true" style={{ position: 'absolute', left: row.start + row.positions[i], bottom: pads.crossEdge + baseOffset + DESK_INSET, width: iconSize * 0.35, height: sep.length, ...sep.vars } as React.CSSProperties} />
          }
          const color = COLORS[slot]
          return (
          <div
            key={color}
            className={`dock-icon${launching && slot === 1 && settings.launchAnimation !== 'none' ? ` dock-icon--launch-${settings.launchAnimation}` : ''}`}
            data-position="bottom"
            style={{ position: 'absolute', left: row.start + row.positions[i], bottom: pads.crossEdge + baseOffset + DESK_INSET + (lifts.current[i] ?? 0), width: current[i], height: current[i] }}
          >
            <div className="preview__icon" style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`, fontSize: current[i] * 0.5 }}>{GLYPHS[slot]}</div>
            {slot === 0 && settings.showRunningIndicators && <span className={`dock-icon__indicator dock-icon__indicator--${settings.indicatorStyle}`} />}
          </div>
          )
        })}
      </div>
    </div>
  )
}
