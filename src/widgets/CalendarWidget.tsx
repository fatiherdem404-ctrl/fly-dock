// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useState } from 'react'
import Icon from '@/icons'
import type { WidgetOptions } from '@/shared/widgets'
import { useNow } from './ClockWidget'

const DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

/** ISO week number (weeks start on Monday, week 1 holds the first Thursday). */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7)
}

/** A month grid with arrows to browse months, or one big "today" card. */
export default function CalendarWidget({ options }: { options: WidgetOptions; onOption?: (k: string, v: string | number | boolean) => void }) {
  const now = useNow(30_000)
  const [shift, setShift] = useState(0)
  if (options.view === 'day') {
    return (
      <div className="wg-day">
        <div className="wg-day__week">{now.toLocaleDateString('tr-TR', { weekday: 'long' })}</div>
        <div className="wg-day__num">{now.getDate()}</div>
        <div className="wg-day__month">{now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
      </div>
    )
  }

  const shown = new Date(now.getFullYear(), now.getMonth() + shift, 1)
  const first = (shown.getDay() + 6) % 7 // Monday first
  const count = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate()
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => new Date(shown.getFullYear(), shown.getMonth(), i - first + 1))
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7)).filter((row, r) => r < 5 || row.some((c) => c.getMonth() === shown.getMonth()))
  const weekNumbers = !!options.weekNumbers
  const isToday = (c: Date) => c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth() && c.getDate() === now.getDate()
  void count
  return (
    <div className="wg-cal">
      <div className="wg-cal__head">
        <div>
          <b>{shown.toLocaleDateString('tr-TR', { month: 'long' })}</b>
          <span>{shown.getFullYear()}</span>
        </div>
        <div className="wg-cal__nav">
          <button aria-label="Önceki ay" onClick={() => setShift((s) => s - 1)}><Icon name="arrowLeft" size={14} /></button>
          <button aria-label="Bu ay" className={shift === 0 ? 'is-now' : ''} onClick={() => setShift(0)}><i /></button>
          <button aria-label="Sonraki ay" onClick={() => setShift((s) => s + 1)}><Icon name="arrowRight" size={14} /></button>
        </div>
      </div>
      <div className={`wg-cal__grid${weekNumbers ? ' wg-cal__grid--weeks' : ''}`}>
        {weekNumbers && <span className="wg-cal__dow" />}
        {DAYS.map((d) => <span key={d} className="wg-cal__dow">{d}</span>)}
        {rows.map((row, r) => (
          <div className="wg-cal__row" key={r} style={{ display: 'contents' }}>
            {weekNumbers && <span className="wg-cal__wk">{isoWeek(row[0])}</span>}
            {row.map((c, i) => (
              <span key={i} className={`wg-cal__day${c.getMonth() !== shown.getMonth() ? ' is-out' : ''}${isToday(c) ? ' is-today' : ''}${i >= 5 ? ' is-weekend' : ''}`}>{c.getDate()}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
