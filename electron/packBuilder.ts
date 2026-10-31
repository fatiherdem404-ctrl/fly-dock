// Icon pack builder: the user assigns pictures to the keys a pack can replace (programs by file name, folders,
// recycle bin), then the result is written as an ordinary .flypack and installed through the same validation as
// an imported one. Only image files picked in a system dialog during this session can be read back.
import { dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getItems } from './store'
import { installPack } from './packs'
import { writeZip, ZipEntry } from './zip'
import type { PackInfo, PackBuilderKey } from '../src/shared/types'

const IMAGE_EXT = new Set(['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp'])
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const picked = new Set<string>()

const MIME: Record<string, string> = { '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

const keyOfPath = (p: string) => path.win32.basename(p, path.win32.extname(p)).toLowerCase().replace(/[^a-z0-9 ._-]/g, '').slice(0, 60)

/** Everything a pack can replace: the dock's own programs and files, then the generic folder / file / trash icons. */
export function builderKeys(): PackBuilderKey[] {
  const keys: PackBuilderKey[] = []
  const seen = new Set<string>()
  for (const item of getItems()) {
    if (!item.targetPath || (item.type !== 'app' && item.type !== 'file')) continue
    const key = keyOfPath(item.targetPath)
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push({ key, label: item.label || key, path: item.targetPath })
  }
  keys.push({ key: 'folder', label: 'Klasörler' }, { key: 'file', label: 'Diğer dosyalar' }, { key: 'trash', label: 'Geri dönüşüm kutusu (boş)' }, { key: 'trash-full', label: 'Geri dönüşüm kutusu (dolu)' })
  return keys
}

function remember(file: string): { path: string; preview: string } | null {
  const ext = path.extname(file).toLowerCase()
  if (!IMAGE_EXT.has(ext)) return null
  try {
    const buf = fs.readFileSync(file)
    if (buf.length > MAX_IMAGE_BYTES) return null
    picked.add(file)
    return { path: file, preview: `data:${MIME[ext]};base64,${buf.toString('base64')}` }
  } catch {
    return null
  }
}

export async function pickBuilderImage(): Promise<{ path: string; preview: string } | null> {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resim', extensions: ['png', 'ico', 'svg', 'jpg', 'jpeg', 'webp'] }] })
  return r.canceled || !r.filePaths[0] ? null : remember(r.filePaths[0])
}

/** A folder of pictures named like the programs (chrome.png, folder.png…) fills every matching key at once. */
export async function pickBuilderFolder(keys: string[]): Promise<Record<string, { path: string; preview: string }>> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  const out: Record<string, { path: string; preview: string }> = {}
  if (r.canceled || !r.filePaths[0]) return out
  for (const f of fs.readdirSync(r.filePaths[0], { withFileTypes: true })) {
    if (!f.isFile()) continue
    const key = keyOfPath(f.name)
    if (!keys.includes(key) || out[key]) continue
    const got = remember(path.join(r.filePaths[0], f.name))
    if (got) out[key] = got
  }
  return out
}

export function createBuilderPack(name: string, author: string, map: Record<string, string>): { ok: boolean; message: string; pack?: PackInfo } {
  const title = name.trim().slice(0, 60)
  if (!title) return { ok: false, message: 'Pakete bir ad ver.' }
  const entries: ZipEntry[] = []
  const iconMap: Record<string, string> = {}
  const valid = new Set(builderKeys().map((k) => k.key))
  let n = 0
  for (const [key, file] of Object.entries(map)) {
    if (!valid.has(key) || !picked.has(file)) continue
    const ext = path.extname(file).toLowerCase()
    const entryName = `icons/${String(++n).padStart(3, '0')}${ext}`
    entries.push({ name: entryName, data: fs.readFileSync(file) })
    iconMap[key] = entryName
  }
  if (n === 0) return { ok: false, message: 'Hiçbir öğeye resim seçilmedi.' }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'paket'
  const id = `${slug}-${Date.now().toString(36).slice(-4)}`
  entries.push(
    { name: 'pack.json', data: Buffer.from(JSON.stringify({ type: 'icons', id, name: title, author: author.trim().slice(0, 60) || undefined, version: '1.0' }, null, 2)) },
    { name: 'icons.json', data: Buffer.from(JSON.stringify({ map: iconMap }, null, 2)) },
  )
  try {
    return { ok: true, message: title, pack: installPack(writeZip(entries)) }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
