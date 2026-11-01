// Theme and icon packs: a .flypack file is a zip with pack.json plus either theme.json or icons.json + images.
// Everything coming out of a pack is validated here before it is written to disk or reaches the renderer.
import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { readZip, writeZip, ZipEntry, ZipLimits } from './zip'
import { DEFAULT_SETTINGS, DESK_KEYS, DESK_STYLES, LIVE_WALLPAPERS } from '../src/shared/types'
import type { PackInfo, ThemeDef, ThemeVars, ThemeDesk, DockItem, DockSettings, LiveWallpaperId } from '../src/shared/types'
import { sniff, MAX_TEXTURE_BYTES, storeTexture, textureBytes } from './textures'
import { DEFAULT_DESIGN } from '../src/studio/render'
import type { Design } from '../src/studio/render'

export const PACK_EXTENSION = 'flypack'

const LIMITS: ZipLimits = { maxEntries: 1000, maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 }
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXT = new Set(['.json', '.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp', '.mp4', '.webm'])
const IMAGE_EXT = new Set(['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'])
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/

const packsRoot = () => path.join(app.getPath('userData'), 'packs')
/** Icon packs that ship with the app: plain folders next to the program, never copied to the user's data. */
const BUILTIN_ICON_PACKS: { id: string; name: string; author: string }[] = []
export const builtinIconRoot = () => (app.isPackaged ? path.join(process.resourcesPath, 'icon-packs') : path.join(app.getAppPath(), 'resources', 'icon-packs'))
const isBuiltinIconPack = (id: string) => BUILTIN_ICON_PACKS.some((p) => p.id === id)

const packDir = (type: PackInfo['type'], id: string) => (type === 'icons' && isBuiltinIconPack(id) ? path.join(builtinIconRoot(), id) : path.join(packsRoot(), type, id))

// ---- built-in themes ----

const GLASS_DARK: ThemeVars = {
  surface: 'rgba(13, 20, 40, 0.78)',
  surfaceBorder: 'rgba(120, 165, 255, 0.28)',
  surfaceBlur: 24,
  radius: 20,
  shadow: '0 14px 34px rgba(2, 8, 30, 0.55)',
  indicator: '#5aa2ff',
  tooltipBg: 'rgba(10, 16, 34, 0.94)',
  tooltipText: '#eaf0ff',
  accent: '#2f7bff',
  panelBg: '#0a0f1f',
  panelText: '#e6ecff',
  panelMuted: '#8794b8',
  fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
}

