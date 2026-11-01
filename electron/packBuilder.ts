// Icon pack builder: the user assigns pictures to the keys a pack can replace (every dock item and gear-menu entry),
// then the result is written as an ordinary .flypack and installed through the same validation as an imported one.
// Only pictures from the icon library or chosen in a system dialog can be used.
import path from 'node:path'
import { getItems } from './store'
import { installPack } from './packs'
import { writeZip, ZipEntry } from './zip'
import { wheelEntries } from './wheel'
import { isAllowedImage, readAllowed, libraryThumb, pickFolderImages } from './iconLibrary'
import type { PackInfo, PackBuilderKey } from '../src/shared/types'

const keyOfPath = (p: string) => (p.toLowerCase().startsWith('shell:') ? p.slice(6) : path.win32.basename(p, path.win32.extname(p))).toLowerCase().replace(/[^a-z0-9 ._-]/g, '').slice(0, 60)

const SPECIAL: Record<string, string> = { start: 'Başlat düğmesi', wheel: 'Kontrol paneli simgesi', power: 'Güç menüsü simgesi', group: 'Gruplar' }

/** Everything a pack can replace: every dock item, every gear-menu entry, then the generic folder / file / trash icons. */
export function builderKeys(): PackBuilderKey[] {
  const keys: PackBuilderKey[] = []
  const seen = new Set<string>()
  const add = (k: PackBuilderKey) => {
    if (!k.key || seen.has(k.key)) return
    seen.add(k.key)
    keys.push(k)
  }
  for (const item of getItems()) {
    if (item.type === 'start' || item.type === 'wheel' || item.type === 'power' || item.type === 'group') add({ key: item.type, label: SPECIAL[item.type], itemId: item.id })
    else if ((item.type === 'app' || item.type === 'file') && item.targetPath) add({ key: keyOfPath(item.targetPath), label: item.label || keyOfPath(item.targetPath), itemId: item.id })
  }
  add({ key: 'folder', label: 'Klasörler' })
  add({ key: 'file', label: 'Diğer dosyalar' })
  add({ key: 'trash', label: 'Geri dönüşüm kutusu (boş)' })
  add({ key: 'trash-full', label: 'Geri dönüşüm kutusu (dolu)' })
  for (const e of wheelEntries().entries) if (!e.path) add({ key: `wheel-${e.id}`, label: `Kontrol paneli: ${e.name}`, wheelId: e.id })
  return keys
}

/** A folder of pictures named like the keys (chrome.png, folder.png, wheel-apps.png…) fills every matching key at once. */
export async function pickBuilderFolder(keys: string[]): Promise<Record<string, { path: string; preview: string }>> {
  const out: Record<string, { path: string; preview: string }> = {}
  for (const file of await pickFolderImages()) {
    const key = keyOfPath(file)
    if (!keys.includes(key) || out[key]) continue
    const preview = libraryThumb(file)
    if (preview) out[key] = { path: file, preview }
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
    if (!valid.has(key) || !isAllowedImage(file)) continue
    const data = readAllowed(file)
    if (!data) continue
    const entryName = `icons/${String(++n).padStart(3, '0')}${path.extname(file).toLowerCase()}`
    entries.push({ name: entryName, data })
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

/** The icon studio's result: one finished PNG per key (base64), written as an ordinary pack through the same install checks. */
export function createPackFromPngs(name: string, author: string, images: Record<string, string>): { ok: boolean; message: string; pack?: PackInfo } {
  const title = String(name).trim().slice(0, 60)
  if (!title) return { ok: false, message: 'Pakete bir ad ver.' }
  const entries: ZipEntry[] = []
  const iconMap: Record<string, string> = {}
  let n = 0
  for (const [key, b64] of Object.entries(images ?? {})) {
    if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(key) || typeof b64 !== 'string' || b64.length > 4_000_000) continue
    const data = Buffer.from(b64, 'base64')
    if (data.length < 64 || data.readUInt32BE(0) !== 0x89504e47) continue // PNGs only
    const entryName = `icons/${String(++n).padStart(3, '0')}.png`
    entries.push({ name: entryName, data })
    iconMap[key] = entryName
  }
  if (n === 0) return { ok: false, message: 'Hiç simge üretilemedi.' }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'paket'
  const id = `${slug}-${Date.now().toString(36).slice(-4)}`
  entries.push(
    { name: 'pack.json', data: Buffer.from(JSON.stringify({ type: 'icons', id, name: title, author: String(author).trim().slice(0, 60) || undefined, version: '1.0' }, null, 2)) },
    { name: 'icons.json', data: Buffer.from(JSON.stringify({ map: iconMap }, null, 2)) },
  )
  try {
    return { ok: true, message: title, pack: installPack(writeZip(entries)) }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
