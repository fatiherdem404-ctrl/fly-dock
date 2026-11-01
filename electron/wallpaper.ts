// Wallpapers: one borderless window per display, parked behind the desktop icons by the helper. It shows the current
// picture, video or built-in live scene, and a folder can rotate on a timer. Nothing in Windows is changed: when the
// app closes the windows go with it and the user's own wallpaper is back. Pictures and videos reach the window through
// a private protocol that serves only the files this module has listed, never a path the window asks for.
import { app, BrowserWindow, dialog, net, powerMonitor, protocol, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import { getSettings, updateSettings } from './store'
import { baseWebPreferences, loadRoute, HEADLESS, OFFSCREEN } from './windows'
import { helper } from './helper'
import { broadcast } from './ipc'
import { getTheme, themeWallpaperFile } from './packs'
import { LIVE_WALLPAPERS } from '../src/shared/types'
import type { WallpaperSource, WallpaperInfo, WallpaperItem, WallpaperDraft, WallpaperPicked } from '../src/shared/types'

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
let pointerTimer: NodeJS.Timeout | null = null
let clicksOn = false
const lastPointer = new Map<number, string>()

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
    if (s.wallpaperSingle.startsWith('lib:')) {
      const item = readLibrary().find((i) => i.id === s.wallpaperSingle.slice(4))
      if (!item) return null
      if (item.kind === 'scene') return item.code ? { kind: 'scene', code: item.code } : null
      return sourceFromFile(storedPath(item))
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

/**
 * The wallpaper sits behind the desktop icons and gets no mouse events, so while a live scene is showing the app
 * reads the cursor about 30 times a second and tells each wallpaper window where it is (only what changed).
 */
function startPointerFeed() {
  if (pointerTimer) return
  clicksOn = true
  helper.watchClicks(true).catch(() => {})
  pointerTimer = setInterval(() => {
    if (windows.size === 0 || paused() || !getSettings().wallpaperReact) return
    const p = screen.getCursorScreenPoint()
    for (const display of screen.getAllDisplays()) {
      const win = windows.get(display.id)
      if (!win || win.isDestroyed() || win.webContents.isDestroyed()) continue
      const b = display.bounds
      const on = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height
      const x = Math.round(((p.x - b.x) / b.width) * 1000) / 1000
      const y = Math.round(((p.y - b.y) / b.height) * 1000) / 1000
      const key = on ? `${x},${y}` : 'off'
      if (lastPointer.get(display.id) === key) continue
      lastPointer.set(display.id, key)
      win.webContents.send('wallpaper:pointer', { x, y, on })
    }
  }, 33)
}

function stopPointerFeed() {
  if (clicksOn) helper.watchClicks(false).catch(() => {})
  clicksOn = false
  if (pointerTimer) clearInterval(pointerTimer)
  pointerTimer = null
  lastPointer.clear()
}

function destroyAll() {
  stopPointerFeed()
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
  if (current.kind === 'live' || current.kind === 'scene') startPointerFeed()
  else stopPointerFeed()
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

/** A click on the desktop came from the helper: tell the wallpaper window of the display it happened on. */
function onDesktopClick(p: { x: number; y: number }) {
  if (paused() || !getSettings().wallpaperReact) return
  const dip = screen.screenToDipPoint({ x: p.x, y: p.y })
  for (const display of screen.getAllDisplays()) {
    const b = display.bounds
    if (dip.x < b.x || dip.x >= b.x + b.width || dip.y < b.y || dip.y >= b.y + b.height) continue
    const win = windows.get(display.id)
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('wallpaper:click', { x: (dip.x - b.x) / b.width, y: (dip.y - b.y) / b.height })
  }
}

export function initWallpaper() {
  installProtocol()
  helper.on('click', onDesktopClick)
  // a restarted helper has forgotten that it was watching
  helper.on('ready', () => {
    if (clicksOn) helper.watchClicks(true).catch(() => {})
  })
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

// ---- Library: pictures and videos are copied into the app's own folder (so the original can move or go), scenes are code ----

interface StoredItem {
  id: string
  name: string
  author: string
  note: string
  kind: 'image' | 'video' | 'scene'
  stored?: string // file name inside the library folder
  code?: string
  size: number
  added: number
}

const libDir = () => path.join(app.getPath('userData'), 'wallpapers')
const libIndex = () => path.join(libDir(), 'library.json')
const MAX_CODE = 64 * 1024
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

function readLibrary(): StoredItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(libIndex(), 'utf8'))
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === 'string') : []
  } catch {
    return []
  }
}

