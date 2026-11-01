// Cursor packs: a folder of PNGs (one per Windows cursor role, two of them may be animation strips). The pictures are
// turned into .cur / .ani files in the app's own data folder and handed to the helper, which swaps the system cursors
// for this Windows session only. "Windows' own cursors" and quitting the app both put the user's pointers back.
// Packs that ship with the app are read-only; the user's own live in the data folder and can be imported, edited,
// exported and removed.
import { app, dialog, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { getSettings } from './store'
import { helper } from './helper'
import { broadcast } from './ipc'
import { readZip, writeZip, ZipEntry } from './zip'
import { curFile, aniFile, CurImage } from './cursorFiles'
import type { CursorPackInfo, CursorStatus } from '../src/shared/types'

/** file name -> [Windows cursor id (OCR_*), label, default hot spot on the 256 px picture]. */
export const ROLES: Record<string, [number, string, [number, number]]> = {
  arrow: [32512, 'Normal seçim', [10, 9]],
  help: [32651, 'Yardım', [10, 9]],
  working: [32650, 'Arka planda çalışıyor', [10, 9]],
  busy: [32514, 'Meşgul', [128, 128]],
  precision: [32515, 'Kesin seçim', [128, 128]],
  text: [32513, 'Metin', [128, 128]],
  handwriting: [32631, 'El yazısı', [34, 246]],
  unavailable: [32648, 'Kullanılamaz', [128, 128]],
  'resize-vertical': [32645, 'Dikey boyutlandırma', [128, 128]],
  'resize-horizontal': [32644, 'Yatay boyutlandırma', [128, 128]],
  'resize-diagonal1': [32642, 'Çapraz boyutlandırma 1', [128, 128]],
  'resize-diagonal2': [32643, 'Çapraz boyutlandırma 2', [128, 128]],
  move: [32646, 'Taşı', [128, 128]],
  alternate: [32516, 'Alternatif seçim', [99, 9]],
  link: [32649, 'Bağlantı', [96, 24]],
  location: [32671, 'Konum', [127, 246]],
  person: [32672, 'Kişi', [10, 9]],
}
const SIZES = [32, 48, 64, 96, 128]
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/
const MAX_PNG_BYTES = 8 * 1024 * 1024
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

const BUILTIN = [{ id: 'mac-neon', name: 'Mac Neon', author: 'Fly Dock' }]
const builtinRoot = () => (app.isPackaged ? path.join(process.resourcesPath, 'cursor-packs') : path.join(app.getAppPath(), 'resources', 'cursor-packs'))
const userRoot = () => path.join(app.getPath('userData'), 'cursor-packs')
const outRoot = () => path.join(app.getPath('userData'), 'cursors')
const isBuiltin = (id: string) => BUILTIN.some((p) => p.id === id)

let status: CursorStatus = { active: '', message: '' }

interface PackMeta {
  hotspots?: Record<string, [number, number]>
  animations?: Record<string, { fps?: number }>
}

const readJson = (file: string): any => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
const readMeta = (dir: string): PackMeta => readJson(path.join(dir, 'cursors.json')) ?? {}

/** The folder of a pack, or null when there is no such pack. */
function packDir(id: string): string | null {
  if (!ID_PATTERN.test(id)) return null
  const dir = isBuiltin(id) ? path.join(builtinRoot(), id) : path.join(userRoot(), id)
  return fs.existsSync(dir) ? dir : null
}

/** The PNG of a role: a single picture, or the first frame of its strip. */
function stillOf(dir: string, role: string) {
  const single = path.join(dir, `${role}.png`)
  if (fs.existsSync(single)) return nativeImage.createFromPath(single)
  const strip = path.join(dir, `${role}-strip.png`)
  if (fs.existsSync(strip)) {
    const img = nativeImage.createFromPath(strip)
    const h = img.getSize().height
    return img.crop({ x: 0, y: 0, width: h, height: h })
  }
  return null
}

const clampHot = (v: unknown, fallback: [number, number]): [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [Math.max(0, Math.min(255, Math.round(v[0]))), Math.max(0, Math.min(255, Math.round(v[1])))] : fallback

function describe(id: string, name: string, author: string, builtin: boolean): CursorPackInfo | null {
  const dir = packDir(id)
  if (!dir) return null
  const meta = readMeta(dir)
  const roles = Object.entries(ROLES).map(([role, [, label, def]]) => {
    const img = stillOf(dir, role)
    const has = !!img && !img.isEmpty()
    return {
      role,
      label,
      has,
      image: has ? img!.resize({ width: 128, height: 128, quality: 'best' }).toDataURL() : '',
      animated: fs.existsSync(path.join(dir, `${role}-strip.png`)),
      hotspot: clampHot(meta.hotspots?.[role], def),
      fps: Math.max(1, Math.min(60, Number(meta.animations?.[role]?.fps) || 14)),
    }
  })
  return { id, name, author, builtin, roles }
}

export function cursorPacks(): CursorPackInfo[] {
  const list = BUILTIN.map((p) => describe(p.id, p.name, p.author, true)).filter((p): p is CursorPackInfo => !!p)
  try {
    for (const e of fs.readdirSync(userRoot(), { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const manifest = readJson(path.join(userRoot(), e.name, 'pack.json'))
      const info = describe(e.name, String(manifest?.name ?? e.name).slice(0, 60), String(manifest?.author ?? '').slice(0, 60), false)
      if (info) list.push(info)
    }
  } catch {
    /* no user packs yet */
  }
  return list
}

function imagesOf(img: Electron.NativeImage, hotspot: [number, number]): CurImage[] {
  return SIZES.map((size) => ({
    size,
    png: img.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    hotX: (hotspot[0] * size) / 256,
    hotY: (hotspot[1] * size) / 256,
  }))
}

/** Builds the files of a pack into the data folder and returns what to hand to the helper. */
export function buildCursorFiles(id: string): { id: number; file: string }[] {
  const dir = packDir(id)
  if (!dir) throw new Error('İmleç paketi bulunamadı')
  const meta = readMeta(dir)
  const out = path.join(outRoot(), id)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  const items: { id: number; file: string }[] = []
  for (const [role, [ocr, , def]] of Object.entries(ROLES)) {
    const hs = clampHot(meta.hotspots?.[role], def)
    const strip = path.join(dir, `${role}-strip.png`)
    if (fs.existsSync(strip)) {
      const sheet = nativeImage.createFromPath(strip)
      const { width, height } = sheet.getSize()
      const n = Math.floor(width / height)
      if (n < 2 || n > 64) continue
      const frames = Array.from({ length: n }, (_, i) => curFile(imagesOf(sheet.crop({ x: i * height, y: 0, width: height, height }), hs)))
      const file = path.join(out, `${role}.ani`)
      fs.writeFileSync(file, aniFile(frames, Number(meta.animations?.[role]?.fps) || 14))
      items.push({ id: ocr, file })
      continue
    }
    const still = stillOf(dir, role)
    if (!still || still.isEmpty()) continue
    const file = path.join(out, `${role}.cur`)
    fs.writeFileSync(file, curFile(imagesOf(still, hs)))
    items.push({ id: ocr, file })
  }
  return items
}

/** Puts a pack's cursors on ('' puts the user's own back). */
export async function applyCursorPack(id: string): Promise<CursorStatus> {
  try {
    // a pack only replaces the roles it has pictures for, so the previous pack has to go first
    await helper.cursorsRestore()
    if (!id) {
      status = { active: '', message: '' }
    } else {
      const r = await helper.cursorsApply(buildCursorFiles(id))
      status = r.applied > 0 ? { active: id, message: r.failed > 0 ? `${r.failed} imleç uygulanamadı` : '' } : { active: '', message: 'Bu pakette uygulanacak imleç yok' }
    }
  } catch (e) {
    const text = e instanceof Error ? e.message : ''
    // a helper built before cursors existed does not know the command: the app has to be restarted so it is rebuilt
    status = { active: '', message: /unknown method/.test(text) ? 'Yardımcı program eski sürüm. Uygulamayı kapatıp yeniden başlat (geliştirmede npm run dev).' : text || 'İmleçler uygulanamadı' }
  }
  return status
}

export const cursorStatus = () => status

// ---- the user's own packs ----

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'imlec'
const newId = (name: string) => `${slug(name)}-${crypto.randomBytes(3).toString('hex')}`

function writeManifest(dir: string, id: string, name: string, author: string) {
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ type: 'cursors', id, name: name.slice(0, 60), author: author.slice(0, 60) || undefined, version: '1.0' }, null, 2))
}

function writeMeta(dir: string, meta: PackMeta) {
  fs.writeFileSync(path.join(dir, 'cursors.json'), JSON.stringify(meta, null, 2))
}

/** After a pack changed: tell the pages, and put the new look on if that pack is the one in use. */
async function changed(id: string) {
  broadcast('cursors:changed', null)
  if (status.active === id) await applyCursorPack(id)
}

/** Why a picture cannot be a cursor, or null when it can. */
function problemWith(buf: Buffer, strip: boolean): string | null {
  if (buf.length > MAX_PNG_BYTES) return 'Resim çok büyük (en fazla 8 MB).'
  if (buf.length < 64 || !buf.subarray(0, 4).equals(PNG_MAGIC)) return 'Yalnızca PNG resimler kullanılabilir.'
  const img = nativeImage.createFromBuffer(buf)
  if (img.isEmpty()) return 'Resim okunamadı.'
  const { width, height } = img.getSize()
  if (strip) {
    const frames = width / height
    if (height < 16 || height > 512 || !Number.isInteger(frames) || frames < 2 || frames > 64) return 'Şerit, yan yana dizilmiş kare kareler olmalı: her kare kare, 2 ile 64 kare.'
  } else if (width < 16 || width > 1024 || Math.abs(width - height) > Math.max(2, width * 0.02)) {
    return 'Resim kare olmalı (16 ile 1024 piksel arası).'
  }
  return null
}

/** A new empty pack, or a copy of an existing one (the way to change a built-in pack). */
export function createCursorPack(name: string, copyOf?: string): CursorPackInfo {
  const title = String(name).trim().slice(0, 60) || 'Yeni imleç paketim'
  const id = newId(title)
  const dir = path.join(userRoot(), id)
  fs.mkdirSync(dir, { recursive: true })
  const from = copyOf ? packDir(copyOf) : null
  if (from) for (const f of fs.readdirSync(from)) if (/\.(png|json)$/.test(f) && f !== 'pack.json') fs.copyFileSync(path.join(from, f), path.join(dir, f))
  writeManifest(dir, id, title, '')
  broadcast('cursors:changed', null)
  return describe(id, title, '', false)!
}

/** Another picture for one role of a user's pack. */
export async function setCursorRole(id: string, role: string, strip: boolean): Promise<{ ok: boolean; message: string }> {
  const dir = isBuiltin(id) ? null : packDir(id)
  if (!dir || !ROLES[role]) return { ok: false, message: 'Bu paket değiştirilemez.' }
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: strip ? 'Hareketli imleç şeridi (PNG)' : 'İmleç resmi (PNG)', extensions: ['png'] }] })
  if (r.canceled || !r.filePaths[0]) return { ok: false, message: 'cancelled' }
  let buf: Buffer
  try {
    buf = fs.readFileSync(r.filePaths[0])
  } catch {
    return { ok: false, message: 'Dosya okunamadı.' }
  }
  const problem = problemWith(buf, strip)
  if (problem) return { ok: false, message: problem }
  fs.rmSync(path.join(dir, `${role}.png`), { force: true })
  fs.rmSync(path.join(dir, `${role}-strip.png`), { force: true })
  fs.writeFileSync(path.join(dir, `${role}${strip ? '-strip' : ''}.png`), buf)
  await changed(id)
  return { ok: true, message: '' }
}

