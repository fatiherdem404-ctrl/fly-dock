import { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, screen, globalShortcut, MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import brand from './brand'
import { getItems, setItems, getSettings, updateSettings, getWidgets, setWidgets } from './store'
import { handle, broadcast } from './ipc'
import { helper } from './helper'
import {
  setSnapshot, runningState, addPaths, addSeparator, removeItem, updateItem, replaceItems,
  activateItem, openRecycleBin, launchAtLogin, loginEnabled, onItemsChanged, visibleItems, isRunningItem, broadcastItems, createGroup, addToGroup, addStartButton, addSpecial,
} from './items'
import { iconForItem, setTrashState } from './icons'
import { shellIcon, thumbnail } from './iconService'
import { askConfirm, askInput, answerConfirm, confirmIsOpen } from './confirm'
import { registerWallpaperScheme, initWallpaper, disposeWallpaper, sync as syncWallpaper, advance as nextWallpaper, restartSlideshow, setFullscreenPaused, wallpaperInfo, pickWallpaperFile, pickWallpaperFolder, pickNewWallpaper, wallpaperLibrary, addWallpaper, editWallpaper, removeWallpaper, libraryFile } from './wallpaper'
import { initCursors, disposeCursors, cursorPacks, cursorStatus, applyCursorPack, createCursorPack, importCursorFile, importCursorFolder, setCursorRole, clearCursorRole, setCursorRoleOptions, renameCursorPack, removeCursorPack, exportCursorPack } from './cursors'
import { showEntryMenu } from './entryMenu'
import { menuIsOpen } from './contextMenu'
import { listLibrary, libraryThumb, pickImage, addLibraryFolder, removeLibraryFolder } from './iconLibrary'
import { showIconPicker, closeIconPicker, pickerInfo, applyPickedIcon } from './iconPicker'
import { builderKeys, pickBuilderFolder, createBuilderPack, createPackFromPngs } from './packBuilder'
import { initDockWindows, syncDocks, setLayout, applyLayer, dockIsOnTop, isDockHidden, setFullscreenHidden, toggleDockVisibility, disposeDockWindows } from './dockWindows'
import { baseWebPreferences, loadRoute, HEADLESS, OFFSCREEN } from './windows'
import {
  importPackDialog, exportPackDialog, themeDeskSettings, themeWallpaperFile, listThemes, createThemePack, listInstalled, builtinPackInfos, getTheme, removePack, clearPackCaches,
} from './packs'
import { showStack, showPanel, closeStack, readEntries, stackIsFocused, dialogJustClosed, setStackCapture } from './stackWindow'
import { wheelEntries, runWheelEntry, setWheelState, addWheelEntry, removeWheelEntry, setWheelIcon } from './wheel'
import { showPowerMenu, closePowerMenu, runPowerAction } from './power'
import { createTweakEngine, realRegistry, TWEAKS } from './tweaks'
import { runElevated } from './elevated'
import { pickTexture, readTexture, removeTexture, textureBytes, storeTexture } from './textures'
import { store } from './store'
import { listPlaces, addPlace, placeIcon } from './places'
import { initToys, disposeToys, syncToys, applyToyLayer, setToysCapture, setToysFullscreen, toyScores } from './toys'
import { popupMenu, menuItemsForRenderer, pickMenuItem, closeMenu, MenuSpec } from './contextMenu'
import { initWidgets, addWidget, removeWidget, updateWidget, moveWidget, systemStats, weatherFor, nowPlaying, disposeWidgets } from './widgets'
import type { DockItem, DockSettings, StackEntry } from '../src/shared/types'

// A dock that is covered by a full-screen window (or parked off-screen in tests) must keep animating.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null

// ---- windows: settings and stack popup ----

const SETTINGS_SIZE = { width: 1100, height: 760 }
/** The settings window can be dragged from its edges between these sizes; it is never maximised. */
const SETTINGS_LIMITS = { minWidth: 760, minHeight: 540, maxWidth: 1320, maxHeight: 920 }

/** The remembered window rectangle, but only if enough of it is still on a screen (monitors come and go). */
function savedSettingsBounds(): { x: number; y: number; width: number; height: number; maximized: boolean } | null {
  const saved = store.get('settingsWindow')
  if (!saved || HEADLESS) return null
  const visible = screen.getAllDisplays().some((d) => {
    const w = d.workArea
    const overlapX = Math.min(saved.x + saved.width, w.x + w.width) - Math.max(saved.x, w.x)
    const overlapY = Math.min(saved.y + saved.height, w.y + w.height) - Math.max(saved.y, w.y)
    return overlapX > 200 && overlapY > 120
  })
  return visible ? saved : null
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  const saved = savedSettingsBounds()
  const win = new BrowserWindow({
    ...SETTINGS_SIZE,
    ...SETTINGS_LIMITS,
    maximizable: false,
    fullscreenable: false,
    title: `${brand.name} — Ayarlar`,
    // our own title bar is drawn by the page
    frame: false,
    // tests keep the window alive but far off-screen: a hidden window gets no animation frames to capture
    ...(HEADLESS ? { x: -OFFSCREEN, y: 0 } : {}),
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), brand.logo.icon),
    webPreferences: baseWebPreferences(),
  })
  settingsWindow = win
  win.setMenuBarVisibility(false)
  // set after creation: the constructor sizes frameless windows slightly differently from getBounds()
  if (saved) {
    win.setBounds({
      x: saved.x,
      y: saved.y,
      width: Math.min(Math.max(saved.width, SETTINGS_LIMITS.minWidth), SETTINGS_LIMITS.maxWidth),
      height: Math.min(Math.max(saved.height, SETTINGS_LIMITS.minHeight), SETTINGS_LIMITS.maxHeight),
    })
  }
  loadRoute(win, '/settings')

  let timer: NodeJS.Timeout | null = null
  const remember = () => {
    if (win.isDestroyed() || HEADLESS) return
    const bounds = win.getBounds()
    store.set('settingsWindow', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized: false })
  }
  const later = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(remember, 400)
  }
  win.on('resize', later)
  win.on('move', later)
  win.on('close', remember)
  win.on('closed', () => {
    settingsWindow = null
  })
}

