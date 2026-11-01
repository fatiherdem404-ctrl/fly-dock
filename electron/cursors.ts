// Cursor packs: a folder of PNGs (one per Windows cursor role, two of them may be animation strips). The pictures are
// turned into .cur / .ani files in the app's own data folder and handed to the helper, which swaps the system cursors
// for this Windows session only. "Windows' own cursors" and quitting the app both put the user's pointers back.
import { app, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getSettings } from './store'
import { helper } from './helper'
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
const FRAME = 256
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/

const BUILTIN = [{ id: 'mac-neon', name: 'Mac Neon', author: 'Fly Dock' }]
const builtinRoot = () => (app.isPackaged ? path.join(process.resourcesPath, 'cursor-packs') : path.join(app.getAppPath(), 'resources', 'cursor-packs'))
const outRoot = () => path.join(app.getPath('userData'), 'cursors')

let status: CursorStatus = { active: '', message: '' }

interface PackMeta {
  hotspots?: Record<string, [number, number]>
  animations?: Record<string, { fps?: number }>
}
const readMeta = (dir: string): PackMeta => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'cursors.json'), 'utf8')) as PackMeta
  } catch {
    return {}
  }
}

const packDir = (id: string) => (ID_PATTERN.test(id) && BUILTIN.some((p) => p.id === id) ? path.join(builtinRoot(), id) : null)

/** The PNG of a role: a single picture, or the first frame of its strip. */
function stillOf(dir: string, role: string) {
  const single = path.join(dir, `${role}.png`)
  if (fs.existsSync(single)) return nativeImage.createFromPath(single)
  const strip = path.join(dir, `${role}-strip.png`)
  if (fs.existsSync(strip)) {
    const img = nativeImage.createFromPath(strip)
    return img.crop({ x: 0, y: 0, width: Math.min(FRAME, img.getSize().height), height: img.getSize().height })
  }
  return null
}

export function cursorPacks(): CursorPackInfo[] {
  return BUILTIN.map((p) => {
    const dir = path.join(builtinRoot(), p.id)
    const roles = Object.entries(ROLES).flatMap(([role, [, label]]) => {
      const img = stillOf(dir, role)
      return img && !img.isEmpty() ? [{ role, label, image: img.resize({ width: 64, height: 64, quality: 'best' }).toDataURL(), animated: fs.existsSync(path.join(dir, `${role}-strip.png`)) }] : []
    })
    return { ...p, roles }
  })
}

const hot = (meta: PackMeta, role: string): [number, number] => meta.hotspots?.[role] ?? ROLES[role][2]

function imagesOf(img: Electron.NativeImage, hotspot: [number, number]): CurImage[] {
  const src = img.getSize()
  return SIZES.map((size) => ({
    size,
    png: img.resize({ width: size, height: size, quality: 'best' }).toPNG(),
    hotX: (hotspot[0] * size) / src.width,
    hotY: (hotspot[1] * size) / src.height,
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
  for (const [role, [ocr]] of Object.entries(ROLES)) {
    const hs = hot(meta, role)
    const strip = path.join(dir, `${role}-strip.png`)
    if (fs.existsSync(strip)) {
      const sheet = nativeImage.createFromPath(strip)
      const { width, height } = sheet.getSize()
      const n = Math.floor(width / height)
      if (n < 2 || n > 64) continue
      const frames = Array.from({ length: n }, (_, i) => curFile(imagesOf(sheet.crop({ x: i * height, y: 0, width: height, height }), hs)))
      const file = path.join(out, `${role}.ani`)
      fs.writeFileSync(file, aniFile(frames, meta.animations?.[role]?.fps ?? 14))
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
    if (!id) {
      await helper.cursorsRestore()
      status = { active: '', message: '' }
    } else {
      const r = await helper.cursorsApply(buildCursorFiles(id))
      status = r.applied > 0 ? { active: id, message: r.failed > 0 ? `${r.failed} imleç uygulanamadı` : '' } : { active: '', message: 'İmleçler uygulanamadı' }
    }
  } catch (e) {
    status = { active: '', message: e instanceof Error ? e.message : 'İmleçler uygulanamadı' }
  }
  return status
}

export const cursorStatus = () => status

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
