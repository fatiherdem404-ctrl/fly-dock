// Desktop toys (a pet, basketball, football, tennis): one transparent window over the work area of the main display.
// It lets every click through except where a toy is (the page tells us with toys:capture), never takes focus, and goes
// away while a program runs full screen.
import { BrowserWindow, screen } from 'electron'
import { getSettings, store } from './store'
import { helper } from './helper'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import { DEFAULT_TOY_SCORES } from '../src/shared/types'
import type { ToyScores } from '../src/shared/types'

let win: BrowserWindow | null = null
let fullscreen = false
let boundsKey = ''

const wanted = () => {
  const s = getSettings()
  return s.toyPet || s.toyBasket || s.toyFootball || s.toyTennis || s.toyYoyo
}

function close() {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
  boundsKey = ''
}

function open() {
  const wa = screen.getPrimaryDisplay().workArea
  const key = `${wa.x},${wa.y},${wa.width},${wa.height}`
  if (win && !win.isDestroyed()) {
    if (key === boundsKey) return
    close()
  }
  boundsKey = key
  const w = new BrowserWindow({
    x: wa.x - OFFSCREEN, y: wa.y, width: wa.width, height: wa.height,
    frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, show: false, webPreferences: baseWebPreferences(),
  })
  win = w
  applyToyLayer()
  w.setMenuBarVisibility(false)
  w.setIgnoreMouseEvents(true, { forward: true })
  loadRoute(w, '/toys')
  w.once('ready-to-show', () => w.showInactive())
  w.on('closed', () => {
    if (win === w) win = null
  })
}

/** Always on top, like any window, or under everything (a gadget on the desktop), as chosen in the settings. */
export function applyToyLayer() {
  if (!win || win.isDestroyed()) return
  const { toyLayer } = getSettings()
  if (toyLayer === 'above') win.setAlwaysOnTop(true, 'screen-saver')
  else win.setAlwaysOnTop(false)
  if (toyLayer === 'below') helper.toBottom(Number(win.getNativeWindowHandle().readBigUInt64LE())).catch(() => {})
}

/** Creates, resizes or removes the toy window to match the settings. */
export function syncToys() {
  if (!wanted() || fullscreen) return close()
  open()
}

export function setToysFullscreen(on: boolean) {
  if (fullscreen === on) return
  fullscreen = on
  syncToys()
}

/** True while the pointer is over a toy: the window then takes clicks, otherwise they pass through. */
export function setToysCapture(on: boolean) {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true })
}

export function toyScores(patch?: Partial<ToyScores>): ToyScores {
  const current = { ...DEFAULT_TOY_SCORES, ...(store.get('toyScores') as Partial<ToyScores> | undefined) }
  if (!patch) return current
  const next = { ...current }
  for (const key of Object.keys(DEFAULT_TOY_SCORES) as (keyof ToyScores)[]) {
    const v = patch[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9) next[key] = Math.floor(v)
  }
  store.set('toyScores', next)
  return next
}

export function initToys() {
  screen.on('display-metrics-changed', () => syncToys())
  syncToys()
}

export function disposeToys() {
  close()
}
