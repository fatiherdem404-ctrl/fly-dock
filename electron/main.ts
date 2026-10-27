import { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, screen, globalShortcut, MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import brand from './brand'
import { getItems, getSettings, updateSettings, getWidgets } from './store'
import { handle, broadcast } from './ipc'
import { helper } from './helper'
import {
  setSnapshot, runningState, addPaths, addSeparator, removeItem, updateItem, replaceItems,
  activateItem, openRecycleBin, launchAtLogin, onItemsChanged,
} from './items'
import { iconForItem, setTrashState } from './icons'
import { shellIcon } from './iconService'
import { initDockWindows, syncDocks, setLayout, setSurface, materialSupported, refreshShelfTint, isDockHidden, setFullscreenHidden, toggleDockVisibility, disposeDockWindows } from './dockWindows'
import { baseWebPreferences, loadRoute } from './windows'
import {
  importPackDialog, exportPackDialog, listThemes, listInstalled, builtinThemeInfos, getTheme, removePack, clearPackCaches,
} from './packs'
import { initWidgets, addWidget, removeWidget, updateWidget, moveWidget, systemStats, weatherFor, nowPlaying, disposeWidgets } from './widgets'
import type { DockItem, DockSettings, StackEntry } from '../src/shared/types'

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let stackWindow: BrowserWindow | null = null

// ---- windows: settings and stack popup ----

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 780,
    minHeight: 520,
    title: `${brand.name} — Ayarlar`,
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), brand.logo.icon),
    webPreferences: baseWebPreferences(),
  })
  settingsWindow.setMenuBarVisibility(false)
  loadRoute(settingsWindow, '/settings')
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function readStack(item: DockItem): StackEntry[] {
  if (!item.targetPath) return []
  try {
    return fs
      .readdirSync(item.targetPath, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && !/^(desktop\.ini|thumbs\.db)$/i.test(d.name))
      .map((d) => ({ name: d.name, path: path.join(item.targetPath!, d.name), isDirectory: d.isDirectory() }))
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
      .slice(0, 60)
  } catch {
    return []
  }
}

function showStack(item: DockItem, anchor: { x: number; y: number }) {
  stackWindow?.destroy()
  const count = readStack(item).length
  const cols = Math.min(Math.max(count, 1), 4)
  const rows = Math.ceil(Math.max(count, 1) / cols)
  const width = cols * 88 + 28
  const height = Math.min(rows * 96 + 28, 480)
  const display = screen.getDisplayNearestPoint(anchor)
  const wa = display.workArea
  const { position } = getSettings()
  let x = anchor.x - width / 2
  let y = anchor.y - height - 10
  if (position === 'top') y = anchor.y + 10
  if (position === 'left') { x = anchor.x + 10; y = anchor.y - height / 2 }
  if (position === 'right') { x = anchor.x - width - 10; y = anchor.y - height / 2 }
  x = Math.min(Math.max(x, wa.x + 4), wa.x + wa.width - width - 4)
  y = Math.min(Math.max(y, wa.y + 4), wa.y + wa.height - height - 4)

  stackWindow = new BrowserWindow({
    x: Math.round(x), y: Math.round(y), width, height,
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, webPreferences: baseWebPreferences(),
  })
  stackWindow.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(stackWindow, `/stack/${item.id}`)
  stackWindow.once('ready-to-show', () => stackWindow?.show())
  stackWindow.on('blur', () => stackWindow?.destroy())
  stackWindow.on('closed', () => {
    stackWindow = null
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
  showStack(item, screen.getCursorScreenPoint())
}

function applySettings(partial: Partial<DockSettings>): DockSettings {
  const before = getSettings()
  const next = updateSettings(partial)
  if (partial.launchAtLogin !== undefined) launchAtLogin(next.launchAtLogin)
  if (partial.toggleHotkey !== undefined) registerHotkeys()
  if (partial.iconPack !== undefined) clearPackCaches()
  const layoutChanged = (['position', 'monitor', 'material', 'autoHide'] as const).some((k) => k in partial && before[k] !== next[k])
  if (layoutChanged) syncDocks()
  if (partial.theme !== undefined) refreshShelfTint()
  broadcast('settings:changed', next)
  return next
}

function showMenu(e: Electron.IpcMainInvokeEvent, payload: { kind: 'empty' | 'icon'; itemId?: string }) {
  const template: MenuItemConstructorOptions[] = []
  const item = payload.itemId ? getItems().find((i) => i.id === payload.itemId) : undefined

  if (payload.kind === 'icon' && item) {
    if (item.type === 'trash') {
      template.push({ label: 'Aç', click: openRecycleBin }, { label: 'Çöp kutusunu boşalt', click: () => helper.emptyTrash().catch(() => {}) })
    } else if (item.type !== 'separator') {
      template.push({ label: 'Aç', click: () => activateItem(item.id, showStackAtCursor) })
      if (item.type === 'app') {
        template.push({ label: 'Çalışan pencereyi kapat', click: () => closeWindowsOf(item) })
      }
      if (item.type === 'folder') template.push({ label: 'Yığın olarak göster', click: () => updateItem(item.id, { type: 'stack' }) })
      if (item.type === 'stack') template.push({ label: 'Klasör olarak göster', click: () => updateItem(item.id, { type: 'folder' }) })
      if (item.targetPath) template.push({ label: 'Konumunu göster', click: () => shell.showItemInFolder(item.targetPath!) })
      template.push(
        { type: 'separator' },
        { label: 'Simge değiştir…', click: () => pickIconFor(item.id) },
        ...(item.customIconPath ? [{ label: 'Simgeyi sıfırla', click: () => updateItem(item.id, { customIconPath: undefined }) }] : []),
      )
    }
    if (item.type !== 'trash') template.push({ label: 'Dock\'tan kaldır', click: () => removeItem(item.id) })
  } else {
    template.push(
      { label: 'Program ekle…', click: () => pickAndAdd(['openFile'], [{ name: 'Programlar', extensions: ['exe', 'lnk'] }]) },
      { label: 'Klasör ekle…', click: () => pickAndAdd(['openDirectory']) },
      { label: 'Ayraç ekle', click: addSeparator },
    )
  }
  template.push(
    { type: 'separator' },
    { label: 'Ayarlar', click: openSettings },
    { label: 'Otomatik gizle', type: 'checkbox', checked: getSettings().autoHide, click: (m) => applySettings({ autoHide: m.checked }) },
    { label: 'Çıkış', click: () => app.quit() },
  )
  Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(e.sender) ?? undefined })
}