export async function clearCursorRole(id: string, role: string) {
  const dir = isBuiltin(id) ? null : packDir(id)
  if (!dir || !ROLES[role]) return
  fs.rmSync(path.join(dir, `${role}.png`), { force: true })
  fs.rmSync(path.join(dir, `${role}-strip.png`), { force: true })
  await changed(id)
}

/** Where on the 256 px picture a click counts (hot spot), and how fast an animated role plays. */
export async function setCursorRoleOptions(id: string, role: string, options: { hotspot?: [number, number]; fps?: number }) {
  const dir = isBuiltin(id) ? null : packDir(id)
  if (!dir || !ROLES[role]) return
  const meta = readMeta(dir)
  if (options.hotspot) meta.hotspots = { ...meta.hotspots, [role]: clampHot(options.hotspot, ROLES[role][2]) }
  if (options.fps !== undefined) meta.animations = { ...meta.animations, [role]: { fps: Math.max(1, Math.min(60, Math.round(options.fps))) } }
  writeMeta(dir, meta)
  await changed(id)
}

export function renameCursorPack(id: string, name: string) {
  const dir = isBuiltin(id) ? null : packDir(id)
  const title = String(name).trim().slice(0, 60)
  if (!dir || !title) return
  const manifest = readJson(path.join(dir, 'pack.json')) ?? {}
  writeManifest(dir, id, title, String(manifest.author ?? ''))
  broadcast('cursors:changed', null)
}

