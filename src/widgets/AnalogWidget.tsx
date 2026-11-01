// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import type { WidgetOptions } from '@/shared/widgets'

/** Analog clock drawn in SVG: ticks, optional numbers, three hands; every colour comes from the theme. */
export default function AnalogWidget({ options }: { options: WidgetOptions }) {
  const smooth = options.smooth !== false
  const showSeconds = options.seconds !== false
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), smooth ? 100 : 1000)
    return () => clearInterval(timer)
  }, [smooth])

  const d = new Date(now)
  const sec = d.getSeconds() + (smooth ? d.getMilliseconds() / 1000 : 0)
  const min = d.getMinutes() + sec / 60
  const hour = (d.getHours() % 12) + min / 60
  const numbers = String(options.numbers ?? 'quarters')

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0
    const a = (i * 6 * Math.PI) / 180
    const r1 = major ? 80 : 86
    return <line key={i} x1={100 + Math.sin(a) * r1} y1={100 - Math.cos(a) * r1} x2={100 + Math.sin(a) * 92} y2={100 - Math.cos(a) * 92} className={major ? 'wg-tick wg-tick--major' : 'wg-tick'} />
  })
  const labels = numbers === 'none' ? [] : (numbers === 'all' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [12, 3, 6, 9])
  return (
    <svg viewBox="0 0 200 200" className="wg-analog" role="img" aria-label="Analog saat">
      <circle cx="100" cy="100" r="96" className="wg-analog__face" />
      {ticks}
      {labels.map((n) => {
        const a = ((n % 12) * 30 * Math.PI) / 180
        return <text key={n} x={100 + Math.sin(a) * 66} y={100 - Math.cos(a) * 66 + 6} textAnchor="middle" className="wg-analog__num">{n}</text>
      })}
      <line x1="100" y1="106" x2="100" y2="58" className="wg-hand wg-hand--hour" transform={`rotate(${hour * 30} 100 100)`} />
      <line x1="100" y1="108" x2="100" y2="34" className="wg-hand wg-hand--min" transform={`rotate(${min * 6} 100 100)`} />
      {showSeconds && <line x1="100" y1="116" x2="100" y2="26" className="wg-hand wg-hand--sec" transform={`rotate(${sec * 6} 100 100)`} />}
      <circle cx="100" cy="100" r="5" className="wg-analog__cap" />
    </svg>
  )
}
