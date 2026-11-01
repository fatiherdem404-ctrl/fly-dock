// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke } from '@/api'

type Stats = { cpu: number; ram: number; disk: number; diskLabel: string }

const R = 24
const C = 2 * Math.PI * R

function Ring({ label, value, tone }: { label: string; value: number; tone: 0 | 1 | 2 }) {
  return (
    <div className="wg-ring">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="wg-ring__track" />
        <circle cx="32" cy="32" r={R} className={`wg-ring__bar wg-ring__bar--${tone}`} strokeDasharray={`${(Math.min(value, 100) / 100) * C} ${C}`} transform="rotate(-90 32 32)" />
      </svg>
      <b>{value}<small>%</small></b>
      <span>{label}</span>
    </div>
  )
}

/** CPU, memory and disk as three rings. */
export default function SystemWidget() {
  const [stats, setStats] = useState<Stats>({ cpu: 0, ram: 0, disk: 0, diskLabel: 'C:' })
  useEffect(() => {
    const load = () => invoke('widgets:system').then(setStats)
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="wg-sys">
      <Ring label="CPU" value={stats.cpu} tone={0} />
      <Ring label="RAM" value={stats.ram} tone={1} />
      <Ring label={stats.diskLabel} value={stats.disk} tone={2} />
    </div>
  )
}
