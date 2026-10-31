import { useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import Icon, { IconName } from '@/icons'
import type { DockSettings, PowerAction } from '@/shared/types'

const ACTIONS: { id: PowerAction; label: string; icon: IconName; confirm: boolean }[] = [
  { id: 'lock', label: 'Kilitle', icon: 'lock', confirm: false },
  { id: 'sleep', label: 'Uyku', icon: 'moon', confirm: false },
  { id: 'logout', label: 'Oturumu kapat', icon: 'logout', confirm: true },
  { id: 'restart', label: 'Yeniden başlat', icon: 'restart', confirm: true },
  { id: 'shutdown', label: 'Kapat', icon: 'power', confirm: true },
]

/** Full-screen power menu. Anything that ends the session asks for a second click first. */
export default function PowerView() {
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [armed, setArmed] = useState<PowerAction | null>(null)
  const [now, setNow] = useState(new Date())
  const [closing, setClosing] = useState(false)
  const blur = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('blur') === '1'
  useEffect(() => {
    invoke('settings:get').then(setSettings)
    const timer = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(timer)
  }, [])
  useActiveTheme(settings?.theme)

  const disarm = useRef<ReturnType<typeof setTimeout>>()
  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => invoke('power:close'), 160)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const choose = (a: (typeof ACTIONS)[number]) => {
    if (a.confirm && armed !== a.id) {
      setArmed(a.id)
      clearTimeout(disarm.current)
      disarm.current = setTimeout(() => setArmed(null), 3500)
      return
    }
    invoke('power:run', a.id)
  }

  const hour = now.getHours()
  const greeting = hour < 5 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  return (
    <div className={`power${blur ? ' power--blur' : ''}${closing ? ' power--closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="power__clock">{now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="power__greeting">{greeting}</div>
      <div className="power__row">
        {ACTIONS.map((a, i) => (
          <button key={a.id} className={`power__btn${armed === a.id ? ' power__btn--armed' : ''}${a.id === 'shutdown' ? ' power__btn--danger' : ''}`} style={{ animationDelay: `${60 + i * 45}ms` }} onClick={() => choose(a)}>
            <span><Icon name={a.icon} size={30} /></span>
            <b>{armed === a.id ? 'Emin misin? Tekrar tıkla' : a.label}</b>
          </button>
        ))}
      </div>
      <div className="power__hint">Esc ile kapat</div>
    </div>
  )
}