// ---- tray, shortcuts, menus ----

function createTray() {
  const image = nativeImage.createFromPath(path.join(app.getAppPath(), brand.logo.icon)).resize({ width: 16, height: 16 })
  if (image.isEmpty()) return
  tray = new Tray(image)
  tray.setToolTip(brand.name)
  const rebuild = () =>
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Ayarlar', click: openSettings },
        { label: 'Dock\'u göster / gizle', click: toggleDockVisibility },
        { label: 'Otomatik gizle', type: 'checkbox', checked: getSettings().autoHide, click: (m) => applySettings({ autoHide: m.checked }) },
        { type: 'separator' },
        { label: 'Destek ol (Ko-fi)', click: () => shell.openExternal(brand.kofiUrl) },
        { label: `${brand.name} uygulamasından çık`, click: () => app.quit() },
      ]),
    )
  rebuild()
  tray.on('click', openSettings)
  return rebuild
}

function registerHotkeys() {
  globalShortcut.unregisterAll()
  const bind = (accelerator: string | undefined, action: () => void) => {
    if (!accelerator) return
    try {
      if (!globalShortcut.register(accelerator, action)) console.warn(`[hotkey] ${accelerator} is taken by another program`)
    } catch {
      console.warn(`[hotkey] ${accelerator} is not a valid shortcut`)
    }
  }
  bind(getSettings().toggleHotkey, toggleDockVisibility)
  for (const item of getItems()) bind(item.hotkey, () => activateItem(item.id, (i) => showStackAtCursor(i)))
}

