import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import WheelGlyph from '@/components/WheelGlyph'
import Panel from '@/components/Panel'
import type { WheelEntry } from '@/shared/types'

/** The gear menu: Windows control panels and admin tools in one searchable grid. */
export default function WheelView() {
  const [data, setData] = useState<{ entries: WheelEntry[]; hidden: string[] } | null>(null)
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    invoke('wheel:list').then(setData)
    input.current?.focus()
  }, [])

  const groups = useMemo(() => {
    const visible = (data?.entries ?? []).filter((e) => !data?.hidden.includes(e.id) && e.name.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')))
    const byCategory = new Map<string, WheelEntry[]>()
    for (const e of visible) byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e])
    return [...byCategory.entries()]
  }, [data, query])

  return (
    <Panel>
      <div className="wheel">
        <label className="wheel__search">
          <Icon name="settings" size={16} />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara…" spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && groups[0]) invoke('wheel:run', groups[0][1][0].id)
            }} />
        </label>
        <div className="stack__scroll">
          {groups.length === 0 && data && <div className="stack__empty"><span>Eşleşen bir şey yok</span></div>}
          {groups.map(([category, entries]) => (
            <section key={category}>
              <h4 className="wheel__category">{category}</h4>
              <div className="stack__grid">
                {entries.map((e) => (
                  <button key={e.id} className="stack__entry" title={e.name} onClick={() => invoke('wheel:run', e.id)}>
                    <span className={`wheel__icon${e.iconFile || e.path ? ' wheel__icon--plain' : ''}`}><WheelGlyph entry={e} size={e.iconFile || e.path ? 44 : 26} /></span>
                    <span>{e.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Panel>
  )
}
