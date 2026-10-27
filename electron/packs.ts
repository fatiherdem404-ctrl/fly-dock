// Theme and icon packs: a .flypack file is a zip with pack.json plus either theme.json or icons.json + images.
// Everything coming out of a pack is validated here before it is written to disk or reaches the renderer.
import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { readZip, writeZip, ZipEntry, ZipLimits } from './zip'
import type { PackInfo, ThemeDef, ThemeVars, DockItem } from '../src/shared/types'

export const PACK_EXTENSION = 'flypack'

const LIMITS: ZipLimits = { maxEntries: 1000, maxEntryBytes: 8 * 1024 * 1024, maxTotalBytes: 100 * 1024 * 1024 }
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXT = new Set(['.json', '.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'])
const IMAGE_EXT = new Set(['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'])
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/

const packsRoot = () => path.join(app.getPath('userData'), 'packs')
const packDir = (type: PackInfo['type'], id: string) => path.join(packsRoot(), type, id)

// ---- built-in themes ----

const GLASS_DARK: ThemeVars = {
  surface: 'rgba(24, 26, 32, 0.62)',
  surfaceBorder: 'rgba(255, 255, 255, 0.14)',
  surfaceBlur: 24,
  radius: 20,
  shadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
  indicator: '#8ab4ff',
  tooltipBg: 'rgba(18, 20, 26, 0.92)',
  tooltipText: '#f2f4f8',
  accent: '#4da3ff',
  panelBg: '#14161c',
  panelText: '#eef1f6',
  panelMuted: '#98a2b3',
  fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
}

const BUILTIN_THEMES: ThemeDef[] = [
  { id: 'glass-dark', name: 'Glass Dark', author: 'built-in', vars: GLASS_DARK },
  {
    id: 'frost-light',
    name: 'Frost Light',
    author: 'built-in',
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
    id: 'neon-night',
    name: 'Neon Night',
    author: 'built-in',
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
  return BUILTIN_THEMES.map((t) => ({ id: t.id, type: 'theme', name: t.name, author: t.author, builtin: true }))
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
    const vars = validateTheme(parseJson(byName.get('theme.json'), 'theme.json'), GLASS_DARK)
    files.push({ name: 'theme.json', data: Buffer.from(JSON.stringify({ vars }, null, 2)) })
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
    files.push({ name: 'icons.json', data: Buffer.from(JSON.stringify({ map }, null, 2)) })
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
      if (manifest && manifest.type === t && manifest.id === id) result.push({ ...manifest })
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
    const vars = validateTheme(JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')), GLASS_DARK)
    return { id, name: manifest.name, author: manifest.author, version: manifest.version, vars }
  } catch {
    return null
  }
}

export function installPack(buf: Buffer): PackInfo {
  const { manifest, files } = validatePackArchive(buf)
  if (manifest.type === 'theme' && BUILTIN_THEMES.some((t) => t.id === manifest.id)) throw new Error('that id belongs to a built-in theme')
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
  if (!ID_PATTERN.test(id)) return
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
      { name: 'theme.json', data: Buffer.from(JSON.stringify({ vars: builtin.vars }, null, 2)) },
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
}

/** Image file inside the active icon pack for this item, if the pack has one. */
export function packIconFor(packId: string, item: DockItem, trashHasItems: boolean): string | null {
  if (!packId) return null
  const map = iconMap(packId)
  if (!map) return null
  let key: string
  if (item.type === 'trash') key = trashHasItems ? 'trash-full' : 'trash'
  else if (item.type === 'folder' || item.type === 'stack') key = 'folder'
  else if (item.targetPath) {
    key = path.win32.basename(item.targetPath, path.win32.extname(item.targetPath)).toLowerCase()
    if (!map[key] && item.type === 'file') key = 'file'
  } else return null
  const file = map[key]
  return file ? path.join(packDir('icons', packId), ...file.split('/')) : null
}
