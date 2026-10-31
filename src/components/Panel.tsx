import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import { speedToMs } from '@/physics'
import type { DockSettings } from '@/shared/types'
import { initSound, playSound } from '@/sound'

interface Rect { x: number; y: number; w: number; h: number }

interface PanelApi {
  close: () => void
  /** Starts dragging the window from its title bar. */
  startDrag: (e: React.PointerEvent) => void
}

const PanelContext = createContext<PanelApi>({ close: () => {}, startDrag: () => {} })

/** Closes the surrounding dock window with its exit animation (the close button, Esc and click-away use the same path). */
export const usePanelClose = () => useContext(PanelContext).close
export const usePanelDrag = () => useContext(PanelContext).startDrag

const MIN_W = 300
const MIN_H = 220
const GRIPS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Grip = (typeof GRIPS)[number]

/** Where a resize edge or corner sits: just outside the panel, so it never covers the scrollbar. */
function gripBox(g: Grip, r: Rect): React.CSSProperties {
  const t = 6 // reach outside the panel
  const i = 3 // reach inside
  const c = 14 // corner size
  const left = g.includes('w') ? r.x - t : g.includes('e') ? r.x + r.w - c : r.x + c
  const top = g.includes('n') ? r.y - t : g.includes('s') ? r.y + r.h - c : r.y + c
  const horizontalEdge = g === 'n' || g === 's'
  const verticalEdge = g === 'e' || g === 'w'
  return {
    left: verticalEdge ? (g === 'w' ? r.x - t : r.x + r.w - i) : left,
    top: horizontalEdge ? (g === 'n' ? r.y - t : r.y + r.h - i) : top,
    width: horizontalEdge ? r.w - c * 2 : verticalEdge ? t + i : c + t,
    height: verticalEdge ? r.h - c * 2 : horizontalEdge ? t + i : c + t,
  }
}

/**
 * Shell of a dock window (folder, group, gear menu). The BrowserWindow covers the whole display and is click-through
 * everywhere except on the panel itself, so the panel can grow out of the dock icon, fly back into it when closed,
 * be dragged by its title bar and resized from its edges, with nothing clipped on the way.
 */
export default function Panel({ children, onSettings }: { children: ReactNode; onSettings?: (s: DockSettings) => void }) {
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [closing, setClosing] = useState(false)
  const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const num = (k: string, fallback = 0) => Number(query.get(k) ?? fallback)
  const [rect, setRect] = useState<Rect>({ x: num('px', 40), y: num('py', 40), w: num('pw', 520), h: num('ph', 420) })
  const rectRef = useRef(rect)
  rectRef.current = rect
  const anchor = { x: num('ox'), y: num('oy') }
  // the animation grows out of, and shrinks back into, the icon wherever the panel has been moved to
  const origin = `${anchor.x - rect.x}px ${anchor.y - rect.y}px`

  useEffect(() => {
    initSound()
    const open = setTimeout(() => playSound('windowOpen'), 60)
    invoke('settings:get').then((s) => {
      setSettings(s)
      onSettings?.(s)
    })
    return () => clearTimeout(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useActiveTheme(settings?.theme)

  const timer = useRef<ReturnType<typeof setTimeout>>()
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    playSound('windowClose')
    timer.current = setTimeout(() => invoke('stack:close'), settings ? Math.min(speedToMs(settings.speed, settings.speedMs) * 0.6, 420) : 200)
  }, [closing, settings])
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    // opening a context menu from inside the window also blurs it; the main process knows whether that is the case
    const onBlur = () => invoke('panel:blurred').then((away) => away && close())
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [close])

  // The window only takes the mouse while the pointer is over the panel (or its resize edges, or a drag is running);
  // everywhere else clicks go straight through to whatever is underneath, which also closes the panel by taking focus.
  const busy = useRef(false)
  const capturing = useRef(false)
  const capture = useCallback((on: boolean) => {
    if (on === capturing.current) return
    capturing.current = on
    invoke('panel:capture', on)
  }, [])
  useEffect(() => {
    const onMove = (e: MouseEvent) => capture(busy.current || !!(e.target as Element | null)?.closest?.('.stack, .stack__grip'))
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [capture])

  const clamp = (r: Rect): Rect => {
    const w = Math.min(Math.max(r.w, MIN_W), window.innerWidth)
    const h = Math.min(Math.max(r.h, MIN_H), window.innerHeight)
    return { w, h, x: Math.min(Math.max(r.x, 0), window.innerWidth - w), y: Math.min(Math.max(r.y, 0), window.innerHeight - h) }
  }

  /** Runs a pointer gesture: `apply` turns the pointer travel into a new rectangle. */
  const gesture = (e: React.PointerEvent, apply: (start: Rect, dx: number, dy: number) => Rect, resized: boolean) => {
    e.preventDefault()
    const start = rectRef.current
    const from = { x: e.clientX, y: e.clientY }
    busy.current = true
    capture(true)
    const move = (ev: PointerEvent) => setRect(clamp(apply(start, ev.clientX - from.x, ev.clientY - from.y)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      busy.current = false
      const r = rectRef.current
      // a new size is remembered as the custom window size
      if (resized && (Math.round(r.w) !== Math.round(start.w) || Math.round(r.h) !== Math.round(start.h))) {
        invoke('settings:update', { stackSize: 'custom', stackWidth: Math.round(r.w), stackHeight: Math.round(r.h) })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest('button, input, select, a')) return
    gesture(e, (s, dx, dy) => ({ ...s, x: s.x + dx, y: s.y + dy }), false)
  }
  const startResize = (grip: Grip) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    gesture(e, (s, dx, dy) => {
      let { x, y, w, h } = s
      if (grip.includes('e')) w = s.w + dx
      if (grip.includes('s')) h = s.h + dy
      if (grip.includes('w')) { w = s.w - dx; x = s.x + dx }
      if (grip.includes('n')) { h = s.h - dy; y = s.y + dy }
      // keep the opposite edge still once the minimum size is reached
      if (w < MIN_W) { if (grip.includes('w')) x = s.x + s.w - MIN_W; w = MIN_W }
      if (h < MIN_H) { if (grip.includes('n')) y = s.y + s.h - MIN_H; h = MIN_H }
      return { x, y, w, h }
    }, true)
  }

  const kind = settings?.windowAnimation ?? 'genie'
  const ms = settings ? speedToMs(settings.speed, settings.speedMs) : 350
  const api: PanelApi = { close, startDrag }
  return (
    <div className="stack-shell" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className={`stack stack--${kind}${closing ? ' stack--closing' : ''}`}
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, transformOrigin: origin, '--win-ms': `${ms}ms` } as React.CSSProperties}
      >
        <PanelContext.Provider value={api}>{children}</PanelContext.Provider>
      </div>
      {!closing && GRIPS.map((g) => <div key={g} className={`stack__grip stack__grip--${g}`} style={gripBox(g, rect)} onPointerDown={startResize(g)} />)}
    </div>
  )
}
