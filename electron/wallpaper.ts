// Wallpapers: one borderless window per display, parked behind the desktop icons by the helper. It shows the current
// picture, video or built-in live scene, and a folder can rotate on a timer. Nothing in Windows is changed: when the
// app closes the windows go with it and the user's own wallpaper is back. Pictures and videos reach the window through
// a private protocol that serves only the files this module has listed, never a path the window asks for.
import { app, BrowserWindow, dialog, net, powerMonitor, protocol, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import { getSettings } from './store'
import { baseWebPreferences, loadRoute, HEADLESS, OFFSCREEN } from './windows'
import { helper } from './helper'
import { broadcast } from './ipc'
import { getTheme, themeWallpaperFile } from './packs'
import { LIVE_WALLPAPERS } from '../src/shared/types'
import type { WallpaperSource, WallpaperInfo } from '../src/shared/types'

export const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'])
export const VIDEO_EXT = new Set(['.mp4', '.webm', '.m4v'])
const MAX_FOLDER_FILES = 400

/** Must run before the app is ready. */
export function registerWallpaperScheme() {
  // A window on the desktop layer is covered by every other window as far as Chromium can tell, and Chromium stops
  // painting windows it believes are hidden. The wallpaper has to keep painting, so occlusion tracking stays off.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  protocol.registerSchemesAsPrivileged([{ scheme: 'flymedia', privileges: { stream: true, supportFetchAPI: true, secure: true, bypassCSP: true } }])
}

const media = new Map<string, string>() // id -> absolute path, only files this module chose
const windows = new Map<number, BrowserWindow>()
let status: { attached: boolean; message: string } = { attached: false, message: '' }
let current: WallpaperSource | null = null
let folderList: string[] = []
let folderIndex = -1
let timer: NodeJS.Timeout | null = null
let timerKey = ''
let fullscreen = false
let onBattery = false
let locked = false
let handlerInstalled = false

const kindOf = (file: string): 'image' | 'video' | null => {
  const ext = path.extname(file).toLowerCase()
  return IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : null
}

function register(file: string): string {
  for (const [id, p] of media) if (p === file) return id
  const id = crypto.randomBytes(8).toString('hex')
  media.set(id, file)
  return id
}

function installProtocol() {
  if (handlerInstalled) return
  handlerInstalled = true
  protocol.handle('flymedia', (request) => {
    const id = new URL(request.url).hostname
    const file = media.get(id)
    if (!file || !fs.existsSync(file)) return new Response('not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
  })
}

function sourceFromFile(file: string): WallpaperSource | null {
  const kind = kindOf(file)
  if (!kind || !fs.existsSync(file)) return null
  return { kind, url: `flymedia://${register(file)}/` }
}

function listFolder(folder: string): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_FOLDER_FILES) return
      const full = path.join(dir, e.name)
      if (e.isFile() && kindOf(full)) out.push(full)
      else if (e.isDirectory() && depth > 0) walk(full, depth - 1)
    }
  }
  walk(folder, 1)
  return out.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
}

/** The wallpaper the settings ask for right now (without advancing a slideshow). */
function resolve(): WallpaperSource | null {
  const s = getSettings()
  if (s.wallpaperMode === 'single') {
    if (s.wallpaperSingle.startsWith('live:')) {
      const id = s.wallpaperSingle.slice(5)
      return LIVE_WALLPAPERS.some(([k]) => k === id) ? { kind: 'live', live: id } : null
    }
    return s.wallpaperSingle ? sourceFromFile(s.wallpaperSingle) : null
  }
  if (s.wallpaperMode === 'theme') {
    const theme = getTheme(s.theme)
    if (theme?.wallpaper?.live) return { kind: 'live', live: theme.wallpaper.live }
    const file = themeWallpaperFile(s.theme)
    return file ? sourceFromFile(file) : null
  }
  if (s.wallpaperMode === 'folder') {
    if (!s.wallpaperFolder) return null
    if (folderIndex < 0 || folderIndex >= folderList.length) pick(s.wallpaperShuffle ? 'random' : 'first')
    const file = folderList[folderIndex]
    return file ? sourceFromFile(file) : null
  }
  return null
}

function pick(how: 'first' | 'next' | 'random') {
  const s = getSettings()
  folderList = listFolder(s.wallpaperFolder)
  if (folderList.length === 0) {
    folderIndex = -1
    return
  }
  if (how === 'first') folderIndex = 0
  else if (how === 'next') folderIndex = s.wallpaperShuffle ? randomOther(folderIndex, folderList.length) : (folderIndex + 1) % folderList.length
  else folderIndex = randomOther(-1, folderList.length)
}

function randomOther(not: number, count: number): number {
  if (count <= 1) return 0
  let n = not
  while (n === not) n = Math.floor(Math.random() * count)
  return n
}