function showStackAtCursor(item: DockItem) {
  const at = screen.getCursorScreenPoint()
  if (item.type === 'wheel') showPanel('/wheel', at)
  else if (item.type === 'power') showPowerMenu()
  else showStack(item, at)
}

const tweakEngine = createTweakEngine({
  registry: realRegistry,
  tweaks: TWEAKS,
  elevated: runElevated,
  store: {
    get: () => ({ applied: store.get('tweaks')?.applied ?? {}, log: store.get('tweaks')?.log ?? [] }),
    set: (state) => store.set('tweaks', state),
  },
})

function restartExplorer() {
  execFile('taskkill.exe', ['/f', '/im', 'explorer.exe'], { windowsHide: true }, () => {
    spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref()
  })
}

/** What a new theme should carry as its wallpaper: the live scene or the picture/video currently chosen. */
function currentWallpaperForTheme(): { live?: string; file?: string } | null {
  const s = getSettings()
  if (s.wallpaperMode === 'single') {
    if (s.wallpaperSingle.startsWith('live:')) return { live: s.wallpaperSingle.slice(5) }
    if (s.wallpaperSingle.startsWith('lib:')) {
      const file = libraryFile(s.wallpaperSingle.slice(4))
      return file ? { file } : null
    }
    return s.wallpaperSingle ? { file: s.wallpaperSingle } : null
  }
  if (s.wallpaperMode === 'theme') {
    const theme = getTheme(s.theme)
    if (theme?.wallpaper?.live) return { live: theme.wallpaper.live }
    const file = themeWallpaperFile(s.theme)
    return file ? { file } : null
  }
  return null
}

function applySettings(request: Partial<DockSettings>): DockSettings {
  const before = getSettings()
  let partial = request
  // choosing a theme also gives the dock the shelf that belongs to it
  if (request.theme !== undefined && request.theme !== before.theme && (request.themeDesk ?? before.themeDesk)) {
    const desk = themeDeskSettings(request.theme)
    if (desk) partial = { ...request, ...desk }
  }
  const next = updateSettings(partial)
  if (partial.launchAtLogin !== undefined) launchAtLogin(next.launchAtLogin)
  if (partial.toggleHotkey !== undefined) registerHotkeys()
  if (partial.iconPack !== undefined) clearPackCaches()
  if (Object.keys(partial).some((k) => k.startsWith('wallpaper') || k === 'theme')) {
    if (['wallpaperMode', 'wallpaperSingle', 'wallpaperFolder', 'wallpaperShuffle'].some((k) => k in partial)) restartSlideshow()
    syncWallpaper()
  }
  const layoutChanged = (['position', 'monitor', 'autoHide', 'edgeOffset', 'alignment'] as const).some((k) => k in partial && before[k] !== next[k])
  if (layoutChanged) syncDocks()
  if (Object.keys(partial).some((k) => k.startsWith('toy'))) syncToys()
  if (partial.toyLayer !== undefined) applyToyLayer()
  if (partial.layer !== undefined) applyLayer()
  if (partial.showRunningApps !== undefined) broadcastItems()
  broadcast('settings:changed', next)
  return next
}

