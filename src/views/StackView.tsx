import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import Icon from '@/icons'
import { speedToMs } from '@/physics'
import type { DockSettings, StackEntry } from '@/shared/types'

function StackIcon({ entry }: { entry: StackEntry }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    invoke('icon:path', entry.path).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [entry.path])
  return src ? <img src={src} alt="" draggable={false} /> : <div className="stack__placeholder" />
}

/** The dock's window for a folder or group: grows out of its icon, scrolls, closes on Esc or when focus leaves. */
export default function StackView({ itemId }: { itemId: string }) {
  const [entries, setEntries] = useState<StackEntry[] | null>(null)
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [closing, setClosing] = useState(false)
  const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  // the panel sits 10 px inside the window, so shift the window-relative anchor into the panel's own space
  const origin = `${Number(query.get('ox') ?? 0) - 10}px ${Number(query.get('oy') ?? 0) - 10}px`

  useEffect(() => {
    invoke('stack:list', itemId).then(setEntries)
    invoke('settings:get').then(setSettings)
  }, [itemId])
  useActiveTheme(settings?.theme)

  const timer = useRef<ReturnType<typeof setTimeout>>()
  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
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
        <div className="stack__scroll">
          {entries && entries.length === 0 && (
            <div className="stack__empty">
              <Icon name="folder" size={28} />
              <span>Burada henüz bir şey yok</span>
            </div>
          )}
          <div className="stack__grid">
            {entries?.map((entry) => (
              <button key={entry.path} className="stack__entry" title={entry.path} onClick={() => invoke('stack:open', entry.path)}>
                <StackIcon entry={entry} />
                <span>{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
