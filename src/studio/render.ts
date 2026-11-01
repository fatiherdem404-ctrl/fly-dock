import { GLYPHS } from './glyphs.generated'

/** Everything the studio can change about a card. All sizes are on the 256 px picture. */
export interface Design {
  /** Card inset from the edge, so shadows have room. */
  inset: number
  /** Corner radius as a share of the card's half size, 0 (square) to 100 (circle). */
  radius: number
  fill: 'solid' | 'gradient' | 'none'
  c1: string
  c2: string
  angle: number
  pattern: 'none' | 'dots' | 'grid' | 'stripes' | 'waves' | 'sheen' | 'burst' | 'grain' | 'hex'
  patternColor: string
  patternOpacity: number
  borderWidth: number
  borderColor: string
  borderOpacity: number
  /** Raised edge: light on one side, dark on the other. */
  bevel: number
  lightAngle: number
  gloss: number
  shadowBlur: number
  shadowY: number
  shadowOpacity: number
  shadowColor: string
  glyphMode: 'solid' | 'gradient'
  g1: string
  g2: string
  glyphSize: number
  glyphStroke: number
  glyphShadow: number
  glyphGlow: number
  /** Each icon's colours turn a little further around the colour wheel (degrees per icon, 0 = all alike). */
  hueSpread: number
}

export const DEFAULT_DESIGN: Design = {
  inset: 22, radius: 46, fill: 'gradient', c1: '#4f9bff', c2: '#6b4dff', angle: 135,
  pattern: 'none', patternColor: '#ffffff', patternOpacity: 0.12,
  borderWidth: 0, borderColor: '#ffffff', borderOpacity: 0.35,
  bevel: 40, lightAngle: 300, gloss: 30,
  shadowBlur: 14, shadowY: 8, shadowOpacity: 0.4, shadowColor: '#000000',
  glyphMode: 'solid', g1: '#ffffff', g2: '#d9e4ff', glyphSize: 52, glyphStroke: 2, glyphShadow: 30, glyphGlow: 0,
  hueSpread: 0,
}

export const PATTERNS: [Design['pattern'], string][] = [
  ['none', 'Yok'], ['dots', 'Noktalar'], ['grid', 'Izgara'], ['stripes', 'Çizgiler'], ['waves', 'Dalgalar'],
  ['sheen', 'Parlama'], ['burst', 'Işın'], ['grain', 'Tane'], ['hex', 'Petek'],
]

export interface Template {
  id: string
  name: string
  design: Partial<Design>
}

export const TEMPLATES: Template[] = [
  { id: 'mac', name: 'Mac tarzı', design: { radius: 46, fill: 'gradient', c1: '#6bb8ff', c2: '#3a5bff', angle: 160, bevel: 35, gloss: 28, shadowBlur: 14, shadowY: 8, shadowOpacity: 0.38, glyphSize: 52, glyphStroke: 2, glyphShadow: 30, hueSpread: 38 } },
  { id: 'win', name: 'Windows 11', design: { radius: 30, fill: 'solid', c1: '#f3f5fa', c2: '#f3f5fa', angle: 90, bevel: 0, gloss: 0, borderWidth: 2, borderColor: '#9aa6bd', borderOpacity: 0.4, shadowBlur: 10, shadowY: 5, shadowOpacity: 0.22, glyphMode: 'gradient', g1: '#1d78ff', g2: '#0a4ec4', glyphSize: 54, glyphStroke: 2, glyphShadow: 0, hueSpread: 28 } },
  { id: 'glass', name: 'Cam', design: { radius: 44, fill: 'gradient', c1: '#ffffff33', c2: '#9ec5ff55', angle: 120, pattern: 'sheen', patternOpacity: 0.28, bevel: 55, gloss: 45, borderWidth: 2, borderColor: '#ffffff', borderOpacity: 0.55, shadowBlur: 18, shadowY: 10, shadowOpacity: 0.35, glyphMode: 'solid', g1: '#ffffff', glyphSize: 50, glyphStroke: 2, glyphShadow: 40, hueSpread: 0 } },
  { id: 'button', name: '3B düğme', design: { radius: 40, fill: 'gradient', c1: '#ffb347', c2: '#ff5e3a', angle: 90, bevel: 90, lightAngle: 270, gloss: 55, shadowBlur: 12, shadowY: 12, shadowOpacity: 0.5, glyphSize: 50, glyphStroke: 2.4, glyphShadow: 55, hueSpread: 52 } },
  { id: 'neon', name: 'Neon', design: { radius: 36, fill: 'solid', c1: '#0c0f1e', c2: '#0c0f1e', angle: 90, pattern: 'grid', patternColor: '#4cf2ff', patternOpacity: 0.1, bevel: 0, gloss: 0, borderWidth: 3, borderColor: '#4cf2ff', borderOpacity: 0.9, shadowBlur: 16, shadowY: 0, shadowOpacity: 0.7, shadowColor: '#4cf2ff', glyphMode: 'gradient', g1: '#4cf2ff', g2: '#c46bff', glyphSize: 52, glyphStroke: 2.2, glyphShadow: 0, glyphGlow: 60, hueSpread: 30 } },
  { id: 'paper', name: 'Kâğıt', design: { radius: 18, fill: 'solid', c1: '#fbf6ea', c2: '#fbf6ea', angle: 90, pattern: 'grain', patternColor: '#7a5a2a', patternOpacity: 0.12, bevel: 20, lightAngle: 300, gloss: 0, borderWidth: 2, borderColor: '#b79b6a', borderOpacity: 0.5, shadowBlur: 10, shadowY: 6, shadowOpacity: 0.3, glyphMode: 'solid', g1: '#4a3a24', glyphSize: 50, glyphStroke: 2.2, glyphShadow: 0, hueSpread: 0 } },
  { id: 'flat', name: 'Kartsız', design: { fill: 'none', bevel: 0, gloss: 0, borderWidth: 0, shadowBlur: 0, shadowOpacity: 0, glyphMode: 'gradient', g1: '#5ab0ff', g2: '#7a4dff', glyphSize: 84, glyphStroke: 1.8, glyphShadow: 45, hueSpread: 45 } },
]

