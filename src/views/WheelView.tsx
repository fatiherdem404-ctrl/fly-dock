// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import Icon from '@/icons'
import WheelGlyph from '@/components/WheelGlyph'
import DockWindow from '@/components/DockWindow'
import type { WheelEntry } from '@/shared/types'

/** The gear menu: Windows control panels and admin tools in one searchable grid. */
export default function WheelView() {
  const [data, setData] = useState<{ entries: WheelEntry[]; hidden: string[] } | null>(null)
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const reload = () => invoke('wheel:list').then(setData)
  useEffect(() => {
    reload()
    input.current?.focus()
  }, [])
  useEvent('stack:changed', () => void reload())
  useEvent('icons:changed', () => void reload())

  const groups = useMemo(() => {
    const visible = (data?.entries ?? []).filter((e) => !data?.hidden.includes(e.id) && e.name.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')))
    const byCategory = new Map<string, WheelEntry[]>()
    for (const e of visible) byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e])
    return [...byCategory.entries()]
  }, [data, query])

  const toolbar = (
    <label className="dw__search">
      <Icon name="search" size={14} />
      <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara…" spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && groups[0]) invoke('wheel:run', groups[0][1][0].id)
        }} />
    </label>
  )
  const shown = groups.reduce((n, [, list]) => n + list.length, 0)
  const footer = data && (
    <>
      <span>{query.trim() ? `${shown} sonuç` : `${shown} araç`}</span>
      <span>Enter: ilkini aç · Sağ tık: seçenekler</span>
    </>
  )
  return (
    <DockWindow title="Kontrol paneli" icon="controlpanel" toolbar={toolbar} footer={footer}>
        <div className="stack__scroll">
          {groups.length === 0 && data && <div className="stack__empty"><span>Eşleşen bir şey yok</span></div>}
          {groups.map(([category, entries]) => (
            <section key={category}>
              <h4 className="wheel__category">{category}</h4>
              <div className="stack__grid">
                {entries.map((e) => (
                  <button key={e.id} className="stack__entry" title={e.name} onClick={() => invoke('wheel:run', e.id)} onContextMenu={(ev) => { ev.preventDefault(); invoke('entry:menu', { kind: 'wheel', id: e.id }) }}>
                    <span className={`wheel__icon${e.iconFile || e.path || e.packIcon ? ' wheel__icon--plain' : ''}`}><WheelGlyph entry={e} size={e.iconFile || e.path || e.packIcon ? 44 : 26} /></span>
                    <span className="stack__name stack__name--wrap">{e.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>
    </DockWindow>
  )
}
