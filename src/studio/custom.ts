import { t } from '../i18n'
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
/** A glyph the user brought: markup in a 24 x 24 box, and whether it is made of filled shapes (true) or strokes (false). */
export interface CustomGlyph {
  art: string
  filled: boolean
  /** The pasted colours are kept (a brand logo) instead of being replaced by the studio's. */
  colored?: boolean
}

const SHAPES = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'])
const ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'fill-rule', 'clip-rule', 'opacity']
// colours only: names, #hex, rgb()/hsl(); never url(...) references
const SAFE_PAINT = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(rgb|hsl)a?\([0-9.,%\s]+\)|[0-9.]+|butt|round|square|miter|bevel)$/
const num = /^[-+0-9.,\sA-Za-z]*$/

/**
 * Turns pasted SVG code (Tabler, Lucide, Feather, Heroicons, Font Awesome…) into glyph markup. Only plain drawing
 * shapes survive: scripts, styles, images, links and every colour are dropped, so the code cannot do anything but draw.
 */
export function parseGlyph(code: string, keepColors = false): CustomGlyph | { error: string } {
  const text = code.trim()
  if (!text) return { error: t('SVG kodunu buraya yapıştır.') }
  if (text.length > 60_000) return { error: t('Kod çok uzun.') }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') return { error: t('Bu geçerli bir SVG kodu değil. <svg …> ile başlamalı.') }
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
      for (const a of keepColors ? ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity'] : ['fill', 'stroke']) {
        const v = child.getAttribute(a)
        if (v === null) continue
        if (v === 'none' || (keepColors && SAFE_PAINT.test(v))) attrs += ` ${a}="${v}"`
      }
      out += tag === 'g' ? `<g${attrs}>${walk(child)}</g>` : `<${tag}${attrs}/>`
    }
    return out
  }
  const inner = walk(svg)
  if (!inner) return { error: t('SVG içinde çizilecek bir şekil bulunamadı.') }
  // a root paint is inherited by every shape without its own
  const rootPaint = keepColors ? [['fill', rootFill], ['stroke', rootStroke]].filter(([, v]) => v && v !== 'none' && SAFE_PAINT.test(v)).map(([a, v]) => ` ${a}="${v}"`).join('') : ''
  const art0 = rootPaint ? `<g${rootPaint}>${inner}</g>` : inner
  const art = k === 1 && vx === 0 && vy === 0 ? art0 : `<g transform="scale(${+k.toFixed(5)}) translate(${-vx} ${-vy})">${art0}</g>`
  return { art, filled, ...(keepColors ? { colored: true } : {}) }
}