function writeLibrary(list: StoredItem[]) {
  fs.mkdirSync(libDir(), { recursive: true })
  const tmp = libIndex() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2))
  fs.renameSync(tmp, libIndex())
  broadcast('wallpaper:library-changed', null)
}

const storedPath = (i: StoredItem) => (i.stored ? path.join(libDir(), 'files', i.stored) : '')

function toItem(i: StoredItem): WallpaperItem {
  const file = storedPath(i)
  return {
    id: i.id,
    name: i.name,
    author: i.author,
    note: i.note,
    kind: i.kind,
    url: file && fs.existsSync(file) ? `flymedia://${register(file)}/` : undefined,
    code: i.kind === 'scene' ? i.code : undefined,
    size: i.size,
    added: i.added,
  }
}

export const wallpaperLibrary = (): WallpaperItem[] => readLibrary().map(toItem).sort((a, b) => b.added - a.added)

/** The stored file behind a library entry (for a theme that wants to carry it). */
export function libraryFile(id: string): string | null {
  const item = readLibrary().find((i) => i.id === id)
  const file = item ? storedPath(item) : ''
  return file && fs.existsSync(file) ? file : null
}

/** A file chosen in the add dialog: listed for preview only, nothing is copied until it is added. */
export async function pickNewWallpaper(existing?: string): Promise<WallpaperPicked | null> {
  // `existing` is only honoured for the file the settings already point at (an old, unnamed choice moving into the library)
  const file = existing && existing === getSettings().wallpaperSingle && fs.existsSync(existing) ? existing : await pickWallpaperFile()
  if (!file) return null
  const kind = kindOf(file)
  if (!kind) return null
  return { file, fileName: path.basename(file), kind, url: `flymedia://${register(file)}/`, size: fs.statSync(file).size }
}

export function addWallpaper(draft: WallpaperDraft): WallpaperItem {
  const list = readLibrary()
  const id = crypto.randomBytes(6).toString('hex')
  const base: StoredItem = {
    id,
    name: clip(draft.name, 80) || 'Adsız duvar kâğıdı',
    author: clip(draft.author, 80),
    note: clip(draft.note, 400),
    kind: draft.kind,
    size: 0,
    added: Date.now(),
  }
  if (draft.kind === 'scene') {
    const code = typeof draft.code === 'string' ? draft.code.slice(0, MAX_CODE) : ''
    if (!code.trim()) throw new Error('Sahne kodu boş')
    base.code = code
  } else {
    const src = draft.file ?? ''
    const kind = kindOf(src)
    if (!kind || !fs.existsSync(src)) throw new Error('Dosya bulunamadı')
    base.kind = kind
    base.stored = `${id}${path.extname(src).toLowerCase()}`
    fs.mkdirSync(path.join(libDir(), 'files'), { recursive: true })
    fs.copyFileSync(src, storedPath(base))
    base.size = fs.statSync(storedPath(base)).size
  }
  writeLibrary([...list, base])
  return toItem(base)
}

export function editWallpaper(id: string, patch: Partial<Pick<WallpaperItem, 'name' | 'author' | 'note' | 'code'>>): WallpaperItem | null {
  const list = readLibrary()
  const item = list.find((i) => i.id === id)
  if (!item) return null
  if (patch.name !== undefined) item.name = clip(patch.name, 80) || item.name
  if (patch.author !== undefined) item.author = clip(patch.author, 80)
  if (patch.note !== undefined) item.note = clip(patch.note, 400)
  if (patch.code !== undefined && item.kind === 'scene' && patch.code.trim()) item.code = patch.code.slice(0, MAX_CODE)
  writeLibrary(list)
  if (getSettings().wallpaperSingle === `lib:${id}`) push()
  return toItem(item)
}

export function removeWallpaper(id: string) {
  const list = readLibrary()
  const item = list.find((i) => i.id === id)
  if (!item) return
  // only the app's own copy goes; the original the user picked is never touched
  const file = storedPath(item)
  if (file) {
    for (const [mid, p] of media) if (p === file) media.delete(mid)
    try { fs.unlinkSync(file) } catch { /* already gone */ }
  }
  writeLibrary(list.filter((i) => i.id !== id))
  if (getSettings().wallpaperSingle === `lib:${id}`) {
    updateSettings({ wallpaperSingle: 'live:aurora' })
    broadcast('settings:changed', getSettings())
    sync()
  }
}

export async function pickWallpaperFolder(): Promise<string | null> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}