function showMenu(_e: Electron.IpcMainInvokeEvent, payload: { kind: 'empty' | 'icon'; itemId?: string }) {
  const specs: MenuSpec[] = []
  const add = (label: string, icon: string, action: () => void, extra: Partial<MenuSpec> = {}) => specs.push({ label, icon, action, ...extra })
  const separator = () => specs.push({ separator: true })
  const item = payload.itemId ? visibleItems().find((i) => i.id === payload.itemId) : undefined
  const locked = getSettings().lockItems

  if (payload.kind === 'icon' && item && isRunningItem(item.id)) {
    add('Aç', 'open', () => activateItem(item.id, showStackAtCursor))
    add("Dock'ta tut", 'pin', () => addPaths([item.targetPath!], getItems().length), { disabled: locked })
    add('Pencereyi kapat', 'close', () => closeWindowsOf(item))
  } else if (payload.kind === 'icon' && item && item.type !== 'separator') {
    if (item.type === 'trash') {
      add('Aç', 'open', openRecycleBin)
      add('Çöp kutusunu boşalt', 'trash', async () => {
        const yes = await askConfirm({ title: 'Çöp kutusu boşaltılsın mı?', message: 'İçindeki her şey kalıcı olarak silinir. Bu geri alınamaz.', confirmLabel: 'Boşalt', danger: true })
        if (!yes) return
        await helper.emptyTrash().catch(() => {})
        broadcast('sound:play', 'trashEmpty')
      }, { danger: true })
    } else {
      add('Aç', 'open', () => activateItem(item.id, showStackAtCursor))
      if (item.type === 'app') add('Çalışan pencereyi kapat', 'close', () => closeWindowsOf(item))
      if (item.type === 'folder') add('Yığın olarak göster', 'stack', () => updateItem(item.id, { type: 'stack' }))
      if (item.type === 'stack') add('Klasör olarak göster', 'folder', () => updateItem(item.id, { type: 'folder' }))
      if (item.type === 'group') add('Gruba ekle…', 'plus', () => pickForGroup(item.id))
      if (item.targetPath) add('Konumunu göster', 'location', () => shell.showItemInFolder(item.targetPath!))
      separator()
      add('Simge değiştir…', 'image', () => showIconPicker(item.id))
      if (item.customIconPath) add('Simgeyi sıfırla', 'refresh', () => updateItem(item.id, { customIconPath: undefined }))
      add("Dock'tan kaldır", 'trash', () => removeItem(item.id), { danger: true, disabled: locked })
    }
  } else {
    add('Program ekle…', 'plus', () => pickAndAdd(['openFile'], [{ name: 'Programlar', extensions: ['exe', 'lnk'] }]), { disabled: locked })
    add('Klasör ekle…', 'folder', () => pickAndAdd(['openDirectory']), { disabled: locked })
    add('Yeni grup', 'group', () => createGroup(), { disabled: locked })
    add('Hazır öğe ekle…', 'apps', showPlacesMenu, { disabled: locked })
    add('Ayraç ekle', 'minus', addSeparator, { disabled: locked })
  }
  separator()
  add('Ayarlar', 'settings', openSettings)
  add('Otomatik gizle', 'eyeOff', () => applySettings({ autoHide: !getSettings().autoHide }), { checked: getSettings().autoHide })
  add('Simgeleri kilitle', 'lock', () => applySettings({ lockItems: !locked }), { checked: locked })
  add('Çıkış', 'power', () => app.quit(), { danger: true })
  popupMenu(specs)
}

const PLACE_MENU_ICON: Record<string, string> = { computer: 'monitor', profile: 'heart', network: 'network', controlpanel: 'controlpanel', trash: 'trash', power: 'power', start: 'play' }

/** A second menu with the ready-made items the dock does not have yet (it replaces the first one at the pointer). */
function showPlacesMenu() {
  const missing = listPlaces().filter((p) => !p.added)
  const specs: MenuSpec[] = missing.map((p) => ({ label: p.label, icon: PLACE_MENU_ICON[p.id] ?? 'folder', action: () => void addPlace(p.id) }))
  if (specs.length === 0) specs.push({ label: 'Hepsi zaten dockta', icon: 'check', action: () => {}, disabled: true })
  popupMenu(specs)
}

async function pickForGroup(id: string) {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
  if (!result.canceled && result.filePaths.length) addToGroup(id, result.filePaths)
}

async function closeWindowsOf(item: DockItem) {
  const { windowsOf } = await import('./items')
  for (const w of windowsOf(item)) await helper.close(w.hwnd).catch(() => {})
}

