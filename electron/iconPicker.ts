// The icon picker window (RocketDock's "Icon Settings"): opened from a dock icon's menu or the gear-menu settings,
// it shows the whole icon library and applies the chosen picture to one target.
import { BrowserWindow, nativeImage, screen } from 'electron'
import path from 'node:path'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import { getItems } from './store'
import { updateItem } from './items'
import { iconForItem } from './icons'
import { readAllowed } from './iconLibrary'
import { storeTexture } from './textures'
import { wheelEntries, setWheelIconFile } from './wheel'

let win: BrowserWindow | null = null

export function showIconPicker(target: string) {
  win?.destroy()
  const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const w = Math.min(808, width - 40)
  const h = Math.min(668, height - 40)
  const next = new BrowserWindow({
    x: Math.round(x + (width - w) / 2) - OFFSCREEN, y: Math.round(y + (height - h) / 2), width: w, height: h,
    frame: false, transparent: true, hasShadow: false, resizable: false, minimizable: false, maximizable: false, skipTaskbar: true,
    alwaysOnTop: true, show: false, webPreferences: baseWebPreferences(),
  })
  win = next
  next.setAlwaysOnTop(true, 'screen-saver')
  next.setMenuBarVisibility(false)
  loadRoute(next, `/iconpick?target=${encodeURIComponent(target)}`)
  next.once('ready-to-show', () => {
    next.show()
    next.focus()
  })
  next.on('closed', () => {
    if (win === next) win = null
  })
}

export function closeIconPicker() {
  win?.destroy()
  win = null
}

/** Name and current picture of the thing being changed. */
export async function pickerInfo(target: string): Promise<{ name: string; current: string | null; custom: boolean } | null> {
  if (target.startsWith('wheel:')) {
    const entry = wheelEntries().entries.find((e) => e.id === target.slice(6))
    return entry ? { name: entry.name, current: null, custom: !!entry.iconFile } : null
  }
  const item = getItems().find((i) => i.id === target)
  if (!item) return null
  return { name: item.label || (item.targetPath ? path.basename(item.targetPath, path.extname(item.targetPath)) : item.type), current: await iconForItem(item), custom: !!item.customIconPath }
}

const UNREADABLE = 'Bu resim okunamadı ya da 2 MB’tan büyük.'

/** Gives the target the picture, or the default again when `file` is null. */
export function applyPickedIcon(target: string, file: string | null): { ok: boolean; message: string } {
  if (target.startsWith('wheel:')) {
    const id = target.slice(6)
    if (file === null) return setWheelIconFile(id, null)
    const buf = readAllowed(file)
    if (!buf) return { ok: false, message: UNREADABLE }
    // the gear menu keeps pictures in the texture store (png, jpeg, webp); icons are converted to png first
    const asPng = path.extname(file).toLowerCase() === '.ico' ? nativeImage.createFromBuffer(buf).toPNG() : buf
    const stored = storeTexture(asPng)
    if (!stored.ok || !stored.file) return { ok: false, message: stored.message }
    return setWheelIconFile(id, stored.file)
  }
  if (!getItems().some((i) => i.id === target)) return { ok: false, message: 'unknown item' }
  if (file !== null && !readAllowed(file)) return { ok: false, message: UNREADABLE }
  updateItem(target, { customIconPath: file ?? undefined })
  return { ok: true, message: 'ok' }
}
