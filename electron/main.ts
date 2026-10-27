import { app, BrowserWindow, ipcMain, screen, Tray, Menu, dialog, shell, nativeImage, MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {
  getItems, setItems, getSettings, updateSettings, DockItem,
} from './store'
import { helper, HelperWindow } from './helper'
import { resolveIcon } from './iconService'
import brand from './brand'

const isDev = !app.isPackaged
let dockWindow: BrowserWindow | null = null
let tray: Tray | null = null

const toRunningApp = (w: HelperWindow) => ({ windowId: w.hwnd, processId: w.pid, exePath: w.exePath, title: w.title, isMinimized: w.minimized })
let lastWindows: HelperWindow[] = []

function computeDockBounds(contentWidth: number, contentHeight: number) {
  const { position } = getSettings()
  const display = screen.getPrimaryDisplay()
  const { x: wx, y: wy, width: sw, height: sh } = display.workArea

  const margin = 8
  switch (position) {
    case 'top':
      return { x: Math.round(wx + (sw - contentWidth) / 2), y: wy + margin, width: contentWidth, height: contentHeight }
    case 'left':
      return { x: wx + margin, y: Math.round(wy + (sh - contentHeight) / 2), width: contentWidth, height: contentHeight }
    case 'right':
      return { x: wx + sw - contentWidth - margin, y: Math.round(wy + (sh - contentHeight) / 2), width: contentWidth, height: contentHeight }
    case 'bottom':
    default:
      return { x: Math.round(wx + (sw - contentWidth) / 2), y: wy + sh - contentHeight - margin, width: contentWidth, height: contentHeight }
  }
}

function createDockWindow() {
  dockWindow = new BrowserWindow({
    width: 200,
    height: 100,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  dockWindow.setAlwaysOnTop(true, 'screen-saver')
  dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    dockWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    dockWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Reposition whenever display metrics change (resolution swap, DPI change, etc.)
  screen.on('display-metrics-changed', () => {
    const bounds = dockWindow?.getBounds()
    if (bounds) dockWindow?.setBounds(computeDockBounds(bounds.width, bounds.height))
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '..', brand.logo.tray)
  if (!fs.existsSync(iconPath)) {
    console.warn(`[tray] icon not found at ${iconPath} — skipping tray icon`)
    return
  }
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    console.warn(`[tray] icon at ${iconPath} failed to decode — skipping tray icon`)
    return
  }

  tray = new Tray(image)
  tray.setToolTip(brand.name)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Settings', click: () => dockWindow?.webContents.send('open-settings') },
      { label: 'Auto-hide', type: 'checkbox', checked: getSettings().autoHide, click: (item) => updateSettings({ autoHide: item.checked }) },
      { type: 'separator' },
      { label: `Quit ${brand.name}`, click: () => app.quit() },
    ]),
  )
}

app.whenReady().then(() => {
  createDockWindow()
  createTray()

  helper.start()
  helper.on('windows', (snap: { windows: HelperWindow[] }) => {
    lastWindows = snap.windows
    dockWindow?.webContents.send('running-apps-changed', lastWindows.map(toRunningApp))
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDockWindow()
  })
})

app.on('window-all-closed', () => {
  helper.stop()
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC surface consumed by the renderer (see electron/preload.ts) ----

ipcMain.handle('dock:get-items', () => getItems())
ipcMain.handle('dock:set-items', (_e, items: DockItem[]) => setItems(items))
ipcMain.handle('dock:get-settings', () => getSettings())
ipcMain.handle('dock:update-settings', (_e, partial) => updateSettings(partial))

ipcMain.handle('dock:resize', (_e, { width, height }: { width: number; height: number }) => {
  if (!dockWindow) return
  dockWindow.setBounds(computeDockBounds(width, height))
})

ipcMain.handle('dock:resolve-icon', (_e, { targetPath, customIconPath }: { targetPath: string; customIconPath?: string }) =>
  resolveIcon(targetPath, customIconPath).catch(() => null),
)

ipcMain.handle('dock:get-running-apps', () => lastWindows.map(toRunningApp))
ipcMain.handle('dock:activate-window', (_e, windowId: number) => helper.activate(windowId))
ipcMain.handle('dock:minimize-window', (_e, windowId: number) => helper.minimize(windowId))

ipcMain.handle('dock:pick-executable', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Applications', extensions: ['exe', 'lnk'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dock:launch', async (_e, targetPath: string) => {
  const errorMsg = await shell.openPath(targetPath)
  if (errorMsg) console.error(`Failed to launch ${targetPath}: ${errorMsg}`)
})

ipcMain.handle('dock:pick-icon', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Icons', extensions: ['ico', 'png'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ---- Item mutation helpers, driven by the right-click context menu ----

function broadcastItems() {
  dockWindow?.webContents.send('items-changed', getItems())
}

function nextOrder(items: DockItem[]): number {
  const nonTrash = items.filter((i) => i.type !== 'trash')
  return nonTrash.length > 0 ? Math.max(...nonTrash.map((i) => i.order)) + 1 : 0
}

function addProgramItem(exePath: string) {
  const items = getItems()
  const label = path.basename(exePath, path.extname(exePath))
  const newItem: DockItem = {
    id: crypto.randomUUID(),
    type: 'app',
    targetPath: exePath,
    label,
    order: nextOrder(items),
  }
  setItems([...items, newItem])
  broadcastItems()
}

function addSeparatorItem() {
  const items = getItems()
  const newItem: DockItem = { id: crypto.randomUUID(), type: 'separator', order: nextOrder(items) }
  setItems([...items, newItem])
  broadcastItems()
}

function removeItem(itemId: string) {
  setItems(getItems().filter((i) => i.id !== itemId))
  broadcastItems()
}

async function setCustomIconForItem(itemId: string) {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Icons', extensions: ['ico', 'png'] }],
  })
  if (result.canceled || !result.filePaths[0]) return
  setItems(getItems().map((i) => (i.id === itemId ? { ...i, customIconPath: result.filePaths[0] } : i)))
  broadcastItems()
}

interface ContextMenuPayload {
  kind: 'empty' | 'icon'
  itemId?: string
  itemType?: DockItem['type']
}

ipcMain.handle('dock:show-context-menu', (_e, payload: ContextMenuPayload) => {
  const template: MenuItemConstructorOptions[] = []

  if (payload.kind === 'empty') {
    template.push(
      {
        label: 'Program Ekle…',
        click: async () => {
          const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Programlar', extensions: ['exe', 'lnk'] }],
          })
          if (!result.canceled && result.filePaths[0]) addProgramItem(result.filePaths[0])
        },
      },
      { label: 'Ayraç Ekle', click: () => addSeparatorItem() },
      { type: 'separator' },
      { label: 'Ayarlar', click: () => dockWindow?.webContents.send('open-settings') },
      { label: 'Çıkış', click: () => app.quit() },
    )
  } else if (payload.kind === 'icon' && payload.itemId && payload.itemType !== 'trash') {
    template.push(
      { label: 'Simge Değiştir…', click: () => setCustomIconForItem(payload.itemId!) },
      { label: 'Kaldır', click: () => removeItem(payload.itemId!) },
    )
  }

  if (template.length > 0) {
    Menu.buildFromTemplate(template).popup({ window: dockWindow ?? undefined })
  }
})
