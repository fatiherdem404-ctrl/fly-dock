// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Windows cursor files, written by hand so no tool has to be installed: .cur (a list of PNG images with hot spots)
// and .ani (a RIFF list of .cur frames with a frame rate). Nothing in here touches Electron or the system.

export interface CurImage {
  /** Square size in pixels. */
  size: number
  /** The picture as a PNG file. */
  png: Buffer
  hotX: number
  hotY: number
}

/** One .cur with every given size inside; Windows picks the one that fits the user's pointer size. */
export function curFile(images: CurImage[]): Buffer {
  if (images.length === 0 || images.length > 16) throw new Error('a cursor needs 1 to 16 images')
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0) // reserved
  head.writeUInt16LE(2, 2) // type 2: cursor
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach((img, i) => {
    if (img.size < 1 || img.size > 256) throw new Error('cursor size must be 1..256')
    const at = 6 + i * 16
    head[at] = img.size === 256 ? 0 : img.size // 0 means 256
    head[at + 1] = img.size === 256 ? 0 : img.size
    head[at + 2] = 0 // palette
    head[at + 3] = 0
    head.writeUInt16LE(Math.max(0, Math.min(img.size - 1, Math.round(img.hotX))), at + 4)
    head.writeUInt16LE(Math.max(0, Math.min(img.size - 1, Math.round(img.hotY))), at + 6)
    head.writeUInt32LE(img.png.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += img.png.length
  })
  return Buffer.concat([head, ...images.map((i) => i.png)])
}

const even = (b: Buffer) => (b.length % 2 ? Buffer.concat([b, Buffer.alloc(1)]) : b)
const chunk = (id: string, data: Buffer) => {
  const h = Buffer.alloc(8)
  h.write(id, 0, 'ascii')
  h.writeUInt32LE(data.length, 4)
  return Buffer.concat([h, even(data)])
}

/** An animated cursor: `frames` are finished .cur files, `fps` how fast they play (Windows counts in 1/60 s). */
export function aniFile(frames: Buffer[], fps: number, size = 32): Buffer {
  if (frames.length < 2) throw new Error('an animation needs at least 2 frames')
  const jiffies = Math.max(1, Math.round(60 / Math.max(1, Math.min(60, fps))))
  const anih = Buffer.alloc(36)
  anih.writeUInt32LE(36, 0) // size of this header
  anih.writeUInt32LE(frames.length, 4)
  anih.writeUInt32LE(frames.length, 8) // steps
  anih.writeUInt32LE(size, 12)
  anih.writeUInt32LE(size, 16)
  anih.writeUInt32LE(32, 20) // bit count
  anih.writeUInt32LE(1, 24) // planes
  anih.writeUInt32LE(jiffies, 28)
  anih.writeUInt32LE(1, 32) // AF_ICON: the frames are icon/cursor files
  const list = Buffer.concat([Buffer.from('fram', 'ascii'), ...frames.map((f) => chunk('icon', f))])
  const body = Buffer.concat([Buffer.from('ACON', 'ascii'), chunk('anih', anih), chunk('LIST', list)])
  const out = Buffer.alloc(8)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(body.length, 4)
  return Buffer.concat([out, body])
}

/** Reads a .cur back (for tests and sanity checks). */
export function readCur(buf: Buffer): { size: number; hotX: number; hotY: number; png: Buffer }[] {
  if (buf.readUInt16LE(2) !== 2) throw new Error('not a cursor file')
  const n = buf.readUInt16LE(4)
  return Array.from({ length: n }, (_, i) => {
    const at = 6 + i * 16
    const len = buf.readUInt32LE(at + 8), off = buf.readUInt32LE(at + 12)
    return { size: buf[at] || 256, hotX: buf.readUInt16LE(at + 4), hotY: buf.readUInt16LE(at + 6), png: buf.subarray(off, off + len) }
  })
}
