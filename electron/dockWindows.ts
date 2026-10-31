// One dock window per target display. The window has a fixed size for a given layout (items + settings) so
// magnification never resizes it; auto-hide and fullscreen hiding only flip click-through and visibility.
import { BrowserWindow, Display, screen } from 'electron'
import { getSettings } from './store'
import { overlayWindow, loadRoute, OFFSCREEN } from './windows'
import { broadcast } from './ipc'
import { helper } from './helper'
import type { DockPosition } from '../src/shared/types'

const EDGE_BAND = 4

interface Layout {
  main: number
  cross: number
}

interface DockWin {
  displayId: number
  win: BrowserWindow
}

let layout: Layout = { main: 400, cross: 140 }
const docks = new Map<number, DockWin>()
let autoHidden = false
let fullscreenHidden = false
let pointerTimer: NodeJS.Timeout | null = null
let leftAt = 0

function targetDisplays(): Display[] {
  const { monitor } = getSettings()
  const all = screen.getAllDisplays()
  if (monitor === 'all') return all
  if (typeof monitor === 'number') {
    const match = all.find((d) => d.id === monitor)
    if (match) return [match]
  }
  return [screen.getPrimaryDisplay()]
}

type Rect = { x: number; y: number; width: number; height: number }

/** Dock window rectangle: sits `edgeOffset` px from its edge and `alignment` % of the way along it. */
function rect(display: Display, position: DockPosition, main: number, cross: number): Rect {
  const wa = display.workArea
  const { edgeOffset, alignment } = getSettings()
  const horizontal = position === 'bottom' || position === 'top'
  const width = horizontal ? Math.min(main, wa.width) : cross
  const height = horizontal ? cross : Math.min(main, wa.height)
  const along = Math.min(Math.max(alignment, 0), 100) / 100
  const ax = Math.round(wa.x + (wa.width - width) * along)
  const ay = Math.round(wa.y + (wa.height - height) * along)
  switch (position) {
    case 'top': return { x: ax, y: wa.y + edgeOffset, width, height }
    case 'left': return { x: wa.x + edgeOffset, y: ay, width, height }
    case 'right': return { x: wa.x + wa.width - width - edgeOffset, y: ay, width, height }
    default: return { x: ax, y: wa.y + wa.height - height - edgeOffset, width, height }
  }
}

function applyBounds(dock: DockWin) {
  const display = screen.getAllDisplays().find((d) => d.id === dock.displayId)
  if (!display || dock.win.isDestroyed()) return
  const { position } = getSettings()
  const dockRect = rect(display, position, layout.main, layout.cross)
  dockRect.x -= OFFSCREEN
  dock.win.setBounds(dockRect)
}

function createDock(display: Display): DockWin {
  const win = overlayWindow()
  loadRoute(win, '/dock')
  const dock: DockWin = { displayId: display.id, win }
  win.once('ready-to-show', () => {
    applyBounds(dock)
    if (!fullscreenHidden) showDock(dock)
  })
  return dock
}

function showDock(dock: DockWin) {
  dock.win.showInactive()
  applyLayer()
  if (getSettings().layer === 'above') dock.win.moveTop()
}

const handleOf = (w: BrowserWindow) => Number(w.getNativeWindowHandle().readBigUInt64LE())

/**
 * Where the dock sits among other windows: 'above' is always-on-top, 'normal' behaves like any window
 * (other windows can cover it) and 'below' keeps it under everything, like a desktop gadget.
 */
export function applyLayer() {
  const { layer } = getSettings()
  for (const { win } of docks.values()) {
    if (win.isDestroyed()) continue
    if (layer === 'above') {
      win.setAlwaysOnTop(true, 'screen-saver')
      // a send-to-bottom still on its way from an earlier setting must not win: assert once more shortly after
      setTimeout(() => {
        if (!win.isDestroyed() && getSettings().layer === 'above') win.setAlwaysOnTop(true, 'screen-saver')
      }, 200)
    } else win.setAlwaysOnTop(false)
    if (layer === 'below') helper.toBottom(handleOf(win)).catch(() => {})
  }
}

export function dockIsOnTop(): boolean {
  const first = [...docks.values()][0]
  return !!first && !first.win.isDestroyed() && first.win.isAlwaysOnTop()
}

