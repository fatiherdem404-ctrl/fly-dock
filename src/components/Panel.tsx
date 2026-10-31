import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import { speedToMs } from '@/physics'
import type { DockSettings } from '@/shared/types'
import { initSound, playSound } from '@/sound'

/**
 * Shell of a dock window (folder, group, gear menu): grows out of the dock icon with the chosen animation,
 * and shrinks back on Esc, on a click outside, or when focus leaves.
 */
export default function Panel({ children, onSettings }: { children: ReactNode; onSettings?: (s: DockSettings) => void }) {
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [closing, setClosing] = useState(false)
  const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  // the panel sits 10 px inside the window, so shift the window-relative anchor into the panel's own space
  const origin = `${Number(query.get('ox') ?? 0) - 10}px ${Number(query.get('oy') ?? 0) - 10}px`

  useEffect(() => {
    initSound()
    const open = setTimeout(() => playSound('windowOpen'), 60)
    invoke('settings:get').then((s) => {
      setSettings(s)
      onSettings?.(s)
    })
    return () => clearTimeout(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useActiveTheme(settings?.theme)

  const timer = useRef<ReturnType<typeof setTimeout>>()
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    playSound('windowClose')
    timer.current = setTimeout(() => invoke('stack:close'), settings ? Math.min(speedToMs(settings.speed, settings.speedMs) * 0.6, 420) : 200)
  }, [closing, settings])
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [close])

  const kind = settings?.windowAnimation ?? 'genie'
  const ms = settings ? speedToMs(settings.speed, settings.speedMs) : 350
  return (
    <div className="stack-shell" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`stack stack--${kind}${closing ? ' stack--closing' : ''}`} style={{ transformOrigin: origin, '--win-ms': `${ms}ms` } as React.CSSProperties}>
        {children}
      </div>
    </div>
  )
}
