// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import type { WidgetOptions } from '@/shared/widgets'

/** The date and time, refreshed every second (or every few seconds when the seconds are hidden). */
export function useNow(everyMs: number): Date {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

/** Digital clock: big hours and minutes with a blinking colon, optional seconds, 12-hour mode and the date. */
export default function ClockWidget({ options }: { options: WidgetOptions }) {
  const seconds = !!options.seconds
  const now = useNow(seconds ? 1000 : 2000)
  const hour12 = !!options.hour12
  const h = hour12 ? now.getHours() % 12 || 12 : now.getHours()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="wg-clock">
      <div className="wg-clock__time">
        <b>{pad(h)}</b>
        <i className="wg-colon" style={{ opacity: seconds && now.getSeconds() % 2 ? 0.25 : 1 }}>:</i>
        <b>{pad(now.getMinutes())}</b>
        {seconds && <small>{pad(now.getSeconds())}</small>}
        {hour12 && <em>{now.getHours() < 12 ? 'ÖÖ' : 'ÖS'}</em>}
      </div>
      {options.date !== false && <div className="wg-clock__date">{date}</div>}
    </div>
  )
}
