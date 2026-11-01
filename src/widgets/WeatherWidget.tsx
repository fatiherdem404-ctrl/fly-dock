// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import type { InvokeMap } from '@/shared/types'
import type { WidgetOptions } from '@/shared/widgets'

type Weather = InvokeMap['widgets:weather']['result']
type Kind = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

// WMO weather codes grouped into the few conditions we draw.
function describe(code: number): { kind: Kind; text: string } {
  if (code === 0) return { kind: 'clear', text: 'Açık' }
  if (code <= 2) return { kind: 'partly', text: 'Parçalı bulutlu' }
  if (code === 3) return { kind: 'cloud', text: 'Bulutlu' }
  if (code <= 48) return { kind: 'fog', text: 'Sisli' }
  if (code <= 57) return { kind: 'drizzle', text: 'Çisenti' }
  if (code <= 67) return { kind: 'rain', text: 'Yağmurlu' }
  if (code <= 77) return { kind: 'snow', text: 'Karlı' }
  if (code <= 82) return { kind: 'rain', text: 'Sağanak' }
  if (code <= 86) return { kind: 'snow', text: 'Kar sağanağı' }
  return { kind: 'storm', text: 'Fırtına' }
}

const SUN = <circle cx="32" cy="32" r="11" fill="#ffc83d" />
const RAYS = (
  <g stroke="#ffc83d" strokeWidth="3.2" strokeLinecap="round">
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return <line key={i} x1={32 + Math.cos(a) * 17} y1={32 + Math.sin(a) * 17} x2={32 + Math.cos(a) * 23} y2={32 + Math.sin(a) * 23} />
    })}
  </g>
)
const CLOUD = <path d="M20 44a9 9 0 0 1-1-17.9A12 12 0 0 1 42 24a10 10 0 0 1 2 20z" fill="#e6edf8" />
const CLOUD_DARK = <path d="M20 40a9 9 0 0 1-1-17.9A12 12 0 0 1 42 20a10 10 0 0 1 2 20z" fill="#9aa8c0" />

/** A weather condition drawn in SVG (no emoji, so it looks the same everywhere). */
export function WeatherIcon({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 64 64" className="wg-wx__icon" aria-hidden="true">
      {kind === 'clear' && <>{RAYS}{SUN}</>}
      {kind === 'partly' && <><g transform="translate(-6 -8) scale(0.85)">{RAYS}{SUN}</g><g transform="translate(4 4)">{CLOUD}</g></>}
      {kind === 'cloud' && <>{CLOUD}</>}
      {kind === 'fog' && <><g opacity="0.9">{CLOUD}</g><g stroke="#cdd6e6" strokeWidth="3" strokeLinecap="round"><line x1="16" y1="50" x2="48" y2="50" /><line x1="22" y1="56" x2="54" y2="56" /></g></>}
      {(kind === 'drizzle' || kind === 'rain') && <>{CLOUD_DARK}<g stroke="#5aa2ff" strokeWidth="3.4" strokeLinecap="round"><line x1="22" y1="46" x2="19" y2="54" /><line x1="32" y1="46" x2="29" y2="56" /><line x1="42" y1="46" x2="39" y2="54" /></g></>}
      {kind === 'snow' && <>{CLOUD}<g fill="#fff"><circle cx="22" cy="50" r="2.6" /><circle cx="32" cy="55" r="2.6" /><circle cx="42" cy="50" r="2.6" /></g></>}
      {kind === 'storm' && <>{CLOUD_DARK}<path d="M34 40l-8 12h7l-3 10 11-15h-7l4-7z" fill="#ffd23d" /></>}
    </svg>
  )
}

export default function WeatherWidget({ options }: { options: WidgetOptions }) {
  const city = String(options.city ?? 'Istanbul')
  const [data, setData] = useState<Weather | null>(null)
  useEffect(() => {
    let live = true
    const load = () => invoke('widgets:weather', city).then((w) => live && setData(w))
    load()
    const timer = setInterval(load, 15 * 60_000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [city])

  if (!data) return <div className="wg-wx wg-wx--note">Yükleniyor…</div>
  if (!data.ok) return <div className="wg-wx wg-wx--note">Hava durumu alınamadı<small>{data.message === 'offline' ? 'İnternet yok' : data.message}</small></div>
  const { kind, text } = describe(data.code)
  return (
    <div className="wg-wx">
      <WeatherIcon kind={kind} />
      <div className="wg-wx__info">
        <div className="wg-wx__temp">{data.temp}<sup>°C</sup></div>
        <div className="wg-wx__text">{text}</div>
        <div className="wg-wx__meta">{data.city} · Rüzgâr {data.wind} km/s</div>
      </div>
    </div>
  )
}