const BUILTIN_THEMES: ThemeDef[] = [
  { id: 'glass-dark', name: 'Glass Dark', author: 'built-in', vars: GLASS_DARK, desk: { deskStyle: 'macos', deskDepth: 0, deskEdge: 0, deskOpacity: 1, deskRadTL: 24, deskRadTR: 24, deskRadBL: 24, deskRadBR: 24 }, wallpaper: { live: 'aurora' } },
  {
    id: 'frost-light',
    name: 'Frost Light',
    author: 'built-in',
    wallpaper: { live: 'flow' },
    desk: { deskStyle: 'glass', deskDepth: 0, deskEdge: 0, deskOpacity: 0.95, deskRadTL: 24, deskRadTR: 24, deskRadBL: 24, deskRadBR: 24 },
    vars: {
      ...GLASS_DARK,
      surface: 'rgba(255, 255, 255, 0.58)',
      surfaceBorder: 'rgba(255, 255, 255, 0.8)',
      shadow: '0 10px 28px rgba(40, 60, 90, 0.28)',
      indicator: '#1e6fe0',
      tooltipBg: 'rgba(255, 255, 255, 0.95)',
      tooltipText: '#1b2430',
      accent: '#1e6fe0',
      panelBg: '#f4f6fa',
      panelText: '#1b2430',
      panelMuted: '#5d6878',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    author: 'built-in',
    wallpaper: { live: 'stars' },
    desk: { deskStyle: 'matte', deskDepth: 0, deskEdge: 0, deskOpacity: 1, deskRadTL: 20, deskRadTR: 20, deskRadBL: 20, deskRadBR: 20 },
    vars: {
      ...GLASS_DARK,
      surface: '#1f2023',
      surfaceBorder: 'rgba(255, 255, 255, 0.1)',
      surfaceBlur: 0,
      radius: 16,
      shadow: '0 10px 28px rgba(0, 0, 0, 0.5)',
      indicator: '#8ab4ff',
      tooltipBg: '#2b2d31',
      tooltipText: '#f2f3f5',
      accent: '#4c8dff',
      panelBg: '#16171a',
      panelText: '#eceef2',
      panelMuted: '#9aa0aa',
    },
  },
  {
    id: 'light',
    name: 'Light',
    author: 'built-in',
    wallpaper: { live: 'waves' },
    desk: { deskStyle: 'metal', deskDepth: 0, deskEdge: 0, deskOpacity: 1, deskRadTL: 20, deskRadTR: 20, deskRadBL: 20, deskRadBR: 20 },
    vars: {
      ...GLASS_DARK,
      surface: '#ffffff',
      surfaceBorder: 'rgba(0, 0, 0, 0.1)',
      surfaceBlur: 0,
      radius: 16,
      shadow: '0 10px 28px rgba(30, 40, 60, 0.28)',
      indicator: '#2f6fed',
      tooltipBg: '#ffffff',
      tooltipText: '#1d2128',
      accent: '#2f6fed',
      panelBg: '#f3f4f6',
      panelText: '#1d2128',
      panelMuted: '#5f6877',
    },
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    author: 'built-in',
    wallpaper: { live: 'bubbles' },
    desk: { deskStyle: 'neon', deskDepth: 0, deskEdge: 0, deskOpacity: 1, deskRadTL: 60, deskRadTR: 60, deskRadBL: 60, deskRadBR: 60 },
    vars: {
      ...GLASS_DARK,
      surface: 'rgba(12, 6, 30, 0.7)',
      surfaceBorder: 'rgba(255, 64, 220, 0.55)',
      radius: 14,
      shadow: '0 0 28px rgba(255, 64, 220, 0.35)',
      indicator: '#ff40dc',
      tooltipBg: 'rgba(20, 8, 44, 0.95)',
      tooltipText: '#ffd9fa',
      accent: '#ff40dc',
      panelBg: '#0e0820',
      panelText: '#f6e8ff',
      panelMuted: '#a58bc4',
    },
  },
]

export function builtinThemeInfos(): PackInfo[] {
  return BUILTIN_THEMES.map((t) => ({ id: t.id, type: 'theme', name: t.name, author: t.author, builtin: true, hasDesk: !!t.desk, hasWallpaper: !!t.wallpaper?.live }))
}

/** Built-in themes and icon packs, as listed next to the installed ones. */
export function builtinPackInfos(): PackInfo[] {
  return [...builtinThemeInfos(), ...BUILTIN_ICON_PACKS.map((p): PackInfo => ({ id: p.id, type: 'icons', name: p.name, author: p.author, builtin: true }))]
}

// ---- validation ----

const COLOR_LIKE = /^[#0-9a-zA-Z(),.%\s\-/]{1,120}$/
const SHADOW_LIKE = /^[#0-9a-zA-Z(),.%\s\-/]{1,300}$/
const FONT_LIKE = /^[0-9a-zA-Z ,'"\-_.]{1,200}$/

function safeEntryName(name: string): string | null {
  const normalized = name.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null
  const parts = normalized.split('/')
  if (parts.some((p) => p === '..' || p === '' || p === '.')) return null
  if (!ALLOWED_EXT.has(path.extname(normalized).toLowerCase())) return null
  return parts.join('/')
}

function parseJson(entry: ZipEntry | undefined, label: string): any {
  if (!entry) throw new Error(`${label} is missing`)
  try {
    return JSON.parse(entry.data.toString('utf8'))
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

function validateTheme(raw: any, fallback: ThemeVars): ThemeVars {
  if (typeof raw !== 'object' || raw === null || typeof raw.vars !== 'object' || raw.vars === null) throw new Error('theme.json needs a "vars" object')
  const out: ThemeVars = { ...fallback }
  for (const key of Object.keys(fallback) as (keyof ThemeVars)[]) {
    if (!(key in raw.vars)) continue
    const value = raw.vars[key]
    if (typeof fallback[key] === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 80) throw new Error(`theme var ${key} must be a number from 0 to 80`)
      ;(out[key] as number) = value
    } else {
      const pattern = key === 'fontFamily' ? FONT_LIKE : key === 'shadow' ? SHADOW_LIKE : COLOR_LIKE
      if (typeof value !== 'string' || !pattern.test(value) || /url\(|@import|expression/i.test(value)) throw new Error(`theme var ${key} has an unsafe value`)
      ;(out[key] as string) = value
    }
  }
  return out
}

/** Only known shelf settings with the right kind of value get through; nothing else from a pack reaches the settings. */
function validateDesk(raw: any): ThemeDesk | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null) throw new Error('theme.json "desk" must be an object')
  const out: Record<string, unknown> = {}
  for (const key of DESK_KEYS) {
    if (!(key in raw)) continue
    const value = raw[key]
    const fallback = DEFAULT_SETTINGS[key]
    if (typeof value !== typeof fallback) throw new Error(`shelf setting ${key} has the wrong kind of value`)
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 600)) throw new Error(`shelf setting ${key} is out of range`)
    if (key === 'deskStyle' && !DESK_STYLES.includes(value)) throw new Error('unknown shelf style')
    if (key === 'deskTexMode' && value !== 'tile' && value !== 'fit') throw new Error('unknown texture mode')
    if (key === 'deskColor' && value !== '' && !COLOR_LIKE.test(value)) throw new Error('shelf colour is not valid')
    out[key] = value
  }
  return out as ThemeDesk
}

const TEXTURE_ENTRY = /^desk-texture\.(png|jpg|webp)$/
const WALLPAPER_ENTRY = /^wallpaper\.(png|jpg|webp|mp4|webm)$/

function validateWallpaper(raw: any): { live?: LiveWallpaperId } | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null) throw new Error('theme.json "wallpaper" must be an object')
  if (raw.live === undefined) return {}
  if (!LIVE_WALLPAPERS.some(([id]) => id === raw.live)) throw new Error('unknown live wallpaper')
  return { live: raw.live }
}