// ---- colour helpers ----

function parse(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 6) h += 'ff'
  const n = parseInt(h.padEnd(8, 'f').slice(0, 8), 16)
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255]
}

function toHsl([r, g, b]: number[]): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

/** The colour turned `deg` degrees around the wheel (alpha stays). Greys stay grey. */
export function turn(hex: string, deg: number): string {
  const [r, g, b, a] = parse(hex)
  if (!deg) return `rgba(${r},${g},${b},${a})`
  const [h, s, l] = toHsl([r, g, b])
  return `hsla(${Math.round((h + deg + 360) % 360)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a})`
}

const rgba = (hex: string, mul = 1) => {
  const [r, g, b, a] = parse(hex)
  return `rgba(${r},${g},${b},${+(a * mul).toFixed(3)})`
}

function dir(angle: number) {
  const a = ((angle - 90) * Math.PI) / 180
  return { x1: 0.5 - Math.cos(a) * 0.5, y1: 0.5 - Math.sin(a) * 0.5, x2: 0.5 + Math.cos(a) * 0.5, y2: 0.5 + Math.sin(a) * 0.5 }
}

function patternSvg(kind: Design['pattern'], x: number, y: number, s: number, color: string, op: number, id: string): string {
  const c = rgba(color)
  switch (kind) {
    case 'dots': return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2" fill="${c}"/></pattern><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'grid': return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${c}" stroke-width="1"/></pattern><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'stripes': return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="16" fill="${c}"/></pattern><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'waves': return `<pattern id="${id}" width="40" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 Q10 0 20 9 T40 9" fill="none" stroke="${c}" stroke-width="2"/></pattern><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'hex': return `<pattern id="${id}" width="28" height="24" patternUnits="userSpaceOnUse"><path d="M7 0h14l7 12-7 12H7L0 12z" fill="none" stroke="${c}" stroke-width="1.4"/></pattern><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'sheen': return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="0.42" stop-color="${c}" stop-opacity="0"/><stop offset="0.5" stop-color="${c}" stop-opacity="1"/><stop offset="0.58" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'burst': return `<radialGradient id="${id}" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="${c}" stop-opacity="1"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${id})" opacity="${op}"/>`
    case 'grain': return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 ${parse(color)[0] / 255} 0 0 0 0 ${parse(color)[1] / 255} 0 0 0 0 ${parse(color)[2] / 255} 0 0 0 1.4 -0.2"/></filter><rect x="${x}" y="${y}" width="${s}" height="${s}" filter="url(#${id})" opacity="${Math.min(1, op * 3)}"/>`
    default: return ''
  }
}

export interface DrawOptions {
  /** Which icon this is in the grid; the colour spread turns by this many steps. */
  index?: number
  /** Small dot in the corner (a full recycle bin). */
  badge?: boolean
  /** Unique prefix for ids, so many cards can share one page. */
  uid?: string
}

/** One finished 256 x 256 picture as SVG text. */
export function cardSvg(d: Design, glyph: string, o: DrawOptions = {}): string {
  const u = o.uid ?? 'u'
  const turnBy = (o.index ?? 0) * d.hueSpread
  const c1 = turn(d.c1, turnBy), c2 = turn(d.c2, turnBy)
  const g1 = turn(d.g1, turnBy), g2 = turn(d.g2, turnBy)
  const s = 256 - d.inset * 2
  const r = (s / 2) * (d.radius / 100)
  const x = d.inset, y = d.inset
  const defs: string[] = []
  const body: string[] = []
  const hasCard = d.fill !== 'none'

  if (hasCard) {
    const dr = dir(d.angle)
    defs.push(`<linearGradient id="${u}f" x1="${dr.x1}" y1="${dr.y1}" x2="${dr.x2}" y2="${dr.y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${d.fill === 'solid' ? c1 : c2}"/></linearGradient>`)
    defs.push(`<clipPath id="${u}c"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/></clipPath>`)
    if (d.shadowOpacity > 0) defs.push(`<filter id="${u}s" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${d.shadowY}" stdDeviation="${d.shadowBlur / 2}" flood-color="${d.shadowColor}" flood-opacity="${d.shadowOpacity}"/></filter>`)
    body.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" fill="url(#${u}f)"${d.shadowOpacity > 0 ? ` filter="url(#${u}s)"` : ''}/>`)
    const inner: string[] = []
    if (d.pattern !== 'none') inner.push(patternSvg(d.pattern, x, y, s, d.patternColor, d.patternOpacity, `${u}p`))
    if (d.gloss > 0) {
      defs.push(`<linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${(d.gloss / 100) * 0.7}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`)
      inner.push(`<ellipse cx="${x + s / 2}" cy="${y + s * 0.02}" rx="${s * 0.62}" ry="${s * 0.5}" fill="url(#${u}g)"/>`)
    }
    if (d.bevel > 0) {
      const b = d.bevel / 100
      const l = dir(d.lightAngle)
      defs.push(`<linearGradient id="${u}b" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"><stop offset="0" stop-color="#fff" stop-opacity="${0.75 * b}"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${0.55 * b}"/></linearGradient>`)
      defs.push(`<linearGradient id="${u}d" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${0.28 * b}"/></linearGradient>`)
      inner.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="url(#${u}d)"/>`)
      inner.push(`<rect x="${x + 2 + b * 2}" y="${y + 2 + b * 2}" width="${s - 4 - b * 4}" height="${s - 4 - b * 4}" rx="${Math.max(0, r - 2 - b * 2)}" fill="none" stroke="url(#${u}b)" stroke-width="${2 + b * 5}"/>`)
    }
    body.push(`<g clip-path="url(#${u}c)">${inner.join('')}</g>`)
    if (d.borderWidth > 0) body.push(`<rect x="${x + d.borderWidth / 2}" y="${y + d.borderWidth / 2}" width="${s - d.borderWidth}" height="${s - d.borderWidth}" rx="${Math.max(0, r - d.borderWidth / 2)}" fill="none" stroke="${rgba(d.borderColor, d.borderOpacity)}" stroke-width="${d.borderWidth}"/>`)
  }

  // the glyph
  const gs = (256 * d.glyphSize) / 100
  const k = gs / 24
  const gx = (256 - gs) / 2, gy = (256 - gs) / 2
  const glow = d.glyphGlow
  const dg = dir(135)
  defs.push(`<linearGradient id="${u}k" gradientUnits="userSpaceOnUse" x1="${dg.x1 * 24}" y1="${dg.y1 * 24}" x2="${dg.x2 * 24}" y2="${dg.y2 * 24}"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${d.glyphMode === 'solid' ? g1 : g2}"/></linearGradient>`)
  const filters: string[] = []
  if (d.glyphShadow > 0) filters.push(`<feDropShadow dx="0" dy="${1.5 + d.glyphShadow / 40}" stdDeviation="${1 + d.glyphShadow / 30}" flood-color="#000" flood-opacity="${Math.min(0.7, d.glyphShadow / 100)}"/>`)
  if (filters.length) defs.push(`<filter id="${u}t" x="-30%" y="-30%" width="160%" height="170%">${filters.join('')}</filter>`)
  if (glow > 0) defs.push(`<filter id="${u}w" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${2 + glow / 12}"/></filter>`)
  const art = GLYPHS[glyph] ?? ''
  const transform = `translate(${gx} ${gy}) scale(${k})`
  const stroke = `fill="none" stroke-width="${d.glyphStroke}" stroke-linecap="round" stroke-linejoin="round"`
  if (glow > 0) body.push(`<g transform="${transform}" ${stroke} stroke="url(#${u}k)" filter="url(#${u}w)" opacity="${glow / 100}">${art}</g>`)
  body.push(`<g transform="${transform}" ${stroke} stroke="url(#${u}k)"${filters.length ? ` filter="url(#${u}t)"` : ''}>${art}</g>`)
  if (o.badge) body.push(`<circle cx="${256 - d.inset - 22}" cy="${d.inset + 22}" r="15" fill="#ff4d5e" stroke="#fff" stroke-width="3"/>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><defs>${defs.join('')}</defs>${body.join('')}</svg>`
}

/** Draws an SVG to a PNG (base64, no prefix) at the given size. */
export async function rasterize(svg: string, size = 256): Promise<string> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, size, size)
  return c.toDataURL('image/png').split(',')[1]
}

export const designFrom = (t: Template): Design => ({ ...DEFAULT_DESIGN, ...t.design })