function paused(): boolean {
  const s = getSettings()
  return (fullscreen && s.wallpaperPauseFullscreen) || (onBattery && s.wallpaperPauseBattery) || locked
}

export function wallpaperInfo(): WallpaperInfo {
  return { source: current, fit: getSettings().wallpaperFit, paused: paused(), attached: status.attached, message: status.message, folderCount: folderList.length }
}

function push() {
  broadcast('wallpaper:changed', wallpaperInfo())
}

// ---- windows ----

const handleOf = (w: BrowserWindow) => Number(w.getNativeWindowHandle().readBigUInt64LE())

async function createWindow(display: Electron.Display) {
  const b = display.bounds
  const win = new BrowserWindow({
    x: b.x - OFFSCREEN, y: b.y, width: b.width, height: b.height,
    frame: false, show: false, skipTaskbar: true, focusable: false, resizable: false, movable: false, hasShadow: false,
    backgroundColor: '#000000', webPreferences: { ...baseWebPreferences(), backgroundThrottling: false },
  })
  windows.set(display.id, win)
  win.setIgnoreMouseEvents(true)
  loadRoute(win, '/wallpaper')
  win.once('ready-to-show', async () => {
    win.showInactive()
    if (HEADLESS) {
      status = { attached: false, message: '' }
      return
    }
    // physical pixels, because the shell positions the window itself
    const px = screen.dipToScreenRect(win, win.getBounds())
    const ok = await helper.desktopAttach(handleOf(win), px.x, px.y, px.width, px.height).catch(() => false)
    status = ok ? { attached: true, message: '' } : { attached: false, message: 'Masaüstü katmanına bağlanılamadı. Yardımcı programı yenilemek için uygulamayı kapatıp yeniden aç.' }
    if (!ok && !win.isDestroyed()) {
      win.destroy()
      windows.delete(display.id)
    }
    push()
  })
  win.on('closed', () => windows.delete(display.id))
}

function destroyAll() {
  for (const win of windows.values()) {
    if (win.isDestroyed()) continue
    helper.desktopDetach(handleOf(win)).catch(() => {})
    win.destroy()
  }
  windows.clear()
}

function schedule() {
  const s = getSettings()
  const key = `${s.wallpaperMode}|${s.wallpaperFolder}|${s.wallpaperMinutes}`
  if (key === timerKey && timer) return
  if (timer) clearInterval(timer)
  timer = null
  timerKey = key
  if (s.wallpaperMode !== 'folder' || !s.wallpaperFolder) return
  timer = setInterval(() => {
    if (paused()) return
    advance()
  }, Math.max(1, s.wallpaperMinutes) * 60_000)
}

/** Shows the next picture of the folder now (and restarts the timer from here). */
export function advance() {
  if (getSettings().wallpaperMode !== 'folder') return
  pick('next')
  sync()
}

/** Brings windows, source and timer in line with the settings. Cheap to call after any change. */
export function sync() {
  installProtocol()
  current = resolve()
  schedule()
  const displays = screen.getAllDisplays()
  if (!current) {
    destroyAll()
    status = { attached: false, message: '' }
    push()
    return
  }
  for (const [id, win] of [...windows]) {
    if (win.isDestroyed() || !displays.some((d) => d.id === id)) {
      if (!win.isDestroyed()) win.destroy()
      windows.delete(id)
    }
  }
  for (const d of displays) if (!windows.has(d.id)) void createWindow(d)
  push()
}

/** The settings page changes the mode, the file or the folder: restart a slideshow from its first picture. */
export function restartSlideshow() {
  folderIndex = -1
  timerKey = ''
}

export function setFullscreenPaused(on: boolean) {
  if (fullscreen === on) return
  fullscreen = on
  push()
}

export function initWallpaper() {
  installProtocol()
  onBattery = powerMonitor.isOnBatteryPower()
  powerMonitor.on('on-battery', () => { onBattery = true; push() })
  powerMonitor.on('on-ac', () => { onBattery = false; push() })
  powerMonitor.on('lock-screen', () => { locked = true; push() })
  powerMonitor.on('unlock-screen', () => { locked = false; push() })
  screen.on('display-added', sync)
  screen.on('display-removed', sync)
  screen.on('display-metrics-changed', () => {
    if (windows.size > 0) {
      destroyAll()
      sync()
    }
  })
  sync()
}

export function disposeWallpaper() {
  if (timer) clearInterval(timer)
  destroyAll()
}

export async function pickWallpaperFile(): Promise<string | null> {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Resim ve video', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'mp4', 'webm', 'm4v'] }],
  })
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}

export async function pickWallpaperFolder(): Promise<string | null> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}

