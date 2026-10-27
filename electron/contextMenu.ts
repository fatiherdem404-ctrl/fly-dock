// The dock's context menu is a small themed window (glass, icons, open animation) instead of the native menu.
import { BrowserWindow, screen } from 'electron'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import type { MenuItemView } from '../src/shared/types'

export interface MenuSpec extends MenuItemView {
  action?: () => void
}

const WIDTH = 236
let menuWindow: BrowserWindow | null = null
let current: MenuSpec[] = []

export function menuItemsForRenderer(): MenuItemView[] {
  return current.map(({ action: _action, ...view }) => view)
}

export function closeMenu() {
  menuWindow?.destroy()
  menuWindow = null
}

export function pickMenuItem(index: number) {
  const entry = current[index]
  closeMenu()
  if (entry && !entry.separator && !entry.disabled) entry.action?.()
}

/** Opens the menu at the pointer; it flips to stay inside the work area. */
export function popupMenu(specs: MenuSpec[]) {
  closeMenu()
  current = specs
  const height = specs.reduce((sum, s) => sum + (s.separator ? 11 : 34), 14)
  const cursor = screen.getCursorScreenPoint()
  const wa = screen.getDisplayNearestPoint(cursor).workArea
  const flipX = cursor.x + WIDTH > wa.x + wa.width
  const flipY = cursor.y + height > wa.y + wa.height
  const x = flipX ? cursor.x - WIDTH : cursor.x
  const y = flipY ? cursor.y - height : cursor.y
  const origin = `${flipY ? 'b' : 't'}${flipX ? 'r' : 'l'}`

  const win = new BrowserWindow({
    x: Math.round(x) - OFFSCREEN, y: Math.round(y), width: WIDTH, height,
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: baseWebPreferences(),
  })
  menuWindow = win
  win.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(win, `/menu?o=${origin}`)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  win.on('closed', () => {
    if (menuWindow === win) menuWindow = null
  })
}