/** Pictures and videos are checked by their first bytes, not by their name. */
function looksLikeMedia(name: string, data: Buffer): boolean {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.mp4') return data.length > 12 && data.toString('ascii', 4, 8) === 'ftyp'
  if (ext === '.webm') return data.length > 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3
  return sniff(data) !== null
}

interface Manifest {
  type: PackInfo['type']
  id: string
  name: string
  author?: string
  version?: string
}

function validateManifest(raw: any): Manifest {
  if (typeof raw !== 'object' || raw === null) throw new Error('pack.json is invalid')
  if (raw.type !== 'theme' && raw.type !== 'icons') throw new Error('pack.json "type" must be "theme" or "icons"')
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) throw new Error('pack.json "id" must be 2-41 lowercase letters, digits or dashes')
  if (typeof raw.name !== 'string' || raw.name.length === 0 || raw.name.length > 60) throw new Error('pack.json "name" must be 1-60 characters')
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : undefined)
  return { type: raw.type, id: raw.id, name: raw.name, author: text(raw.author), version: text(raw.version) }
}

/** Parses and validates an archive; returns the files that may be written (already checked). */
export function validatePackArchive(buf: Buffer): { manifest: Manifest; files: ZipEntry[] } {
  if (buf.length > MAX_ARCHIVE_BYTES) throw new Error('pack file is larger than 50 MB')
  const entries = readZip(buf, LIMITS)
  const byName = new Map<string, ZipEntry>()
  for (const e of entries) {
    const safe = safeEntryName(e.name)
    if (!safe) throw new Error(`file "${e.name}" is not allowed in a pack`)
    byName.set(safe, { name: safe, data: e.data })
  }
  const manifest = validateManifest(parseJson(byName.get('pack.json'), 'pack.json'))
  const files: ZipEntry[] = [{ name: 'pack.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) }]

  if (manifest.type === 'theme') {
    const themeJson = parseJson(byName.get('theme.json'), 'theme.json')
    const vars = validateTheme(themeJson, GLASS_DARK)
    const desk = validateDesk(themeJson.desk)
    const wallpaper = validateWallpaper(themeJson.wallpaper)
    files.push({ name: 'theme.json', data: Buffer.from(JSON.stringify({ vars, ...(desk ? { desk } : {}), ...(wallpaper ? { wallpaper } : {}) }, null, 2)) })
    const movie = [...byName.values()].find((e) => WALLPAPER_ENTRY.test(e.name))
    if (movie) {
      if (!looksLikeMedia(movie.name, movie.data)) throw new Error('the wallpaper in the theme is not a valid picture or video')
      files.push(movie)
    }
    const texture = [...byName.values()].find((e) => TEXTURE_ENTRY.test(e.name))
    if (texture) {
      if (texture.data.length > MAX_TEXTURE_BYTES || !sniff(texture.data)) throw new Error('the shelf texture in the theme is not a valid picture')
      files.push(texture)
    }
  } else {
    const iconsJson = parseJson(byName.get('icons.json'), 'icons.json')
    if (typeof iconsJson?.map !== 'object' || iconsJson.map === null) throw new Error('icons.json needs a "map" object')
    const map: Record<string, string> = {}
    for (const [key, file] of Object.entries<any>(iconsJson.map)) {
      if (!/^[a-z0-9 ._-]{1,60}$/.test(key)) throw new Error(`icon key "${key}" is not valid`)
      const safe = typeof file === 'string' ? safeEntryName(file) : null
      if (!safe || !IMAGE_EXT.has(path.extname(safe).toLowerCase())) throw new Error(`icon "${key}" points to an invalid file`)
      if (!byName.has(safe)) throw new Error(`icon "${key}" points to ${safe}, which is not in the pack`)
      map[key] = safe
    }
    const card = sanitizeCard(iconsJson.card)
    files.push({ name: 'icons.json', data: Buffer.from(JSON.stringify(card ? { map, card } : { map }, null, 2)) })
    for (const file of new Set(Object.values(map))) files.push(byName.get(file)!)
  }
  return { manifest, files }
}

// ---- storage ----

function readManifest(dir: string): Manifest | null {
  try {
    return validateManifest(JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')))
  } catch {
    return null
  }
}

export function listInstalled(type?: PackInfo['type']): PackInfo[] {
  const result: PackInfo[] = []
  for (const t of type ? [type] : (['theme', 'icons'] as const)) {
    const root = path.join(packsRoot(), t)
    if (!fs.existsSync(root)) continue
    for (const id of fs.readdirSync(root)) {
      const manifest = readManifest(path.join(root, id))
      if (manifest && manifest.type === t && manifest.id === id) result.push({ ...manifest, ...(t === 'theme' ? { hasDesk: !!getTheme(id)?.desk, hasWallpaper: !!getTheme(id)?.wallpaper?.live || !!themeWallpaperFile(id) } : {}) })
    }
  }
  return result
}

export function listThemes(): PackInfo[] {
  return [...builtinThemeInfos(), ...listInstalled('theme')]
}

export function getTheme(id: string): ThemeDef | null {
  const builtin = BUILTIN_THEMES.find((t) => t.id === id)
  if (builtin) return builtin
  const dir = packDir('theme', id)
  const manifest = readManifest(dir)
  if (!manifest) return null
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'))
    const vars = validateTheme(raw, GLASS_DARK)
    return { id, name: manifest.name, author: manifest.author, version: manifest.version, vars, desk: validateDesk(raw.desk), wallpaper: validateWallpaper(raw.wallpaper) }
  } catch {
    return null
  }
}

export function installPack(buf: Buffer): PackInfo {
  const { manifest, files } = validatePackArchive(buf)
  if ((manifest.type === 'theme' && BUILTIN_THEMES.some((t) => t.id === manifest.id)) || (manifest.type === 'icons' && isBuiltinIconPack(manifest.id))) throw new Error('that id belongs to a built-in pack')
  const dir = packDir(manifest.type, manifest.id)
  fs.rmSync(dir, { recursive: true, force: true })
  for (const file of files) {
    const target = path.join(dir, ...file.name.split('/'))
    if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) throw new Error('unsafe path in pack')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file.data)
  }
  return { ...manifest }
}