async function pickAndAdd(properties: ('openFile' | 'openDirectory')[], filters?: Electron.FileFilter[]) {
  const result = await dialog.showOpenDialog({ properties, filters })
  if (!result.canceled && result.filePaths[0]) addPaths(result.filePaths, getItems().length)
}

// ---- IPC ----

function registerIpc() {
  handle('items:get', () => visibleItems())
  handle('items:set', (_e, items) => replaceItems(items))
  handle('items:add-paths', (_e, paths, index) => addPaths(paths, index))
  handle('items:remove', (_e, id) => removeItem(id))
  handle('items:update', (_e, id, patch) => updateItem(id, patch))
  handle('items:activate', (_e, id) => activateItem(id, showStackAtCursor))
  handle('places:list', () => listPlaces())
  handle('places:add', (_e, id) => addPlace(id))
  handle('places:icon', (_e, id) => placeIcon(id))
  handle('items:icon', (_e, id) => {
    const item = visibleItems().find((i) => i.id === id)
    return item ? iconForItem(item) : null
  })
  handle('stack:thumb', (_e, target, size) => thumbnail(target, Math.min(Math.max(Number(size) || 96, 32), 256)).catch(() => null))
  handle('icon:path', (_e, target) => shellIcon(target, 96).catch(() => null))

  handle('settings:get', () => getSettings())
  handle('settings:update', (_e, partial) => applySettings(partial))
  handle('displays:list', () =>
    screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `${i + 1}: ${d.size.width}×${d.size.height}`, primary: d.id === screen.getPrimaryDisplay().id })),
  )

  handle('windows:get', () => runningState())
  handle('trash:get', async () => ({ items: (await helper.trash().catch(() => ({ items: 0 }))).items }))
  handle('trash:drop', async (_e, paths) => {
    for (const p of paths) await shell.trashItem(p).catch((err) => console.error('trash failed', p, err))
  })

  handle('menu:show', showMenu)
  handle('dock:layout', (_e, layout) => setLayout(layout))
  handle('dock:state', () => ({ hidden: isDockHidden(), onTop: dockIsOnTop() }))

  handle('stack:list', (_e, id) => {
    const item = visibleItems().find((i) => i.id === id)
    return item ? readEntries(item) : []
  })
  handle('stack:open', async (_e, target) => {
    closeStack()
    await shell.openPath(target)
  })
  handle('texture:pick', () => pickTexture())
  handle('texture:get', (_e, file) => readTexture(file))
  handle('texture:remove', (_e, file) => removeTexture(file))
  handle('stack:close', () => closeStack())
  handle('stack:show', (_e, id, anchor) => {
    const item = visibleItems().find((i) => i.id === id)
    if (item) showStack(item, anchor)
  })
  handle('wheel:list', () => wheelEntries())
  handle('wheel:run', async (_e, id) => {
    const ok = await runWheelEntry(id)
    if (ok) closeStack()
    return ok
  })
  handle('wheel:add', async (_e, kind) => ((await addWheelEntry(kind)) ? wheelEntries() : null))
  handle('wheel:remove', (_e, id) => {
    removeWheelEntry(id)
    return wheelEntries()
  })
  handle('wheel:icon', async (_e, id, file) => ({ ...(await setWheelIcon(id, file === null)), data: wheelEntries() }))
  handle('wheel:set', (_e, state) => {
    setWheelState(state)
    return wheelEntries()
  })
  handle('power:run', (_e, action) => runPowerAction(action))
  handle('power:close', () => closePowerMenu())
  handle('tweaks:list', () => tweakEngine.list())
  handle('tweaks:set', (_e, id, enabled) => tweakEngine.set(id, enabled))
  handle('tweaks:restore-point', () => tweakEngine.restorePoint())
  handle('tweaks:revert-all', async () => {
    const yes = await askConfirm({ title: 'Tüm tweakler geri alınsın mı?', message: 'Fly Dock’un değiştirdiği her Windows ayarı eski değerine döner. Yönetici gerektirenler için Windows onay isteyebilir.', confirmLabel: 'Geri al', danger: true })
    return yes ? tweakEngine.revertAll() : 0
  })
  handle('tweaks:log', () => tweakEngine.log())
  handle('tweaks:restart-explorer', () => restartExplorer())
  handle('group:add', (_e, id, paths) => addToGroup(id, paths))
  handle('menu:items', () => menuItemsForRenderer())
  handle('menu:pick', (_e, index) => pickMenuItem(index))
  handle('menu:close', () => closeMenu())

  handle('themes:list', () => listThemes())
  handle('themes:get', (_e, id) => getTheme(id))
  handle('window:control', (e, action) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') (win.isMaximizable() ? (win.isMaximized() ? win.unmaximize() : win.maximize()) : void 0)
    else win.close()
  })
  handle('window:is-maximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
  handle('wallpaper:info', () => wallpaperInfo())
  handle('wallpaper:next', () => nextWallpaper())
  handle('wallpaper:pick-file', () => pickWallpaperFile())
  handle('cursors:list', () => cursorPacks())
  handle('cursors:status', () => cursorStatus())
  handle('cursors:apply', async (_e, id) => {
    const r = await applyCursorPack(id)
    applySettings({ cursorPack: r.active || (id ? '' : '') })
    return r
  })
  handle('cursors:create', (_e, name, copyOf) => createCursorPack(name, copyOf))
  handle('cursors:import-file', () => importCursorFile())
  handle('cursors:import-folder', () => importCursorFolder())
  handle('cursors:set-role', (_e, id, role, strip) => setCursorRole(id, role, strip))
  handle('cursors:clear-role', (_e, id, role) => clearCursorRole(id, role))
  handle('cursors:role-options', (_e, id, role, options) => setCursorRoleOptions(id, role, options))
  handle('cursors:rename', (_e, id, name) => renameCursorPack(id, name))
  handle('cursors:export', (_e, id) => exportCursorPack(id))
  handle('cursors:remove', async (_e, id) => {
    const pack = cursorPacks().find((p) => p.id === id)
    if (!pack || pack.builtin) return false
    if (!(await askConfirm({ title: `"${pack.name}" silinsin mi?`, message: 'İmleç paketi bu bilgisayardan kaldırılır. Dışa aktarmadıysan geri getiremezsin.', confirmLabel: 'Sil', danger: true }))) return false
    await removeCursorPack(id)
    if (getSettings().cursorPack === id) applySettings({ cursorPack: '' })
    return true
  })
  handle('wallpaper:pick-new', (_e, existing) => pickNewWallpaper(existing))
  handle('wallpaper:library', () => wallpaperLibrary())
  handle('wallpaper:add', (_e, draft) => addWallpaper(draft))
  handle('wallpaper:edit', (_e, id, patch) => editWallpaper(id, patch))
  handle('wallpaper:remove', (_e, id) => removeWallpaper(id))
  handle('wallpaper:pick-folder', () => pickWallpaperFolder())
  handle('confirm:answer', (_e, id, answer, text) => answerConfirm(id, answer, text))
  handle('entry:menu', (_e, request) => showEntryMenu(request))
  handle('panel:capture', (_e, on) => setStackCapture(on === true))
  handle('toys:capture', (_e, on) => setToysCapture(on === true))
  handle('toys:scores', (_e, patch) => toyScores(patch))
  handle('panel:blurred', async () => {
    // a menu or question opened from the window takes the focus and gives it back; wait for that before judging
    await new Promise((r) => setTimeout(r, 200))
    return !menuIsOpen() && !confirmIsOpen() && !stackIsFocused() && !dialogJustClosed()
  })
  handle('themes:create', (_e, name, author, vars, withDesk, withWallpaper) => {
    const result = createThemePack(name, author, vars, withDesk === true ? getSettings() : null, withWallpaper === true ? currentWallpaperForTheme() : null)
    if (result.ok) broadcast('themes:changed', null)
    return result
  })
  handle('builder:keys', () => builderKeys())
  handle('library:list', () => listLibrary())
  handle('library:thumb', (_e, file) => libraryThumb(file))
  handle('library:pick', () => pickImage())
  handle('library:add-folder', () => addLibraryFolder())
  handle('library:remove-folder', (_e, folder) => removeLibraryFolder(folder))
  handle('iconpick:show', (_e, target) => showIconPicker(target))
  handle('iconpick:info', (_e, target) => pickerInfo(target))
  handle('iconpick:apply', (_e, target, file) => {
    const result = applyPickedIcon(target, file)
    if (result.ok) broadcast('icons:changed', null)
    return result
  })
  handle('iconpick:close', () => closeIconPicker())
  handle('builder:folder', (_e, keys) => pickBuilderFolder(keys))
  handle('studio:make-pack', (_e, name, author, images, card) => {
    const result = createPackFromPngs(name, author, images, card)
    if (result.ok) {
      clearPackCaches()
      broadcast('themes:changed', null)
    }
    return result
  })
  handle('builder:create', (_e, name, author, map) => {
    const result = createBuilderPack(name, author, map)
    if (result.ok) {
      clearPackCaches()
      broadcast('themes:changed', null)
    }
    return result
  })
  handle('packs:list', () => [...builtinPackInfos(), ...listInstalled()])
  handle('packs:import', async () => {
    const result = await importPackDialog()
    if (result.ok) {
      clearPackCaches()
      broadcast('themes:changed', null)
    }
    return result
  })
  handle('packs:export', async (_e, id) => {
    const info = [...builtinPackInfos(), ...listInstalled()].find((p) => p.id === id)
    return info ? exportPackDialog(info.type, id) : { ok: false, message: 'pack not found' }
  })
  handle('packs:remove', async (_e, id) => {
    const info = listInstalled().find((p) => p.id === id)
    if (info && (await askConfirm({ title: `"${info.name}" silinsin mi?`, message: 'Paket bu bilgisayardan kaldırılır. Dışa aktarmadıysan geri getiremezsin.', confirmLabel: 'Sil', danger: true }))) {
      removePack(info.type, id)
      if (info.type === 'theme' && getSettings().theme === id) applySettings({ theme: 'glass-dark' })
      if (info.type === 'icons' && getSettings().iconPack === id) applySettings({ iconPack: '' })
      clearPackCaches()
      broadcast('themes:changed', null)
    }
    return [...builtinPackInfos(), ...listInstalled()]
  })

  handle('widgets:list', () => getWidgets())
  handle('widgets:add', (_e, type) => addWidget(type))
  handle('widgets:remove', (_e, id) => removeWidget(id))
  handle('widgets:update', (_e, id, options) => updateWidget(id, options))
  handle('widgets:move', (_e, id, x, y) => moveWidget(id, x, y))
  handle('widgets:system', () => systemStats())
  handle('widgets:weather', (_e, city) => weatherFor(city))
  handle('widgets:media', async (_e, key) => void (await helper.mediaKey(key).catch(() => {})))
  handle('widgets:now-playing', () => nowPlaying())

  handle('app:open-settings', () => openSettings())
  handle('app:open-external', (_e, target) => {
    const url = target === 'support' ? brand.kofiUrl : target === 'repo' ? brand.repoUrl : brand.issuesUrl
    return shell.openExternal(url)
  })
  handle('app:info', () => ({ name: brand.name, version: app.getVersion(), tagline: brand.tagline.tr, kofiUrl: brand.kofiUrl, loginSupported: app.isPackaged, loginEnabled: loginEnabled() }))
  handle('backup:export', exportBackup)
  handle('backup:import', importBackup)
  handle('app:quit', () => app.quit())
}