export async function removeCursorPack(id: string) {
  const dir = isBuiltin(id) ? null : packDir(id)
  if (!dir) return
  if (status.active === id) await applyCursorPack('')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(path.join(outRoot(), id), { recursive: true, force: true })
  broadcast('cursors:changed', null)
}

/** The pictures of a folder or archive that have the name of a role, checked one by one. */
function collect(files: { name: string; data: Buffer }[]): { role: string; strip: boolean; data: Buffer }[] {
  const out: { role: string; strip: boolean; data: Buffer }[] = []
  const seen = new Set<string>()
  for (const f of files) {
    const m = /^([a-z0-9-]+?)(-strip)?\.png$/i.exec(path.basename(f.name))
    const role = m?.[1].toLowerCase()
    if (!m || !role || !ROLES[role] || seen.has(role)) continue
    if (problemWith(f.data, !!m[2])) continue
    seen.add(role)
    out.push({ role, strip: !!m[2], data: f.data })
  }
  return out
}

function install(title: string, author: string, items: { role: string; strip: boolean; data: Buffer }[], meta: PackMeta): CursorPackInfo {
  const id = newId(title)
  const dir = path.join(userRoot(), id)
  fs.mkdirSync(dir, { recursive: true })
  for (const it of items) fs.writeFileSync(path.join(dir, `${it.role}${it.strip ? '-strip' : ''}.png`), it.data)
  writeMeta(dir, meta)
  writeManifest(dir, id, title, author)
  broadcast('cursors:changed', null)
  return describe(id, title, author, false)!
}