export function removePack(type: PackInfo['type'], id: string) {
  if (!ID_PATTERN.test(id) || (type === 'icons' && isBuiltinIconPack(id))) return
  fs.rmSync(packDir(type, id), { recursive: true, force: true })
}

export async function importPackDialog(): Promise<{ ok: boolean; message: string; pack?: PackInfo }> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Fly packs', extensions: [PACK_EXTENSION, 'zip'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'cancelled' }
  try {
    const pack = installPack(fs.readFileSync(result.filePaths[0]))
    return { ok: true, message: pack.name, pack }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}

export async function exportPackDialog(type: PackInfo['type'], id: string): Promise<{ ok: boolean; message: string }> {
  let entries: ZipEntry[]
  let name = id
  const builtin = type === 'theme' ? BUILTIN_THEMES.find((t) => t.id === id) : undefined
  if (builtin) {
    name = builtin.name
    entries = [
      { name: 'pack.json', data: Buffer.from(JSON.stringify({ type: 'theme', id: `${id}-copy`, name: `${builtin.name} copy`, author: builtin.author }, null, 2)) },
      { name: 'theme.json', data: Buffer.from(JSON.stringify({ vars: builtin.vars, ...(builtin.desk ? { desk: builtin.desk } : {}) }, null, 2)) },
    ]
  } else {
    const dir = packDir(type, id)
    const manifest = readManifest(dir)
    if (!manifest) return { ok: false, message: 'pack not found' }
    name = manifest.name
    entries = []
    const walk = (d: string, prefix: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(d, f.name), `${prefix}${f.name}/`)
        else entries.push({ name: `${prefix}${f.name}`, data: fs.readFileSync(path.join(d, f.name)) })
      }
    }
    walk(dir, '')
  }
  const result = await dialog.showSaveDialog({ defaultPath: `${id}.${PACK_EXTENSION}`, filters: [{ name: 'Fly pack', extensions: [PACK_EXTENSION] }] })
  if (result.canceled || !result.filePath) return { ok: false, message: 'cancelled' }
  fs.writeFileSync(result.filePath, writeZip(entries))
  return { ok: true, message: name }
}

