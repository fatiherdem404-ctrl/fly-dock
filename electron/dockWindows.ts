// One dock window per target display. The window has a fixed size for a given layout (items + settings) so
// magnification never resizes it; auto-hide and fullscreen hiding only flip click-through and visibility.
import { BrowserWindow, Display, screen } from 'electron'
import os from 'node:os'
import { getSettings } from './store'
import { getTheme } from './packs'
import { overlayWindow, loadRoute } from './windows'
import { broadcast } from './ipc'
import { helper } from './helper'
import type { DockPosition } from '../src/shared/types'

// backgroundMaterial needs Windows 11 22H2 (build 22621) or newer.
export const materialSupported = Number(os.release().split('.')[2]) >= 22621
const activeMaterial = () => (materialSupported ? getSettings().material : 'none')

const MARGIN = 6
const EDGE_BAND = 4

interface Layout {
  main: number
  cross: number
  shelfMain: number
  shelfCross: number
}

interface DockWin {
  displayId: number
  win: BrowserWindow
  shelf: BrowserWindow | null
}

let layout: Layout = { main: 400, cross: 140, shelfMain: 300, shelfCross: 70 }
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

function rect(display: Display, position: DockPosition, main: number, cross: number) {
  const wa = display.workArea
  const horizontal = position === 'bottom' || position === 'top'
  const width = horizontal ? Math.min(main, wa.width) : cross
  const height = horizontal ? cross : Math.min(main, wa.height)
  const cx = Math.round(wa.x + (wa.width - width) / 2)
  const cy = Math.round(wa.y + (wa.height - height) / 2)
  switch (position) {
    case 'top': return { x: cx, y: wa.y + MARGIN, width, height }
    case 'left': return { x: wa.x + MARGIN, y: cy, width, height }
    case 'right': return { x: wa.x + wa.width - width - MARGIN, y: cy, width, height }
    default: return { x: cx, y: wa.y + wa.height - height - MARGIN, width, height }
  }
}

function applyBounds(dock: DockWin) {
  const display = screen.getAllDisplays().find((d) => d.id === dock.displayId)
  if (!display || dock.win.isDestroyed()) return
  const { position } = getSettings()
  dock.win.setBounds(rect(display, position, layout.main, layout.cross))
  if (dock.shelf && !dock.shelf.isDestroyed()) {
    dock.shelf.setBounds(rect(display, position, layout.shelfMain, layout.shelfCross))
    dock.win.moveTop()
  }
}

/** Theme surface colour as #AARRGGBB. Set natively on the shelf window so it resizes in lockstep with the material. */
function shelfTint(): string {
  const css = getTheme(getSettings().theme)?.vars.surface ?? 'rgba(24, 26, 32, 0.62)'
  const hex = (n: number) => Math.round(Math.min(Math.max(n, 0), 255)).toString(16).padStart(2, '0')
  const rgba = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/)
  if (rgba) return `#${hex(Number(rgba[4] ?? 1) * 255)}${hex(Number(rgba[1]))}${hex(Number(rgba[2]))}${hex(Number(rgba[3]))}`
  const short = css.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
  return short ? `#${short[2] ?? 'ff'}${short[1]}` : '#9e181a20'
}

export function refreshShelfTint() {
  const tint = shelfTint()
  for (const dock of docks.values()) if (dock.shelf && !dock.shelf.isDestroyed()) dock.shelf.setBackgroundColor(tint)
}

function createShelf(material: 'acrylic' | 'mica'): BrowserWindow {
  const shelf = overlayWindow({
    transparent: false,
    backgroundColor: '#00000000',
    backgroundMaterial: material,
    roundedCorners: true,
    thickFrame: false,
  })
  shelf.setIgnoreMouseEvents(true)
  shelf.loadURL('data:text/html,<body style="margin:0;background:transparent"></body>')
  shelf.setBackgroundColor(shelfTint())
  // Win11 only rounds frameless windows when asked; the dock surface radius is matched to DWM's 8px.
  shelf.once('ready-to-show', () => helper.roundCorners(Number(shelf.getNativeWindowHandle().readBigUInt64LE())).catch(() => {}))
  return shelf
}

function createDock(display: Display): DockWin {
  const win = overlayWindow()
  loadRoute(win, '/dock')
  const material = activeMaterial()
  const shelf = material === 'none' ? null : createShelf(material)
  const dock: DockWin = { displayId: display.id, win, shelf }
  win.once('ready-to-show', () => {
    applyBounds(dock)
    if (!fullscreenHidden) showDock(dock)
  })
  return dock
}

function showDock(dock: DockWin) {
  dock.shelf?.showInactive()
  dock.win.showInactive()
  dock.win.moveTop()
}

function destroyDock(dock: DockWin) {
  if (!dock.win.isDestroyed()) dock.win.destroy()
  if (dock.shelf && !dock.shelf.isDestroyed()) dock.shelf.destroy()
}

/** Creates, removes and re-positions dock windows to match the current settings and monitors. */
export function syncDocks() {
  const wanted = targetDisplays()
  const material = activeMaterial()
  for (const [id, dock] of docks) {
    const keep = wanted.some((d) => d.id === id) && (material === 'none') === (dock.shelf === null)
    if (!keep) {
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

/** The renderer reports where the glass surface currently is (it widens while icons magnify); the shelf follows. */
export function setSurface(webContentsId: number, surface: { start: number; length: number; thickness: number }) {
  for (const dock of docks.values()) {
    if (dock.win.isDestroyed() || dock.win.webContents.id !== webContentsId || !dock.shelf || dock.shelf.isDestroyed()) continue
    const b = dock.win.getBounds()
    const { position } = getSettings()
    const start = Math.round(surface.start)
    const length = Math.max(1, Math.round(surface.length))
    const thick = Math.max(1, Math.round(surface.thickness))
    const shelf =
      position === 'bottom' ? { x: b.x + start, y: b.y + b.height - thick, width: length, height: thick }
      : position === 'top' ? { x: b.x + start, y: b.y, width: length, height: thick }
      : position === 'left' ? { x: b.x, y: b.y + start, width: thick, height: length }
      : { x: b.x + b.width - thick, y: b.y + start, width: thick, height: length }
    dock.shelf.setBounds(shelf)
  }
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
    if (hidden) {
      dock.win.hide()
      dock.shelf?.hide()
    } else if (!dock.win.isDestroyed()) showDock(dock)
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
    if (dock.shelf && !dock.shelf.isDestroyed()) hidden ? dock.shelf.hide() : dock.shelf.showInactive()
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
