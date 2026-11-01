// Custom desk textures: the user picks an image, it is copied into the app's own folder under a name made from its
// content, and only that name is kept in the settings. Nothing outside the folder is ever read back.
import { app, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

export const MAX_TEXTURE_BYTES = 4 * 1024 * 1024
const NAME = /^[0-9a-f]{16}\.(png|jpg|webp)$/
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const

const dir = () => path.join(app.getPath('userData'), 'textures')

/** What the bytes really are, whatever the file was called. */
export function sniff(buf: Buffer): keyof typeof MIME | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

export function storeTexture(buf: Buffer): { ok: boolean; file?: string; message: string } {
  if (buf.length > MAX_TEXTURE_BYTES) return { ok: false, message: 'Resim 4 MB’tan büyük; daha küçük bir resim seç.' }
  const kind = sniff(buf)
  if (!kind) return { ok: false, message: 'Yalnızca PNG, JPEG ve WebP resimler kullanılabilir.' }
  const file = `${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)}.${kind}`
  fs.mkdirSync(dir(), { recursive: true })
  fs.writeFileSync(path.join(dir(), file), buf)
  return { ok: true, file, message: file }
}

/** The stored texture as a data URL, or null for unknown names (anything that is not one of our file names). */
export function readTexture(file: string): string | null {
  if (!NAME.test(file)) return null
  try {
    const buf = fs.readFileSync(path.join(dir(), file))
    return `data:${MIME[file.split('.')[1] as keyof typeof MIME]};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function textureBytes(file: string): Buffer | null {
  if (!NAME.test(file)) return null
  try {
    return fs.readFileSync(path.join(dir(), file))
  } catch {
    return null
  }
}

export function removeTexture(file: string) {
  if (NAME.test(file)) fs.rmSync(path.join(dir(), file), { force: true })
}

export async function pickTexture(): Promise<{ ok: boolean; file?: string; message: string }> {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resim', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
  if (result.canceled || !result.filePaths[0]) return { ok: false, message: 'cancelled' }
  try {
    return storeTexture(fs.readFileSync(result.filePaths[0]))
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