async function closeWindowsOf(item: DockItem) {
  const { windowsOf } = await import('./items')
  for (const w of windowsOf(item)) await helper.close(w.hwnd).catch(() => {})
}

async function pickAndAdd(properties: ('openFile' | 'openDirectory')[], filters?: Electron.FileFilter[]) {
  const result = await dialog.showOpenDialog({ properties, filters })
  if (!result.canceled && result.filePaths[0]) addPaths(result.filePaths, getItems().length)
}

async function pickIconFor(id: string) {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Simgeler', extensions: ['ico', 'png', 'svg', 'jpg', 'webp'] }] })
  if (!result.canceled && result.filePaths[0]) updateItem(id, { customIconPath: result.filePaths[0] })
}

// ---- IPC ----

function registerIpc() {
  handle('items:get', () => getItems())
  handle('items:set', (_e, items) => replaceItems(items))
  handle('items:add-paths', (_e, paths, index) => addPaths(paths, index))
  handle('items:remove', (_e, id) => removeItem(id))
  handle('items:update', (_e, id, patch) => updateItem(id, patch))
  handle('items:activate', (_e, id) => activateItem(id, showStackAtCursor))
  handle('items:icon', (_e, id) => {
    const item = getItems().find((i) => i.id === id)
    return item ? iconForItem(item) : null
  })
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
  handle('dock:surface', (e, surface) => setSurface(e.sender.id, surface))
  handle('dock:state', () => ({ hidden: isDockHidden() }))

  handle('stack:list', (_e, id) => {
    const item = getItems().find((i) => i.id === id)
    return item ? readStack(item) : []
  })
  handle('stack:open', async (_e, target) => {
    stackWindow?.destroy()
    await shell.openPath(target)
  })
  handle('stack:show', (_e, id, anchor) => {
    const item = getItems().find((i) => i.id === id)
    if (item) showStack(item, anchor)
  })

  handle('themes:list', () => listThemes())
  handle('themes:get', (_e, id) => getTheme(id))
  handle('packs:list', () => [...builtinThemeInfos(), ...listInstalled()])
  handle('packs:import', async () => {
    const result = await importPackDialog()
    if (result.ok) {
      clearPackCaches()
      refreshShelfTint()
      broadcast('themes:changed', null)
    }
    return result
  })
  handle('packs:export', async (_e, id) => {
    const info = [...builtinThemeInfos(), ...listInstalled()].find((p) => p.id === id)
    return info ? exportPackDialog(info.type, id) : { ok: false, message: 'pack not found' }
  })
  handle('packs:remove', (_e, id) => {
    const info = listInstalled().find((p) => p.id === id)
    if (info) {
      removePack(info.type, id)
      if (info.type === 'theme' && getSettings().theme === id) applySettings({ theme: 'glass-dark' })
      if (info.type === 'icons' && getSettings().iconPack === id) applySettings({ iconPack: '' })
      clearPackCaches()
      broadcast('themes:changed', null)
    }
    return [...builtinThemeInfos(), ...listInstalled()]
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
  handle('app:info', () => ({ name: brand.name, version: app.getVersion(), tagline: brand.tagline.tr, kofiUrl: brand.kofiUrl, materialSupported }))
  handle('app:quit', () => app.quit())
}

// ---- lifecycle ----

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', openSettings)
  app.setAppUserModelId(brand.appId)

  app.whenReady().then(() => {
    registerIpc()
    helper.start()
    helper.on('windows', (snap) => {
      setSnapshot(snap)
      setFullscreenHidden(getSettings().hideInFullscreen && snap.fullscreen)
    })
    helper.on('trash', (info: { items: number }) => {
      setTrashState(info.items)
      broadcast('trash:changed', info)
    })
    helper.call<{ items: number }>('trash').then((t) => setTrashState(t.items)).catch(() => {})

    initDockWindows()
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
    disposeWidgets()
    helper.stop()
  })
}
