// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke, useEvent } from '@/api'
import Icon from '@/icons'
import DockWindow from '@/components/DockWindow'
import type { DockSettings, StackEntry, StackSort, StackView as ViewMode } from '@/shared/types'

import { t as tl, getLang, locale } from '../i18n'
const VIEWS: [ViewMode, string][] = [['xl', tl('Çok büyük simgeler')], ['large', tl('Büyük simgeler')], ['medium', tl('Orta simgeler')], ['small', tl('Küçük simgeler')], ['list', tl('Liste')], ['details', tl('Ayrıntılar')]]
const SORTS: [StackSort, string][] = [['name', tl('Ad')], ['date', tl('Değişiklik tarihi')], ['size', tl('Boyut')], ['type', tl('Tür')]]
/** Edge of the picture in px for each view, and how sharp a preview to ask the shell for. */
const ICON_PX: Record<ViewMode, number> = { xl: 112, large: 80, medium: 48, small: 32, list: 22, details: 20 }
const PREVIEW_EXT = /^(png|jpe?g|gif|bmp|webp|tiff?|heic|avif|mp4|mkv|avi|mov|wmv|webm|pdf|svg|ico)$/

function StackIcon({ entry, view }: { entry: StackEntry; view: ViewMode }) {
  const [src, setSrc] = useState<string | null>(null)
  const px = ICON_PX[view]
  useEffect(() => {
    let live = true
    setSrc(null)
    const wantsPreview = !entry.isDirectory && PREVIEW_EXT.test(entry.ext) && px >= 32
    const load = wantsPreview
      ? invoke('stack:thumb', entry.path, px * 2).then((t) => t ?? invoke('icon:path', entry.path))
      : invoke('icon:path', entry.path)
    load.then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [entry.path, px])
  const style = { width: px, height: px }
  return src ? <img src={src} alt="" draggable={false} style={style} /> : <div className="stack__placeholder" style={style} />
}

function kindOf(e: StackEntry) {
  return e.isDirectory ? tl('Klasör') : e.ext ? tl('{v0} dosyası', { v0: e.ext.toUpperCase() }) : tl('Dosya')
}

function sizeText(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

function sorted(entries: StackEntry[], by: StackSort, desc: boolean): StackEntry[] {
  const dir = desc ? -1 : 1
  const cmp = (a: StackEntry, b: StackEntry) => {
    switch (by) {
      case 'date': return a.mtime - b.mtime
      case 'size': return a.size - b.size
      case 'type': return a.ext.localeCompare(b.ext) || a.name.localeCompare(b.name, locale())
      default: return a.name.localeCompare(b.name, locale(), { numeric: true })
    }
  }
  // folders always come first, like in Explorer
  return [...entries].sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || cmp(a, b) * dir)
}

/** The dock's window for a folder or group: grows out of its icon, scrolls, closes on Esc or when focus leaves. */
export default function StackView({ itemId }: { itemId: string }) {
  const [entries, setEntries] = useState<StackEntry[] | null>(null)
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const reload = () => invoke('stack:list', itemId).then(setEntries)
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])
  useEvent('stack:changed', () => void reload())

  const change = (partial: Partial<DockSettings>) => {
    setSettings((cur) => (cur ? { ...cur, ...partial } : cur))
    invoke('settings:update', partial)
  }
  const view = settings?.stackView ?? 'medium'
  const by = settings?.stackSort ?? 'name'
  const desc = settings?.stackDesc ?? false
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => searchRef.current?.focus(), [])
  const all = useMemo(() => (entries ? sorted(entries, by, desc) : null), [entries, by, desc])
  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(getLang())
    return all && q ? all.filter((e) => e.name.toLocaleLowerCase(getLang()).includes(q)) : all
  }, [all, query])
  const totalBytes = useMemo(() => (list ?? []).reduce((sum, e) => sum + (e.isDirectory ? 0 : e.size), 0), [list])
  const rows = view === 'list' || view === 'details'

  const open = (entry: StackEntry) => invoke('stack:open', entry.path)
  const title = decodeURIComponent(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t') ?? '') || tl('Klasör')
  const toolbar = (
    <>
      <label className="dw__search">
        <Icon name="search" size={14} />
        <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tl('Bu klasörde ara…')} spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && list?.[0]) open(list[0])
          }} />
      </label>
      <select className="stack__select" aria-label={tl('Görünüm')} value={view} onChange={(e) => change({ stackView: e.target.value as ViewMode })}>
        {VIEWS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <select className="stack__select" aria-label={tl('Sırala')} value={by} onChange={(e) => change({ stackSort: e.target.value as StackSort })}>
        {SORTS.map(([v, label]) => <option key={v} value={v}>{tl('Sırala:')} {label}</option>)}
      </select>
      <button className="stack__tool" aria-label={desc ? tl('Azalan sıra') : tl('Artan sıra')} title={desc ? tl('Azalan') : tl('Artan')} onClick={() => change({ stackDesc: !desc })}>
        <Icon name={desc ? 'arrowDown' : 'arrowUp'} size={14} />
      </button>
    </>
  )
  const footer = list && (
    <>
      <span>{query.trim() ? tl('{length} sonuç ({v1} öğe içinde)', { length: list.length, v1: all?.length ?? 0 }) : tl('{length} öğe', { length: list.length })}</span>
      <span>{totalBytes > 0 ? sizeText(totalBytes) : ''}</span>
    </>
  )
  return (
    <DockWindow title={title} icon="folder" toolbar={toolbar} footer={footer} onSettings={setSettings}>
      <div className="stack__scroll">
        {list && list.length === 0 && (
          <div className="stack__empty">
            <Icon name="folder" size={28} />
            <span>{query.trim() ? tl('Aramayla eşleşen bir şey yok') : tl('Burada henüz bir şey yok')}</span>
          </div>
        )}
        {view === 'details' && list && list.length > 0 && (
          <div className="stack__head">
            <span /><span>{tl('Ad')}</span><span>{tl('Tarih')}</span><span>{tl('Tür')}</span><span>{tl('Boyut')}</span>
          </div>
        )}
        <div className={`stack__grid stack__grid--${view}`}>
          {list?.map((entry) => (
            <button key={entry.path} className={`stack__entry${rows ? ' stack__entry--row' : ''}`} title={entry.path} onClick={() => open(entry)} onContextMenu={(e) => { e.preventDefault(); invoke('entry:menu', { kind: 'stack', itemId, path: entry.path }) }}>
              <StackIcon entry={entry} view={view} />
              <span className="stack__name">{entry.name}</span>
              {view === 'details' && (
                <>
                  <span className="stack__meta">{entry.mtime ? new Date(entry.mtime).toLocaleDateString(locale()) : ''}</span>
                  <span className="stack__meta">{kindOf(entry)}</span>
                  <span className="stack__meta stack__meta--num">{entry.isDirectory ? '' : sizeText(entry.size)}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </DockWindow>
  )
}