function destroyDock(dock: DockWin) {
  if (!dock.win.isDestroyed()) dock.win.destroy()
}

/** Creates, removes and re-positions dock windows to match the current settings and monitors. */
export function syncDocks() {
  const wanted = targetDisplays()
  for (const [id, dock] of docks) {
    if (!wanted.some((d) => d.id === id)) {
      destroyDock(dock)
      docks.delete(id)
    }
  }
  for (const display of wanted) {
    const existing = docks.get(display.id)
    if (existing) applyBounds(existing)
    else docks.set(display.id, createDock(display))
  }
  startPointerWatch()
}

export function setLayout(next: Layout) {
  const same = (Object.keys(next) as (keyof Layout)[]).every((k) => Math.round(next[k]) === Math.round(layout[k]))
  if (same) return
  layout = next
  for (const dock of docks.values()) applyBounds(dock)
}

export function dockWindowList(): BrowserWindow[] {
  return [...docks.values()].map((d) => d.win).filter((w) => !w.isDestroyed())
}

export function isDockHidden() {
  return autoHidden
}

export function setFullscreenHidden(hidden: boolean) {
  if (hidden === fullscreenHidden) return
  fullscreenHidden = hidden
  for (const dock of docks.values()) {
    if (hidden) dock.win.hide()
    else if (!dock.win.isDestroyed()) showDock(dock)
  }
}

export function toggleDockVisibility() {
  setFullscreenHidden(!fullscreenHidden)
}

function setAutoHidden(hidden: boolean) {
  if (hidden === autoHidden) return
  autoHidden = hidden
  for (const dock of docks.values()) {
    if (dock.win.isDestroyed()) continue
    dock.win.setIgnoreMouseEvents(hidden, { forward: false })
  }
  broadcast('dock:hidden', { hidden })
}

function pointerNearDock(): boolean {
  const cursor = screen.getCursorScreenPoint()
  const { position } = getSettings()
  for (const dock of docks.values()) {
    if (dock.win.isDestroyed()) continue
    const b = dock.win.getBounds()
    const display = screen.getAllDisplays().find((d) => d.id === dock.displayId)
    if (!display) continue
    const wa = display.workArea
    const insideSpan = position === 'bottom' || position === 'top'
      ? cursor.x >= b.x - 40 && cursor.x <= b.x + b.width + 40
      : cursor.y >= b.y - 40 && cursor.y <= b.y + b.height + 40
    // Hot edge: the line where the work area meets the screen edge, and everything beyond it (the taskbar).
    const atEdge =
      (position === 'bottom' && cursor.y >= wa.y + wa.height - EDGE_BAND) ||
      (position === 'top' && cursor.y <= wa.y + EDGE_BAND) ||
      (position === 'left' && cursor.x <= wa.x + EDGE_BAND) ||
      (position === 'right' && cursor.x >= wa.x + wa.width - EDGE_BAND)
    const inWindow = !autoHidden && cursor.x >= b.x - 8 && cursor.x <= b.x + b.width + 8 && cursor.y >= b.y - 8 && cursor.y <= b.y + b.height + 8
    if ((atEdge && insideSpan) || inWindow) return true
  }
  return false
}

function startPointerWatch() {
  const { autoHide } = getSettings()
  if (!autoHide) {
    if (pointerTimer) clearInterval(pointerTimer)
    pointerTimer = null
    setAutoHidden(false)
    return
  }
  if (pointerTimer) return
  setAutoHidden(true)
  pointerTimer = setInterval(() => {
    const { autoHideDelayMs } = getSettings()
    if (pointerNearDock()) {
      leftAt = 0
      setAutoHidden(false)
    } else if (!autoHidden) {
      if (!leftAt) leftAt = Date.now()
      if (Date.now() - leftAt >= autoHideDelayMs) setAutoHidden(true)
    }
  }, 60)
}

export function initDockWindows() {
  screen.on('display-added', syncDocks)
  screen.on('display-removed', syncDocks)
  screen.on('display-metrics-changed', syncDocks)
  syncDocks()
}

export function disposeDockWindows() {
  if (pointerTimer) clearInterval(pointerTimer)
  for (const dock of docks.values()) destroyDock(dock)
  docks.clear()
}
