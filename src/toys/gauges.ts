// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// The meters every aiming game shares: a green-yellow-red power gauge and a round dial for the curl (or the height).
import { TAU } from './mini'

const FONT = "700 11px 'Segoe UI', system-ui, sans-serif"

/** A segmented power gauge, centred on (x, y): green at the bottom of the range, red at the top. */
export function powerGauge(c: CanvasRenderingContext2D, x: number, y: number, power: number, label = 'GÜÇ') {
  const w = 118, h = 16, n = 12
  const left = x - w / 2
  c.save()
  c.fillStyle = 'rgba(10,14,28,0.82)'
  c.strokeStyle = 'rgba(255,255,255,0.22)'
  c.lineWidth = 1.5
  c.beginPath()
  c.roundRect(left - 5, y - h / 2 - 5, w + 10, h + 10, 10)
  c.fill()
  c.stroke()
  const lit = Math.round(power * n)
  for (let i = 0; i < n; i++) {
    const hue = 125 - (i / (n - 1)) * 125 // 125 green ... 0 red
    c.fillStyle = i < lit ? `hsl(${hue}, 90%, ${52 + (i < lit ? 0 : 0)}%)` : `hsla(${hue}, 60%, 40%, 0.22)`
    c.beginPath()
    c.roundRect(left + i * (w / n) + 1, y - h / 2, w / n - 2.5, h, 3)
    c.fill()
  }
  c.fillStyle = '#ffffff'
  c.font = FONT
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.lineJoin = 'round'
  c.lineWidth = 3.5
  c.strokeStyle = 'rgba(10,14,28,0.85)'
  c.strokeText(`${label}  ${Math.round(power * 100)}%`, x, y + h / 2 + 15)
  c.fillText(`${label}  ${Math.round(power * 100)}%`, x, y + h / 2 + 15)
  c.restore()
}

/**
 * A round dial. `value` runs -1..1 for a curl (the knob sits on the ring, left of the top for one way, right for the
 * other) or 0..1 for a height (a needle from flat to straight up).
 */
export function dial(c: CanvasRenderingContext2D, x: number, y: number, value: number, label: string, kind: 'curl' | 'height' = 'curl') {
  const r = 24
  c.save()
  const g = c.createRadialGradient(x - 6, y - 8, 4, x, y, r + 6)
  g.addColorStop(0, 'rgba(36,44,72,0.95)')
  g.addColorStop(1, 'rgba(10,14,28,0.92)')
  c.fillStyle = g
  c.strokeStyle = 'rgba(255,255,255,0.25)'
  c.lineWidth = 2
  c.beginPath()
  c.arc(x, y, r + 5, 0, TAU)
  c.fill()
  c.stroke()
  // the scale
  c.strokeStyle = 'rgba(255,255,255,0.35)'
  c.lineWidth = 1.5
  c.beginPath()
  if (kind === 'curl') {
    for (let i = -5; i <= 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * 1.75
      c.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2))
      c.lineTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2))
    }
  } else {
    for (let i = 0; i <= 6; i++) {
      const a = -(i / 6) * (Math.PI / 2)
      c.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2))
      c.lineTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2))
    }
  }
  c.stroke()
  // the reading
  const a = kind === 'curl' ? -Math.PI / 2 + value * 1.75 : -value * (Math.PI / 2)
  c.strokeStyle = '#6aa6ff'
  c.lineWidth = 3
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(x, y)
  c.lineTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6))
  c.stroke()
  c.fillStyle = '#b36bff'
  c.beginPath()
  c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 5, 0, TAU)
  c.fill()
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.arc(x, y, 3, 0, TAU)
  c.fill()
  c.font = FONT
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.lineJoin = 'round'
  c.lineWidth = 3.5
  c.strokeStyle = 'rgba(10,14,28,0.85)'
  c.strokeText(label, x, y + r + 17)
  c.fillText(label, x, y + r + 17)
  c.restore()
}

/** Where the two meters go next to a ball: below it, or above when there is no room below. */
export function gaugeSpot(ballX: number, ballY: number, floor: number): { px: number; py: number; dx: number; dy: number } {
  const below = ballY + 112 < floor
  const y = below ? ballY + 56 : ballY - 70
  return { px: ballX - 52, py: y, dx: ballX + 70, dy: y - 4 }
}
