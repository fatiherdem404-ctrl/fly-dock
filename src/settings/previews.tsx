// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useRef, useState } from 'react'
import { invoke, themeStyle } from '@/api'
import { startLive, hueOf, makePointer, feedPointer, clickPointer } from '@/live'
import { LIVE_WALLPAPERS } from '@/shared/types'
import type {
  AnimationCurve, DeskStyle, DockLayer, FalloffCurve, HoverAnimation, IndicatorStyle, LabelMode, LaunchAnimation, SeparatorStyle,
  ShowAnimation, StackPlacement, StackSize, ThemeDef, WindowAnimation,
} from '@/shared/types'
import { DeskCard } from './pages/DeskPage'

import { t as tl } from '../i18n'
/*
 * Small pictures that show what a setting does. They are drawn with CSS and SVG only, loop on their own, and cost
 * nothing to look at. Every one fits the same 16:10 frame (.pv).
 */

const ICON_COLORS = ['#ff7a59', '#4da3ff', '#8be28b', '#f5c542']
const Icn = ({ i = 0, className = '', style }: { i?: number; className?: string; style?: React.CSSProperties }) => (
  <i className={`pv-icon ${className}`} style={{ background: `linear-gradient(145deg, ${ICON_COLORS[i % 4]}, color-mix(in srgb, ${ICON_COLORS[i % 4]} 55%, #000))`, ...style }} />
)

export function Frame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`pv ${className}`}>{children}</span>
}

/** Magnification while the pointer passes over: zoom, lift or the wave of both. */
export function HoverPreview({ kind }: { kind: HoverAnimation }) {
  return (
    <Frame>
      <span className={`pv-row pv-hover pv-hover--${kind}`}>
        {[0, 1, 2, 3].map((i) => <Icn key={i} i={i} className={`pv-hover__icon pv-hover__icon--${i}`} />)}
      </span>
    </Frame>
  )
}

export function LaunchPreview({ kind }: { kind: LaunchAnimation }) {
  return (
    <Frame>
      <span className="pv-row"><Icn i={0} /><Icn i={1} className={`pv-launch pv-launch--${kind}`} /><Icn i={2} /></span>
    </Frame>
  )
}

export function IndicatorPreview({ kind }: { kind: IndicatorStyle }) {
  return (
    <Frame>
      <span className="pv-row">
        <Icn i={1} />
        <span className="pv-indwrap"><Icn i={3} /><b className={`pv-ind pv-ind--${kind}`} /></span>
        <Icn i={2} />
      </span>
    </Frame>
  )
}

/** How a hidden dock comes onto the screen. */
export function ShowPreview({ kind }: { kind: ShowAnimation }) {
  return (
    <Frame>
      <span className={`pv-pill pv-show pv-show--${kind}`}><Icn i={0} /><Icn i={1} /><Icn i={2} /></span>
    </Frame>
  )
}

/** How a folder window opens: out of its icon (genie), grown, faded or slid. */
export function WindowAnimPreview({ kind }: { kind: WindowAnimation }) {
  return (
    <Frame>
      <span className={`pv-win pv-win--${kind}`}><i /><i /><i /></span>
      <span className="pv-pill pv-pill--small"><Icn i={0} /><Icn i={1} /></span>
    </Frame>
  )
}

export function SepPreview({ kind }: { kind: SeparatorStyle }) {
  return (
    <Frame>
      <span className="pv-row"><Icn i={0} /><Icn i={1} /><b className={`pv-sep pv-sep--${kind}`} /><Icn i={2} /><Icn i={3} /></span>
    </Frame>
  )
}

export function LabelPreview({ mode }: { mode: LabelMode }) {
  return (
    <Frame>
      <span className="pv-row"><Icn i={0} /><span className="pv-labelwrap"><Icn i={1} />{mode !== 'never' && <em className={`pv-tip pv-tip--${mode}`}>{tl('Chrome')}</em>}</span><Icn i={2} /></span>
    </Frame>
  )
}

/** Where the dock sits relative to other windows. */
export function LayerPreview({ layer }: { layer: DockLayer }) {
  const order: Record<DockLayer, string[]> = { above: ['dock', 'win'], normal: ['win', 'dock'], below: ['win', 'win2'] }
  return (
    <Frame>
      <span className="pv-layers">
        <span className="pv-layers__win" />
        <span className={`pv-layers__dock pv-layers__dock--${layer}`} />
        {order[layer].length === 0 && null}
      </span>
    </Frame>
  )
}

