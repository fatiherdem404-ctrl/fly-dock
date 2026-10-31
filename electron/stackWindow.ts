// The dock's own window for a folder (stack) or an app group: opens from the icon, scrolls when long,
// closes on Esc or when the user clicks elsewhere. The open/close animation runs in the renderer.
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getSettings } from './store'
import { dockWindowList } from './dockWindows'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import type { DockItem, StackEntry } from '../src/shared/types'

let stackWindow: BrowserWindow | null = null

const SIZES = { small: [360, 300], medium: [520, 420] } as const

/** Name, kind, size and date of one path; a missing target is still listed so it can be removed. */
function describe(p: string, name = path.basename(p)): StackEntry {
  let isDirectory = false
  let size = 0
  let mtime = 0
  try {
    const st = fs.statSync(p)
    isDirectory = st.isDirectory()
    size = isDirectory ? 0 : st.size
    mtime = st.mtimeMs
  } catch {
    /* unreadable: listed without details */
  }
  return { name, path: p, isDirectory, size, mtime, ext: isDirectory ? '' : path.extname(p).slice(1).toLowerCase() }
}

export function readEntries(item: DockItem): StackEntry[] {
  if (item.type === 'group') {
    return (item.children ?? []).map((p) => ({ ...describe(p), name: path.basename(p, path.extname(p)) || p }))
  }
  if (!item.targetPath) return []
  try {
    return fs
      .readdirSync(item.targetPath, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && !/^(desktop\.ini|thumbs\.db)$/i.test(d.name))
      .slice(0, 2000)
      .map((d) => describe(path.join(item.targetPath!, d.name), d.name))
  } catch {
    return []
  }
}

let lastDialogClose = 0

/** A menu or question opened from the window just closed; the focus is on its way back. */
export function noteDialogClosed() {
  lastDialogClose = Date.now()
}

export function dialogJustClosed(): boolean {
  return Date.now() - lastDialogClose < 700
}

export function stackIsFocused(): boolean {
  return !!stackWindow && !stackWindow.isDestroyed() && stackWindow.isFocused()
}

/** The window takes the mouse only while the pointer is over the panel; elsewhere clicks pass through to what is below. */
export function setStackCapture(on: boolean) {
  if (stackWindow && !stackWindow.isDestroyed()) stackWindow.setIgnoreMouseEvents(!on, { forward: true })
}

export function focusStack() {
  noteDialogClosed()
  if (stackWindow && !stackWindow.isDestroyed()) stackWindow.focus()
}

export function closeStack() {
  stackWindow?.destroy()
  stackWindow = null
}

export function showStack(item: DockItem, anchor: { x: number; y: number }) {
  const title = item.label || (item.targetPath ? path.basename(item.targetPath) : '') || 'Klasör'
  showPanel(`/stack/${item.id}`, anchor, title)
}

/** Opens a dock window at `route`; `anchor` is the screen point it grows out of (the dock icon). */
export function showPanel(route: string, anchor: { x: number; y: number }, title = '') {
  closeStack()
  const s = getSettings()
  const display = screen.getDisplayNearestPoint(anchor)
  const wa = display.workArea
  const margin = 12
  let width: number
  let height: number
  let x: number
  let y: number
  if (s.stackSize === 'full') {
    width = wa.width - margin * 2
    height = wa.height - margin * 2
    x = wa.x + margin
    y = wa.y + margin
  } else {
    const [w, h] = s.stackSize === 'custom' ? [s.stackWidth, s.stackHeight] : SIZES[s.stackSize]
    width = Math.min(w, wa.width - margin * 2)
    height = Math.min(h, wa.height - margin * 2)
    // the point the window sits against: its icon, the pointer, or the middle of the dock
    let at = anchor
    if (s.stackPlacement === 'cursor') at = screen.getCursorScreenPoint()
    if (s.stackPlacement === 'dock') {
      const bounds = dockWindowList().map((w) => w.getBounds())
      const dock = bounds.find((b) => anchor.x >= b.x && anchor.x <= b.x + b.width && anchor.y >= b.y && anchor.y <= b.y + b.height) ?? bounds[0]
      if (dock) at = s.position === 'left' || s.position === 'right' ? { x: anchor.x, y: dock.y + dock.height / 2 } : { x: dock.x + dock.width / 2, y: anchor.y }
    }
    x = at.x - width / 2
    y = at.y - height - 10
    if (s.position === 'top') y = at.y + 10
    if (s.position === 'left') { x = at.x + 10; y = at.y - height / 2 }
    if (s.position === 'right') { x = at.x - width - 10; y = at.y - height / 2 }
    if (s.stackPlacement === 'center') {
      x = wa.x + (wa.width - width) / 2
      y = wa.y + (wa.height - height) / 2
    }
    x = Math.min(Math.max(x, wa.x + margin), wa.x + wa.width - width - margin)
    y = Math.min(Math.max(y, wa.y + margin), wa.y + wa.height - height - margin)
  }
  x = Math.round(x)
  y = Math.round(y)

  // The window covers the whole display and is click-through except over the panel (see Panel.tsx): the panel can
  // then fly out of and back into the dock icon, be dragged and resized, and its shadow is never cut off.
  const area = display.bounds
  const win = new BrowserWindow({
    x: area.x - OFFSCREEN, y: area.y, width: area.width, height: area.height,
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: baseWebPreferences(),
  })
  stackWindow = win
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  const rel = (n: number, origin: number) => Math.round(n - origin)
  loadRoute(win, `${route}?px=${rel(x, area.x)}&py=${rel(y, area.y)}&pw=${width}&ph=${height}&ox=${rel(anchor.x, area.x)}&oy=${rel(anchor.y, area.y)}&t=${encodeURIComponent(title)}`)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  win.on('closed', () => {
    if (stackWindow === win) stackWindow = null
  })
}