// ---- icon pack lookup ----

const iconMapCache = new Map<string, Record<string, string>>()

const ENUMS: Record<string, string[]> = {
  fill: ['solid', 'gradient', 'none'],
  pattern: ['none', 'dots', 'grid', 'stripes', 'waves', 'sheen', 'burst', 'grain', 'hex'],
  glyphMode: ['solid', 'gradient'],
}

/** A card design from a pack, kept only if every field has the right kind of value. */
export function sanitizeCard(raw: unknown): Design | null {
  if (typeof raw !== 'object' || raw === null) return null
  const out: Record<string, string | number> = {}
  for (const [key, def] of Object.entries(DEFAULT_DESIGN)) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof def === 'number') out[key] = typeof v === 'number' && Number.isFinite(v) ? Math.max(-1000, Math.min(1000, v)) : def
    else if (ENUMS[key]) out[key] = typeof v === 'string' && ENUMS[key].includes(v) ? v : def
    else out[key] = typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def
  }
  return out as unknown as Design
}

const cardCache = new Map<string, Design | null>()

/** The card an icon pack wants around program icons it has no picture for (null when it does not ask for one). */
export function packCard(packId: string): Design | null {
  if (!ID_PATTERN.test(packId)) return null
  if (cardCache.has(packId)) return cardCache.get(packId)!
  let card: Design | null = null
  try {
    card = sanitizeCard(JSON.parse(fs.readFileSync(path.join(packDir('icons', packId), 'icons.json'), 'utf8')).card)
  } catch {
    /* no card */
  }
  cardCache.set(packId, card)
  return card
}

function iconMap(packId: string): Record<string, string> | null {
  if (!ID_PATTERN.test(packId)) return null
  const cached = iconMapCache.get(packId)
  if (cached) return cached
  try {
    const map = JSON.parse(fs.readFileSync(path.join(packDir('icons', packId), 'icons.json'), 'utf8')).map as Record<string, string>
    iconMapCache.set(packId, map)
    return map
  } catch {
    return null
  }
}

export function clearPackCaches() {
  iconMapCache.clear()
  cardCache.clear()
}

