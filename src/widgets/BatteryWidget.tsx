import { useEffect, useState } from 'react'

interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
  chargingTime: number
  dischargingTime: number
}

/** Battery level as a big ring with the charging state; a desktop PC just shows full. */
export default function BatteryWidget() {
  const [level, setLevel] = useState<number | null>(null)
  const [charging, setCharging] = useState(false)
  const [minutes, setMinutes] = useState<number | null>(null)
  useEffect(() => {
    let battery: BatteryManager | null = null
    const read = () => {
      if (!battery) return
      setLevel(Math.round(battery.level * 100))
      setCharging(battery.charging)
      const secs = battery.charging ? battery.chargingTime : battery.dischargingTime
      setMinutes(Number.isFinite(secs) && secs > 0 ? Math.round(secs / 60) : null)
    }
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }
    nav.getBattery?.().then((b) => {
      battery = b
      read()
      ;['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((e) => b.addEventListener(e, read))
    })
    return () => {
      if (battery) ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach((e) => battery!.removeEventListener(e, read))
    }
  }, [])
  const pct = level ?? 100
  const R = 38
  const C = 2 * Math.PI * R
  const low = pct <= 20 && !charging
  const left = minutes === null ? '' : minutes >= 60 ? `${Math.floor(minutes / 60)} sa ${minutes % 60} dk` : `${minutes} dk`
  return (
    <div className="wg-bat">
      <div className="wg-bat__ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="wg-ring__track" />
          <circle cx="50" cy="50" r={R} className={`wg-ring__bar wg-ring__bar--${low ? 'low' : 'ok'}`} strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
        </svg>
        <b><span>{pct}<small>%</small></span></b>
      </div>
      <div className="wg-bat__text">
        <b>{charging ? 'Şarj oluyor' : level === null ? 'Pil' : 'Pilde'}</b>
        <span>{charging ? (left ? `Dolmasına ${left}` : 'Prize takılı') : left ? `Yaklaşık ${left} kaldı` : 'Kalan süre bilinmiyor'}</span>
        <i className={charging ? 'wg-bat__bolt is-on' : 'wg-bat__bolt'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 14h6l-1 8 8-12h-6z" /></svg>
        </i>
      </div>
    </div>
  )
}
