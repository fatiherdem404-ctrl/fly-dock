import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import type { InvokeMap, WidgetInstance } from '@/shared/types'

type Weather = InvokeMap['widgets:weather']['result']

// WMO weather codes grouped into the few icons we draw.
function describe(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: '☀️', text: 'Açık' }
  if (code <= 2) return { icon: '⛅', text: 'Parçalı bulutlu' }
  if (code === 3) return { icon: '☁️', text: 'Bulutlu' }
  if (code <= 48) return { icon: '🌫️', text: 'Sisli' }
  if (code <= 57) return { icon: '🌦️', text: 'Çisenti' }
  if (code <= 67) return { icon: '🌧️', text: 'Yağmurlu' }
  if (code <= 77) return { icon: '❄️', text: 'Karlı' }
  if (code <= 82) return { icon: '🌧️', text: 'Sağanak' }
  if (code <= 86) return { icon: '🌨️', text: 'Kar sağanağı' }
  return { icon: '⛈️', text: 'Fırtına' }
}

export default function WeatherWidget({ options }: { options: WidgetInstance['options'] }) {
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

  if (!data) return <div className="widget__muted">Yükleniyor…</div>
  if (!data.ok) return <div className="widget__muted">Hava durumu alınamadı ({data.message})</div>
  const { icon, text } = describe(data.code)
  return (
    <div className="widget__weather">
      <div className="widget__icon">{icon}</div>
      <div>
        <div className="widget__big">{data.temp}°C</div>
        <div className="widget__muted">{data.city} · {text}</div>
        <div className="widget__muted">Rüzgâr {data.wind} km/s</div>
      </div>
    </div>
  )
}
