// Window creation helpers shared by every BrowserWindow the app opens.
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'

const devUrl = process.env.VITE_DEV_SERVER_URL

/**
 * Automated tests run the real app without putting windows on the user's screen: the windows are real and
 * rendering (hidden ones would not run animation frames) but sit far off-screen.
 */
export const HEADLESS = process.env.FLY_DOCK_HEADLESS === '1'
export const OFFSCREEN = HEADLESS ? 15000 : 0

/** Loads the single renderer bundle at a hash route such as /dock, /settings or /widget/abc. */
export function loadRoute(win: BrowserWindow, route: string) {
  if (devUrl) win.loadURL(`${devUrl}#${route}`)
  else win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: route })
}

export function baseWebPreferences(): BrowserWindowConstructorOptions['webPreferences'] {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    backgroundThrottling: false,
  }
}

/** Frameless, transparent, always-on-top window that never takes focus from the app being used. */
export function overlayWindow(extra: BrowserWindowConstructorOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 200,
    height: 100,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: baseWebPreferences(),
    ...extra,
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setMenuBarVisibility(false)
  return win
}