/** Image file inside the active icon pack for this item, if the pack has one. */
export function packIconFor(packId: string, item: DockItem, trashHasItems: boolean): string | null {
  if (!packId) return null
  const map = iconMap(packId)
  if (!map) return null
  let key: string
  if (item.type === 'trash') key = trashHasItems ? 'trash-full' : 'trash'
  else if (item.type === 'start' || item.type === 'wheel' || item.type === 'power' || item.type === 'group') key = item.type
  else if (item.type === 'folder' || item.type === 'stack') {
    // A well-known folder (Documents, Downloads…) can have its own picture; any other folder gets the generic one.
    const named = item.targetPath ? path.win32.basename(item.targetPath).toLowerCase() : ''
    key = map[named] ? named : 'folder'
  } else if (item.targetPath) {
    // "shell:MyComputerFolder" style targets are keyed by what follows the colon.
    key = item.targetPath.toLowerCase().startsWith('shell:') ? item.targetPath.slice(6).toLowerCase() : path.win32.basename(item.targetPath, path.win32.extname(item.targetPath)).toLowerCase()
    if (!map[key] && item.type === 'file') key = 'file'
  } else return null
  const file = map[key]
  return file ? path.join(packDir('icons', packId), ...file.split('/')) : null
}

/** Picture a pack gives one gear-menu entry (key "wheel-<id>"), as a data URL. */
export function packWheelIcon(packId: string, wheelId: string): string | null {
  if (!packId) return null
  const file = iconMap(packId)?.[`wheel-${wheelId}`]
  if (!file) return null
  try {
    const full = path.join(packDir('icons', packId), ...file.split('/'))
    const ext = path.extname(full).slice(1).toLowerCase()
    return `data:image/${ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext};base64,${fs.readFileSync(full).toString('base64')}`
  } catch {
    return null
  }
}

/** The picture or video file a theme carries as its wallpaper, if any. */
export function themeWallpaperFile(id: string): string | null {
  const dir = packDir('theme', id)
  try {
    const entry = fs.readdirSync(dir).find((f) => WALLPAPER_ENTRY.test(f))
    return entry ? path.join(dir, entry) : null
  } catch {
    return null
  }
}

/** The shelf settings a theme brings (its texture stored as the custom desk picture), or null when it has none. */
export function themeDeskSettings(id: string): Partial<DockSettings> | null {
  const theme = getTheme(id)
  if (!theme?.desk) return null
  const out: Partial<DockSettings> = { ...theme.desk }
  if (theme.desk.deskStyle === 'custom') {
    const dir = packDir('theme', id)
    const entry = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => TEXTURE_ENTRY.test(f)) : undefined
    const stored = entry ? storeTexture(fs.readFileSync(path.join(dir, entry))) : null
    out.deskTexFile = stored?.ok && stored.file ? stored.file : ''
  }
  return out
}

/** Writes the theme made in the builder as a normal pack and installs it (same validation as an import). */
export function createThemePack(name: string, author: string, vars: ThemeVars, shelf: DockSettings | null = null, wallpaper: { live?: string; file?: string } | null = null): { ok: boolean; message: string; pack?: PackInfo } {
  const title = String(name).trim().slice(0, 60)
  if (!title) return { ok: false, message: 'Temaya bir ad ver.' }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'tema'
  const id = `${slug}-${Date.now().toString(36).slice(-4)}`
  try {
    const withDesk = !!shelf
    const desk: Record<string, unknown> = {}
    if (shelf) for (const key of DESK_KEYS) desk[key] = shelf[key]
    const entries: ZipEntry[] = [
      { name: 'pack.json', data: Buffer.from(JSON.stringify({ type: 'theme', id, name: title, author: String(author).trim().slice(0, 60) || undefined, version: '1.0' }, null, 2)) },
      { name: 'theme.json', data: Buffer.from(JSON.stringify({ vars, ...(withDesk ? { desk } : {}), ...(wallpaper?.live ? { wallpaper: { live: wallpaper.live } } : {}) }, null, 2)) },
    ]
    if (wallpaper?.file) {
      const data = fs.readFileSync(wallpaper.file)
      const ext = path.extname(wallpaper.file).toLowerCase().replace('.jpeg', '.jpg')
      if (data.length <= 8 * 1024 * 1024 && WALLPAPER_ENTRY.test(`wallpaper${ext}`) && looksLikeMedia(`wallpaper${ext}`, data)) entries.push({ name: `wallpaper${ext}`, data })
    }
    // a custom shelf picture travels inside the theme
    const bytes = shelf && shelf.deskStyle === 'custom' ? textureBytes(shelf.deskTexFile) : null
    const kind = bytes ? sniff(bytes) : null
    if (bytes && kind) entries.push({ name: `desk-texture.${kind}`, data: bytes })
    return { ok: true, message: title, pack: installPack(writeZip(entries)) }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