// ---- backup ----

async function exportBackup() {
  const result = await dialog.showSaveDialog({ defaultPath: `${brand.slug}-backup.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (result.canceled || !result.filePath) return { ok: false, message: 'cancelled' }
  const texture = textureBytes(getSettings().deskTexFile)
  const data = { app: brand.slug, version: 1, items: getItems(), settings: getSettings(), widgets: getWidgets(), texture: texture ? texture.toString('base64') : undefined }
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
  return { ok: true, message: result.filePath }
}

async function importBackup() {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'cancelled' }
  try {
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    if (!(await askConfirm({ title: 'Yedek geri yüklensin mi?', message: 'Şu anki ayarların, dock öğelerin ve widget’ların yedektekilerle değiştirilir. Uygulama yeniden başlar.', confirmLabel: 'Geri yükle', danger: true }))) return { ok: false, message: 'cancelled' }
    if (data?.app !== brand.slug || !Array.isArray(data.items) || typeof data.settings !== 'object') throw new Error('this is not a backup of this app')
    const defaults = getSettings() as unknown as Record<string, unknown>
    const settings: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data.settings as Record<string, unknown>)) {
      if (key in defaults && typeof value === typeof defaults[key]) settings[key] = value // unknown or mistyped keys are dropped
    }
    const items = (data.items as DockItem[]).filter((i) => i && typeof i.id === 'string' && typeof i.type === 'string')
    // the custom texture travels inside the backup; it is stored again under a name made from its own content
    if (typeof data.texture === 'string') {
      const stored = storeTexture(Buffer.from(data.texture, 'base64'))
      settings.deskTexFile = stored.ok ? stored.file : ''
    } else settings.deskTexFile = ''
    updateSettings(settings as Partial<DockSettings>)
    setItems(items)
    if (Array.isArray(data.widgets)) setWidgets(data.widgets)
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 300)
    return { ok: true, message: 'restarting' }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}

// ---- lifecycle ----

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', openSettings)
  app.setAppUserModelId(brand.appId)

  registerWallpaperScheme() // has to happen before the app is ready
  app.whenReady().then(() => {
    registerIpc()
    helper.start()
    helper.on('windows', (snap) => {
      setSnapshot(snap)
      if (getSettings().layer === 'below') applyLayer() // another window may have been raised past the dock
      setFullscreenHidden(getSettings().hideInFullscreen && snap.fullscreen)
      setFullscreenPaused(snap.fullscreen)
      setToysFullscreen(snap.fullscreen)
    })
    helper.on('trash', (info: { items: number }) => {
      setTrashState(info.items)
      broadcast('trash:changed', info)
    })
    helper.call<{ items: number }>('trash').then((t) => setTrashState(t.items)).catch(() => {})

    initDockWindows()
    initWallpaper()
    initCursors()
    initToys()
    // screenshot runs ask for the confirmation window so it can be looked at
    if (HEADLESS && process.env.FLY_DOCK_TEST_CONFIRM === 'input') setTimeout(() => void askInput({ title: 'Yeniden adlandır', message: 'Yeni adı yaz.', confirmLabel: 'Adlandır', value: 'rapor-2026.docx' }), 1500)
    else if (HEADLESS && process.env.FLY_DOCK_TEST_CONFIRM) setTimeout(() => void askConfirm({ title: 'Çöp kutusu boşaltılsın mı?', message: 'İçindeki her şey kalıcı olarak silinir. Bu geri alınamaz.', confirmLabel: 'Boşalt', danger: true }), 1500)
    initWidgets()
    createTray()
    registerHotkeys()
    onItemsChanged(registerHotkeys)
    launchAtLogin(getSettings().launchAtLogin)
  })

  app.on('window-all-closed', () => {
    /* tray app: closing the settings window must not quit */
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    disposeDockWindows()
    disposeWallpaper()
    void disposeCursors()
    disposeToys()
    disposeWidgets()
    helper.stop()
  })
}
