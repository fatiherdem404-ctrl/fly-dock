// The icon library: pictures from folders the user added plus the images of every installed icon pack, shown as one
// grid in the icon picker and the pack builder. A picture can only be read back if it lives in one of those places
// or was chosen in a system dialog this session.
import { app, dialog, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getSettings, updateSettings } from './store'
import { builtinIconRoot } from './packs'
import type { LibraryIcon } from '../src/shared/types'

export const IMAGE_EXT = new Set(['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'])
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_ICONS = 2500
const MIME: Record<string, string> = { '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

const packsRoot = () => path.join(app.getPath('userData'), 'packs', 'icons')
const picked = new Set<string>()
const norm = (p: string) => path.resolve(p).toLowerCase()

const isImage = (file: string) => IMAGE_EXT.has(path.extname(file).toLowerCase())

function walk(dir: string, depth: number, out: string[]) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= MAX_ICONS) return
    const full = path.join(dir, e.name)
    if (e.isFile() && isImage(e.name)) out.push(full)
    else if (e.isDirectory() && depth > 0) walk(full, depth - 1, out)
  }
}

/** Every picture the user can choose from, with where it came from. */
export function listLibrary(): { icons: LibraryIcon[]; folders: string[] } {
  const folders = getSettings().iconFolders.filter((f) => fs.existsSync(f))
  const icons: LibraryIcon[] = []
  for (const folder of folders) {
    const files: string[] = []
    walk(folder, 1, files)
    for (const file of files) icons.push({ path: file, name: path.basename(file, path.extname(file)), source: path.basename(folder) || folder })
  }
  for (const root of [builtinIconRoot(), packsRoot()]) try {
    for (const id of fs.readdirSync(root)) {
      const files: string[] = []
      walk(path.join(root, id), 3, files)
      let source = id
      try {
        source = JSON.parse(fs.readFileSync(path.join(root, id, 'pack.json'), 'utf8')).name ?? id
      } catch {
        /* keep the id */
      }
      for (const file of files) icons.push({ path: file, name: path.basename(file, path.extname(file)), source })
    }
  } catch {
    /* no packs installed */
  }
  return { icons: icons.slice(0, MAX_ICONS), folders }
}

/** Is this image somewhere the user put it on purpose? */
export function isAllowedImage(file: string): boolean {
  if (typeof file !== 'string' || !isImage(file)) return false
  const target = norm(file)
  if (picked.has(target)) return true
  const roots = [builtinIconRoot(), packsRoot(), ...getSettings().iconFolders].map(norm)
  return roots.some((r) => target.startsWith(r + path.sep))
}

export function readAllowed(file: string): Buffer | null {
  if (!isAllowedImage(file)) return null
  try {
    const buf = fs.readFileSync(file)
    return buf.length > MAX_IMAGE_BYTES ? null : buf
  } catch {
    return null
  }
}

const thumbs = new Map<string, string | null>()

/** Small preview of a library picture as a data URL. */
export function libraryThumb(file: string): string | null {
  if (!isAllowedImage(file)) return null
  const key = norm(file)
  if (thumbs.has(key)) return thumbs.get(key) ?? null
  let url: string | null = null
  try {
    const ext = path.extname(file).toLowerCase()
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.ico') {
      const img = nativeImage.createFromPath(file)
      if (!img.isEmpty()) url = img.resize({ width: 72, height: 72, quality: 'good' }).toDataURL()
    }
    if (!url) {
      const buf = readAllowed(file)
      if (buf && buf.length <= 400 * 1024) url = `data:${MIME[ext]};base64,${buf.toString('base64')}`
    }
  } catch {
    /* unreadable picture */
  }
  if (thumbs.size > 3000) thumbs.clear()
  thumbs.set(key, url)
  return url
}

/** A picture chosen in the system dialog; it is usable for the rest of the session. */
export async function pickImage(): Promise<{ path: string; preview: string } | null> {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resim', extensions: ['png', 'ico', 'svg', 'jpg', 'jpeg', 'webp'] }] })
  if (r.canceled || !r.filePaths[0]) return null
  picked.add(norm(r.filePaths[0]))
  const preview = libraryThumb(r.filePaths[0])
  return preview ? { path: r.filePaths[0], preview } : null
}

export async function addLibraryFolder(): Promise<boolean> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return false
  const folders = getSettings().iconFolders
  if (!folders.some((f) => norm(f) === norm(r.filePaths[0]))) updateSettings({ iconFolders: [...folders, r.filePaths[0]] })
  return true
}

export function removeLibraryFolder(folder: string) {
  updateSettings({ iconFolders: getSettings().iconFolders.filter((f) => f !== folder) })
}

/** Picks a whole folder for the pack builder: pictures there are allowed for this session. */
export async function pickFolderImages(): Promise<string[]> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return []
  const files: string[] = []
  walk(r.filePaths[0], 0, files)
  for (const f of files) picked.add(norm(f))
  return files
}
