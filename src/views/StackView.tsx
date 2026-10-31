import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import Panel from '@/components/Panel'
import type { StackEntry } from '@/shared/types'

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
  useEffect(() => {
    invoke('stack:list', itemId).then(setEntries)
  }, [itemId])

  return (
    <Panel>
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
    </Panel>
  )
}