/** Animation curve: how a value travels from 0 to 1 over time. */
export function CurvePreview({ curve }: { curve: AnimationCurve }) {
  const pts: string[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const y =
      curve === 'linear' ? t
        : curve === 'ease' ? t * t * (3 - 2 * t)
          : curve === 'spring' ? 1 - (1 + 7 * t) * Math.exp(-7 * t)
            : 1 - Math.exp(-5 * t) * Math.cos(14 * t)
    pts.push(`${(6 + t * 88).toFixed(1)},${(52 - y * 38).toFixed(1)}`)
  }
  return (
    <Frame>
      <svg viewBox="0 0 100 60" className="pv-svg" aria-hidden="true">
        <path d="M6 52H94M6 52V8" className="pv-svg__axis" />
        <path d="M6 14H94" className="pv-svg__goal" />
        <polyline points={pts.join(' ')} className="pv-svg__line" />
      </svg>
    </Frame>
  )
}

/** Magnification falloff: how far the growth spreads to the neighbours. */
export function FalloffPreview({ curve }: { curve: FalloffCurve }) {
  const pts: string[] = []
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * 2 - 1
    const a = Math.abs(x)
    const y = curve === 'cosine' ? 0.5 + 0.5 * Math.cos(Math.PI * x) : curve === 'gaussian' ? Math.exp(-x * x * 5) : curve === 'linear' ? 1 - a : Math.pow(1 - a, 3)
    pts.push(`${(6 + ((x + 1) / 2) * 88).toFixed(1)},${(52 - y * 40).toFixed(1)}`)
  }
  return (
    <Frame>
      <svg viewBox="0 0 100 60" className="pv-svg" aria-hidden="true">
        <path d="M6 52H94" className="pv-svg__axis" />
        <polyline points={pts.join(' ')} className="pv-svg__line" />
      </svg>
    </Frame>
  )
}

/** A mini screen: where a dock window opens. */
export function PlacementPreview({ place }: { place: StackPlacement }) {
  return (
    <Frame>
      <span className="pv-screen">
        <span className={`pv-screen__win pv-screen__win--${place}`} />
        <span className="pv-screen__dock"><Icn i={0} /><Icn i={1} /><Icn i={2} /></span>
        {place === 'cursor' && <span className="pv-screen__cursor" />}
      </span>
    </Frame>
  )
}

export function SizePreview({ size }: { size: StackSize }) {
  return (
    <Frame>
      <span className="pv-screen">
        <span className={`pv-screen__win pv-screen__win--size-${size}`} />
        <span className="pv-screen__dock"><Icn i={0} /><Icn i={1} /><Icn i={2} /></span>
      </span>
    </Frame>
  )
}

/** A live scene running in a thumbnail; it only runs while it is on screen. */
export function LiveThumb({ id, hue = 215, className = '' }: { id: string; hue?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !canvas.current) return
    const el = canvas.current
    // the thumbnail reacts to the mouse, so the scene can be tried out before it is chosen
    const pointer = makePointer()
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      feedPointer(pointer, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, true)
    }
    const leave = () => feedPointer(pointer, pointer.x, pointer.y, false)
    const press = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      clickPointer(pointer, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    }
    const host = el.closest('button') ?? el
    host.addEventListener('mousemove', move as EventListener)
    host.addEventListener('mouseleave', leave)
    host.addEventListener('mousedown', press as EventListener)
    const stop = startLive(el, id, hue, { w: 192, h: 120 }, pointer)
    return () => {
      stop()
      host.removeEventListener('mousemove', move as EventListener)
      host.removeEventListener('mouseleave', leave)
      host.removeEventListener('mousedown', press as EventListener)
    }
  }, [visible, id, hue])
  return <canvas ref={canvas} className={`pv-live ${className}`} width={192} height={120} />
}

export const wallStyle = (live?: string): React.CSSProperties =>
  live ? {} : { background: 'linear-gradient(135deg, #3a5ea8, #7a4fb0 50%, #d1795a)' }

/** A whole desktop in miniature painted with one theme: wallpaper, dock with its shelf, a label and a panel. */
export function ThemeScene({ theme, hue }: { theme: ThemeDef; hue?: number }) {
  const box = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(220)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  const live = theme.wallpaper?.live
  const accentHue = hue ?? hueOf(theme.vars.accent)
  return (
    <span ref={box} className="pv pv-scene" style={themeStyle(theme.vars)}>
      <span className="pv-scene__wall" style={wallStyle(live)}>
        {live && <LiveThumb id={live} hue={accentHue} className="pv-scene__live" />}
      </span>
      <span className="pv-scene__shelf"><DeskCard style={(theme.desk?.deskStyle as DeskStyle | undefined) ?? 'glass'} length={Math.max(110, Math.round(width * 0.58))} label={tl('Etiket')} /></span>
      <span className="pv-scene__panel"><b>{tl('Aa')}</b><i /></span>
    </span>
  )
}

/** Thumbnails for the pictures and videos of a wallpaper choice. */
export function FileThumb({ path, className = '' }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (path) invoke('stack:thumb', path, 160).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [path])
  return src ? <img src={src} alt="" className={`pv-file ${className}`} /> : <span className={`pv-file pv-file--empty ${className}`} />
}

export const LIVE_NAMES = Object.fromEntries(LIVE_WALLPAPERS.map(([id, name]) => [id, name])) as Record<string, string>
