// Draws a temporary logo (rounded square in brand.iconColor) as build/logo-mark.svg and build/icon.ico.
// Replace both files with the real logo later; the paths come from brand.config.json.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync } from 'node:zlib'

const brand = JSON.parse(readFileSync('src/config/brand.config.json', 'utf-8'))
const hex = brand.iconColor.replace('#', '')
const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
const N = 256

writeFileSync(brand.logo.mark, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="${brand.iconColor}"/><rect x="48" y="150" width="160" height="40" rx="20" fill="#fff" fill-opacity=".9"/></svg>\n`)

const inside = (x, y, x0, y0, w, h, rad) => {
  const cx = Math.min(Math.max(x, x0 + rad), x0 + w - rad)
  const cy = Math.min(Math.max(y, y0 + rad), y0 + h - rad)
  return x >= x0 && x < x0 + w && y >= y0 && y < y0 + h && (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad
}
const raw = Buffer.alloc(N * (N * 4 + 1))
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0
  for (let x = 0; x < N; x++) {
    const o = y * (N * 4 + 1) + 1 + x * 4
    const bar = inside(x, y, 48, 150, 160, 40, 20)
    const bg = inside(x, y, 0, 0, N, N, 56)
    const px = bar ? [255, 255, 255, 230] : bg ? [r, g, b, 255] : [0, 0, 0, 0]
    raw.set(px, o)
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])

const header = Buffer.alloc(22)
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
header[6] = 0; header[7] = 0 // 256x256 is stored as 0
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
mkdirSync(dirname(brand.logo.icon), { recursive: true })
writeFileSync(brand.logo.icon, Buffer.concat([header, png]))
console.log(`wrote ${brand.logo.icon} and ${brand.logo.mark}`)
