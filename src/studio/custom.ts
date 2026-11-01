/** A glyph the user brought: markup in a 24 x 24 box, and whether it is made of filled shapes (true) or strokes (false). */
export interface CustomGlyph {
  art: string
  filled: boolean
}

const SHAPES = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'])
const ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'fill-rule', 'clip-rule', 'opacity']
const num = /^[-+0-9.,\sA-Za-z]*$/

/**
 * Turns pasted SVG code (Tabler, Lucide, Feather, Heroicons, Font Awesome…) into glyph markup. Only plain drawing
 * shapes survive: scripts, styles, images, links and every colour are dropped, so the code cannot do anything but draw.
 */
export function parseGlyph(code: string): CustomGlyph | { error: string } {
  const text = code.trim()
  if (!text) return { error: 'SVG kodunu buraya yapıştır.' }
  if (text.length > 60_000) return { error: 'Kod çok uzun.' }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') return { error: 'Bu geçerli bir SVG kodu değil. <svg …> ile başlamalı.' }
  const vb = (svg.getAttribute('viewBox') ?? '0 0 24 24').trim().split(/[\s,]+/).map(Number)
  const [vx, vy, vw, vh] = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, 24, 24]
  const k = 24 / Math.max(vw, vh)

  const rootFill = svg.getAttribute('fill')
  const rootStroke = svg.getAttribute('stroke')
  const filled = !(rootFill === 'none' || (rootStroke && rootStroke !== 'none') || svg.getAttribute('stroke-width'))
  let count = 0

  const walk = (el: Element): string => {
    let out = ''
    for (const child of Array.from(el.children)) {
      const tag = child.nodeName.toLowerCase()
      if (!SHAPES.has(tag)) continue
      if (++count > 400) break
      let attrs = ''
      for (const a of ATTRS) {
        const v = child.getAttribute(a)
        if (v !== null && num.test(v)) attrs += ` ${a}="${v}"`
      }
      // shapes that are meant to be see-through stay that way; every other colour is replaced by the studio's own
      if (child.getAttribute('fill') === 'none') attrs += ' fill="none"'
      if (child.getAttribute('stroke') === 'none') attrs += ' stroke="none"'
      out += tag === 'g' ? `<g${attrs}>${walk(child)}</g>` : `<${tag}${attrs}/>`
    }
    return out
  }
  const inner = walk(svg)
  if (!inner) return { error: 'SVG içinde çizilecek bir şekil bulunamadı.' }
  const art = k === 1 && vx === 0 && vy === 0 ? inner : `<g transform="scale(${+k.toFixed(5)}) translate(${-vx} ${-vy})">${inner}</g>`
  return { art, filled }
}
