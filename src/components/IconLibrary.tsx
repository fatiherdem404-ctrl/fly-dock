// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import Icon from '@/icons'
import type { LibraryIcon } from '@/shared/types'

const PAGE = 150

/** One library picture; the preview is fetched only when the tile scrolls into view. */
function Tile({ icon, selected, onPick }: { icon: LibraryIcon; selected: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect()
        invoke('library:thumb', icon.path).then((s) => live && setSrc(s))
      }
    })
    observer.observe(el)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [icon.path])
  return (
    <button ref={ref} className="iconlib__tile" aria-pressed={selected} title={`${icon.name} · ${icon.source}`} onClick={onPick}>
      {src ? <img src={src} alt="" draggable={false} /> : <span />}
      <small>{icon.name}</small>
    </button>
  )
}

/**
 * The icon library, like RocketDock's icon browser: pictures from the folders the user added and from the installed
 * icon packs in one searchable grid, with a button to add a folder or pick any single picture.
 */
export default function IconLibrary({ onPick, selected }: { onPick: (file: string, preview?: string) => void; selected?: string | null }) {
  const [data, setData] = useState<{ icons: LibraryIcon[]; folders: string[] } | null>(null)
  const [query, setQuery] = useState('')
  // '' = every source; null = not chosen yet, which starts on the active icon pack so packs do not get mixed up
  const [chosen, setSource] = useState<string | null>(null)
  const [activePack, setActivePack] = useState('')
  const [shown, setShown] = useState(PAGE)
  const reload = () => invoke('library:list').then(setData)
  useEffect(() => {
    reload()
    Promise.all([invoke('settings:get'), invoke('packs:list')]).then(([s, packs]) => setActivePack(packs.find((p) => p.type === 'icons' && p.id === s.iconPack)?.name ?? ''))
  }, [])
  useEvent('themes:changed', () => void reload())

  const sources = useMemo(() => [...new Set((data?.icons ?? []).map((i) => i.source))], [data])
  const source = chosen ?? (sources.includes(activePack) ? activePack : '')
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return (data?.icons ?? []).filter((i) => (!source || i.source === source) && (!q || i.name.toLocaleLowerCase('tr').includes(q)))
  }, [data, query, source])
  useEffect(() => setShown(PAGE), [query, source])

  const addFolder = async () => {
    if (await invoke('library:add-folder')) reload()
  }
  const pickFile = async () => {
    const got = await invoke('library:pick')
    if (got) onPick(got.path, got.preview)
  }

  return (
    <div className="iconlib">
      <div className="iconlib__bar">
        <label className="iconlib__search">
          <Icon name="image" size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Simge ara…" spellCheck={false} />
        </label>
        {sources.length > 1 && (
          <select className="iconlib__select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Simge paketi">
            <option value="">Tüm paketler ve klasörler</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button className="iconlib__btn" onClick={addFolder}><Icon name="folder" size={14} />Klasör ekle…</button>
        <button className="iconlib__btn" onClick={pickFile}><Icon name="image" size={14} />Resim seç…</button>
      </div>
      {data && data.folders.length > 0 && (
        <div className="iconlib__folders">
          {data.folders.map((f) => (
            <span key={f} className="iconlib__chip" title={f}>
              {f.split(/[\\/]/).filter(Boolean).pop() ?? f}
              <button aria-label="Klasörü listeden kaldır" onClick={() => invoke('library:remove-folder', f).then(reload)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="iconlib__grid">
        {filtered.slice(0, shown).map((icon) => <Tile key={icon.path} icon={icon} selected={selected === icon.path} onPick={() => onPick(icon.path)} />)}
        {data && filtered.length === 0 && (
          <div className="iconlib__empty">
            <Icon name="image" size={26} />
            <span>{data.icons.length === 0 ? 'Henüz simge yok. İçinde simge resimleri olan bir klasör ekle; yüklü simge paketleri de burada görünür.' : 'Eşleşen simge yok.'}</span>
          </div>
        )}
        {filtered.length > shown && <button className="iconlib__more" onClick={() => setShown((n) => n + PAGE)}>Daha fazla göster ({filtered.length - shown})</button>}
      </div>
    </div>
  )
}
