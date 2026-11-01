// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
/** Starting points for a scene written by the user. Every one shows the same three hooks: init, draw, click. */

export const SCENE_HELP = `// Sahne kodu: aşağıdaki işlevlerden istediğini yaz.
//   init(ctx, view)             boyut her değiştiğinde çalışır; view = { width, height }
//   draw(ctx, t, dt, pointer)   her karede çalışır; t ve dt saniye
//                               pointer = { x, y, nx, ny, on, down }  (nx, ny: 0..1)
//   click(x, y)                 tıklayınca çalışır
`

import voidScene from './studio/scenes/void.js?raw'
import silkScene from './studio/scenes/silk.js?raw'
import synthScene from './studio/scenes/synth.js?raw'
import lavaScene from './studio/scenes/lava.js?raw'

export const SCENE_TEMPLATES: { id: string; name: string; code: string }[] = [
  { id: 'void', name: 'VOID: 3B toz evreni', code: voidScene },
  { id: 'silk', name: 'AKIŞ: ipek şeritler', code: silkScene },
  { id: 'synth', name: 'SYNTH: neon ufuk', code: synthScene },
  { id: 'lava', name: 'LAV: sıvı ışık', code: lavaScene },
  {
    id: 'blank',
    name: 'Boş sahne',
    code: `${SCENE_HELP}
function draw(ctx, t, dt, pointer) {
  const { width: w, height: h } = view
  ctx.fillStyle = '#0b1020'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#6aa6ff'
  ctx.beginPath()
  ctx.arc(pointer.x || w / 2, pointer.y || h / 2, 24 + Math.sin(t * 3) * 6, 0, Math.PI * 2)
  ctx.fill()
}
`,
  },
  {
    id: 'trail',
    name: 'Fare izi',
    code: `${SCENE_HELP}
const dots = []

function draw(ctx, t, dt, pointer) {
  const { width: w, height: h } = view
  // her karede bir önceki çizimi biraz karart: iz böyle sönüyor
  ctx.fillStyle = 'rgba(8, 10, 24, 0.14)'
  ctx.fillRect(0, 0, w, h)

  if (pointer.on) {
    dots.push({ x: pointer.x, y: pointer.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 1 })
  }
  for (let i = dots.length - 1; i >= 0; i--) {
    const d = dots[i]
    d.x += d.vx * dt
    d.y += d.vy * dt
    d.life -= dt * 0.7
    if (d.life <= 0) { dots.splice(i, 1); continue }
    ctx.fillStyle = 'hsla(' + (200 + t * 40) % 360 + ', 90%, 65%, ' + d.life + ')'
    ctx.beginPath()
    ctx.arc(d.x, d.y, 3 + d.life * 8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function click(x, y) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220
    dots.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 })
  }
}
`,
  },
  {
    id: 'rain',
    name: 'Neon yağmur',
    code: `${SCENE_HELP}
let drops = []

function init(ctx, view) {
  drops = Array.from({ length: Math.round(view.width / 14) }, () => ({
    x: Math.random() * view.width,
    y: Math.random() * view.height,
    speed: 160 + Math.random() * 380,
    len: 14 + Math.random() * 40,
  }))
}

function draw(ctx, t, dt, pointer) {
  const { width: w, height: h } = view
  ctx.fillStyle = 'rgba(6, 8, 18, 0.35)'
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (const d of drops) {
    // damlalar fareden hafifçe kaçar
    const dx = d.x - pointer.x, dy = d.y - pointer.y
    if (pointer.on && dx * dx + dy * dy < 120 * 120) d.x += Math.sign(dx || 1) * 120 * dt
    d.y += d.speed * dt
    if (d.y - d.len > h) { d.y = -10; d.x = Math.random() * w }
    ctx.strokeStyle = 'hsl(' + (170 + (d.x / w) * 120) + ', 90%, 60%)'
    ctx.beginPath()
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x, d.y - d.len)
    ctx.stroke()
  }
}
`,
  },
]
