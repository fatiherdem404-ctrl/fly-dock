import { useEffect, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
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

export default function StackView({ itemId }: { itemId: string }) {
  const [entries, setEntries] = useState<StackEntry[]>([])
  const [settings, setSettings] = useState<DockSettings | null>(null)
  useEffect(() => {
    invoke('stack:list', itemId).then(setEntries)
    invoke('settings:get').then(setSettings)
  }, [itemId])
  useActiveTheme(settings?.theme)

  return (
    <div className="stack">
      {entries.length === 0 && <div className="stack__empty">Klasör boş</div>}
      <div className="stack__grid">
        {entries.map((entry) => (
          <button key={entry.path} className="stack__entry" title={entry.name} onClick={() => invoke('stack:open', entry.path)}>
            <StackIcon entry={entry} />
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
