// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Custom desk textures: only real images are stored, under a name made from their content, and only those names
// can be read back.
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'textures-test-'))
const stub = join(dir, 'electron-stub.js')
writeFileSync(stub, `export const app = { getPath: () => ${JSON.stringify(dir)} }; export const dialog = {}`)
const outfile = join(dir, 'textures.mjs')
await build({ entryPoints: ['electron/textures.ts'], bundle: true, platform: 'node', format: 'esm', outfile, alias: { electron: stub }, logLevel: 'silent' })
const { storeTexture, readTexture, removeTexture, sniff, MAX_TEXTURE_BYTES } = await import(pathToFileURL(outfile).href)

// a tiny valid PNG (1x1)
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))])

assert.equal(sniff(png), 'png')
assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0])), 'jpg')
assert.equal(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'webp')
assert.equal(sniff(Buffer.from('MZ this is an exe renamed to .png')), null, 'content decides, not the file name')

const stored = storeTexture(png)
assert.ok(stored.ok && /^[0-9a-f]{16}\.png$/.test(stored.file))
assert.equal(storeTexture(png).file, stored.file, 'same image, same name (no duplicates)')
assert.match(readTexture(stored.file), /^data:image\/png;base64,/)

assert.equal(storeTexture(Buffer.from('<svg onload=alert(1)>')).ok, false, 'svg and other formats are refused')
assert.equal(storeTexture(Buffer.concat([png, Buffer.alloc(MAX_TEXTURE_BYTES)])).ok, false, 'over 4 MB is refused')

// only our own file names can be read
for (const bad of ['../textures.mjs', '..\\..\\x.png', 'abc.png', '0123456789abcdef.exe', '', 'C:/Windows/win.ini']) assert.equal(readTexture(bad), null, `refused: ${bad}`)
mkdirSync(join(dir, 'textures'), { recursive: true })
removeTexture(stored.file)
assert.equal(existsSync(join(dir, 'textures', stored.file)), false)
assert.equal(readTexture(stored.file), null)

console.log('textures: all checks passed')