const sanitizeMeta = (raw: any): PackMeta => {
  const meta: PackMeta = {}
  if (raw && typeof raw.hotspots === 'object' && raw.hotspots) {
    meta.hotspots = {}
    for (const role of Object.keys(ROLES)) if (raw.hotspots[role]) meta.hotspots[role] = clampHot(raw.hotspots[role], ROLES[role][2])
  }
  if (raw && typeof raw.animations === 'object' && raw.animations) {
    meta.animations = {}
    for (const role of Object.keys(ROLES)) {
      const fps = Number(raw.animations[role]?.fps)
      if (fps) meta.animations[role] = { fps: Math.max(1, Math.min(60, Math.round(fps))) }
    }
  }
  return meta
}

/** A .flypack (zip) with pack.json of type "cursors" and PNGs named like the roles. */
export async function importCursorFile(): Promise<{ ok: boolean; message: string; pack?: CursorPackInfo }> {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'İmleç paketi', extensions: ['flypack', 'zip'] }] })
  if (r.canceled || !r.filePaths[0]) return { ok: false, message: 'cancelled' }
  try {
    const stat = fs.statSync(r.filePaths[0])
    if (stat.size > 50 * 1024 * 1024) return { ok: false, message: 'Paket çok büyük.' }
    const entries = readZip(fs.readFileSync(r.filePaths[0]), { maxEntries: 120, maxEntryBytes: MAX_PNG_BYTES, maxTotalBytes: 60 * 1024 * 1024 })
    const byName = new Map(entries.map((e) => [e.name.replace(/\\/g, '/').replace(/^\.\//, ''), e.data]))
    const manifest = JSON.parse(String(byName.get('pack.json') ?? '{}'))
    if (manifest?.type !== 'cursors') return { ok: false, message: 'Bu bir imleç paketi değil.' }
    const items = collect(entries.map((e) => ({ name: e.name, data: e.data })))
    if (items.length === 0) return { ok: false, message: 'Pakette kullanılabilir imleç resmi yok.' }
    let meta: PackMeta = {}
    try {
      meta = sanitizeMeta(JSON.parse(String(byName.get('cursors.json') ?? '{}')))
    } catch {
      /* hot spots fall back to the defaults */
    }
    const pack = install(String(manifest.name ?? 'İmleç paketi').trim().slice(0, 60) || 'İmleç paketi', String(manifest.author ?? ''), items, meta)
    return { ok: true, message: pack.name, pack }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Paket okunamadı.' }
  }
}

/** A folder of PNGs named arrow.png, link.png, text.png… (docs/CURSOR-NAMES.md). */
export async function importCursorFolder(): Promise<{ ok: boolean; message: string; pack?: CursorPackInfo }> {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return { ok: false, message: 'cancelled' }
  try {
    const dir = r.filePaths[0]
    const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).slice(0, 80).map((f) => ({ name: f, data: fs.readFileSync(path.join(dir, f)) }))
    const items = collect(files)
    if (items.length === 0) return { ok: false, message: 'Klasörde arrow.png, link.png gibi adlandırılmış imleç resmi bulunamadı.' }
    const meta = sanitizeMeta(readJson(path.join(dir, 'cursors.json')))
    const name = path.basename(dir)
    const pack = install(name, '', items, meta)
    return { ok: true, message: name, pack }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Klasör okunamadı.' }
  }
}

export async function exportCursorPack(id: string): Promise<{ ok: boolean; message: string }> {
  const dir = packDir(id)
  if (!dir) return { ok: false, message: 'Paket bulunamadı.' }
  const info = cursorPacks().find((p) => p.id === id)
  const title = info?.name ?? id
  const r = await dialog.showSaveDialog({ defaultPath: `${slug(title)}.flypack`, filters: [{ name: 'İmleç paketi', extensions: ['flypack'] }] })
  if (r.canceled || !r.filePath) return { ok: false, message: 'cancelled' }
  const entries: ZipEntry[] = [{ name: 'pack.json', data: Buffer.from(JSON.stringify({ type: 'cursors', id: slug(title) + '-' + crypto.randomBytes(2).toString('hex'), name: title, author: info?.author || undefined, version: '1.0' }, null, 2)) }]
  for (const f of fs.readdirSync(dir)) if (/\.png$/.test(f) || f === 'cursors.json') entries.push({ name: f, data: fs.readFileSync(path.join(dir, f)) })
  fs.writeFileSync(r.filePath, writeZip(entries))
  return { ok: true, message: r.filePath }
}

export function initCursors() {
  const s = getSettings()
  if (s.cursorPack) void applyCursorPack(s.cursorPack)
  // a restarted helper has forgotten what it applied
  helper.on('ready', () => {
    const now = getSettings()
    if (now.cursorPack && status.active) void applyCursorPack(now.cursorPack)
  })
}

/** On quit the user's own pointers come back (the helper does the same if the app dies). */
export async function disposeCursors() {
  if (status.active) await Promise.race([helper.cursorsRestore().catch(() => {}), new Promise((r) => setTimeout(r, 800))])
}
