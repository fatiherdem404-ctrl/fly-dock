// The dock's own window for a folder (stack) or an app group: opens from the icon, scrolls when long,
// closes on Esc or when the user clicks elsewhere. The open/close animation runs in the renderer.
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getSettings } from './store'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import type { DockItem, StackEntry } from '../src/shared/types'

let stackWindow: BrowserWindow | null = null

const SIZES = { small: [360, 300], medium: [520, 420] } as const

export function readEntries(item: DockItem): StackEntry[] {
  if (item.type === 'group') {
    return (item.children ?? []).map((p) => {
      let isDirectory = false
      try {
        isDirectory = fs.statSync(p).isDirectory()
      } catch {
        /* missing target: still listed so it can be removed */
      }
      return { name: path.basename(p, path.extname(p)) || p, path: p, isDirectory }
    })
  }
  if (!item.targetPath) return []
  try {
    return fs
      .readdirSync(item.targetPath, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && !/^(desktop\.ini|thumbs\.db)$/i.test(d.name))
      .map((d) => ({ name: d.name, path: path.join(item.targetPath!, d.name), isDirectory: d.isDirectory() }))
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
      .slice(0, 600)
  } catch {
    return []
  }
}

export function closeStack() {
  stackWindow?.destroy()
  stackWindow = null
}

export function showStack(item: DockItem, anchor: { x: number; y: number }) {
  showPanel(`/stack/${item.id}`, anchor)
}

/** Opens a dock window at `route`; `anchor` is the screen point it grows out of (the dock icon). */
export function showPanel(route: string, anchor: { x: number; y: number }) {
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
    x = anchor.x - width / 2
    y = anchor.y - height - 10
    if (s.position === 'top') y = anchor.y + 10
    if (s.position === 'left') { x = anchor.x + 10; y = anchor.y - height / 2 }
    if (s.position === 'right') { x = anchor.x - width - 10; y = anchor.y - height / 2 }
    x = Math.min(Math.max(x, wa.x + margin), wa.x + wa.width - width - margin)
    y = Math.min(Math.max(y, wa.y + margin), wa.y + wa.height - height - margin)
  }
  x = Math.round(x)
  y = Math.round(y)

  const win = new BrowserWindow({
    x: x - OFFSCREEN, y, width, height,
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: baseWebPreferences(),
  })
  stackWindow = win
  win.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(win, `${route}?ox=${Math.round(anchor.x - x)}&oy=${Math.round(anchor.y - y)}`)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  win.on('closed', () => {
    if (stackWindow === win) stackWindow = null
  })
}
