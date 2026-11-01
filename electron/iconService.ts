// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Icons come from the C# helper (shell icon at up to 256px, with alpha) and are cached on disk
// per path + modification time, so an updated exe gets a fresh icon.
import { app, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { helper } from './helper'

const CACHE_DIR = path.join(app.getPath('userData'), 'icon-cache')
const memory = new Map<string, string>()

function cacheFile(targetPath: string, size: number, variant: string): string {
  let stamp = 0
  try {
    stamp = fs.statSync(targetPath).mtimeMs
  } catch {
    /* missing file: cache by path only */
  }
  const hash = crypto.createHash('sha1').update(`${targetPath.toLowerCase()}|${size}|${stamp}|${variant}|v2`).digest('hex')
  return path.join(CACHE_DIR, `${hash}.png`)
}

function toDataUrl(buf: Buffer, ext = 'png'): string {
  return `data:image/${ext};base64,${buf.toString('base64')}`
}

/** Shell icon for any file, folder or shortcut as a data URL, or null when none could be produced. */
export async function shellIcon(rawPath: string, size = 128, variant = ''): Promise<string | null> {
  const targetPath = path.win32.normalize(rawPath)
  const file = cacheFile(targetPath, size, variant)
  const hit = memory.get(file)
  if (hit) return hit
  if (fs.existsSync(file)) {
    const url = toDataUrl(fs.readFileSync(file))
    memory.set(file, url)
    return url
  }
  const b64 = await helper.icon(targetPath, size).catch(() => null)
  if (!b64) return null
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(file, Buffer.from(b64, 'base64'))
  const url = `data:image/png;base64,${b64}`
  memory.set(file, url)
  return url
}

const thumbs = new Map<string, string | null>()

/** Explorer-style preview (photo, video frame, PDF page) as a data URL, or null when the shell has none. */
export async function thumbnail(rawPath: string, size: number): Promise<string | null> {
  const target = path.win32.normalize(rawPath)
  let stamp = 0
  try {
    stamp = fs.statSync(target).mtimeMs
  } catch {
    return null
  }
  const key = `${target.toLowerCase()}|${size}|${stamp}`
  if (thumbs.has(key)) return thumbs.get(key) ?? null
  let url: string | null = null
  try {
    const img = await nativeImage.createThumbnailFromPath(target, { width: size, height: size })
    if (!img.isEmpty()) url = img.toDataURL()
  } catch {
    /* no preview for this file */
  }
  if (thumbs.size > 400) thumbs.clear()
  thumbs.set(key, url)
  return url
}

export function fileIcon(filePath: string): string | null {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'png'
    return toDataUrl(fs.readFileSync(filePath), ext === 'svg' ? 'svg+xml' : ext)
  } catch {
    return null
  }
}

/** Priority: user override > shell icon of the target. */
export async function resolveIcon(targetPath: string, customIconPath?: string): Promise<string | null> {
  if (customIconPath) {
    const custom = fileIcon(customIconPath)
    if (custom) return custom
  }
  return shellIcon(targetPath)
}

export function clearIconCache() {
  memory.clear()
  fs.rmSync(CACHE_DIR, { recursive: true, force: true })
}
