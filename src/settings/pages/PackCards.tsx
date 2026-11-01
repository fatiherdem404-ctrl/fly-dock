// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import { LIVE_WALLPAPERS, PackInfo, ThemeDef } from '@/shared/types'
import { Message } from '../ui'
import { ThemeScene } from '../previews'

import { t as tl } from '../../i18n'
// ---- Themes and icon packs, shown as cards with a picture of what they do ----

const liveName = (id?: string) => LIVE_WALLPAPERS.find(([k]) => k === id)?.[1]

/** The first few icons of an installed icon pack, as thumbnails. */
function PackStrip({ name }: { name: string }) {
  const [thumbs, setThumbs] = useState<string[]>([])
  useEffect(() => {
    let live = true
    invoke('library:list').then(async (lib) => {
      const own = lib.icons.filter((i) => i.source === name).slice(0, 4)
      const got = await Promise.all(own.map((i) => invoke('library:thumb', i.path)))
      if (live) setThumbs(got.filter((g): g is string => !!g))
    })
    return () => {
      live = false
    }
  }, [name])
  return (
    <span className="st-iconstrip">
      {thumbs.length > 0 ? thumbs.map((src, i) => <img key={i} src={src} alt="" />) : [0, 1, 2, 3].map((i) => <i key={i} />)}
    </span>
  )
}

export function PackCards({ packs, activeId, onUse, type, onChanged }: { packs: PackInfo[]; activeId: string; onUse: (id: string) => void; type: PackInfo['type']; onChanged: () => void }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [themes, setThemes] = useState<Record<string, ThemeDef>>({})
  const list = packs.filter((p) => p.type === type)
  useEffect(() => {
    if (type !== 'theme') return
    list.forEach((p) => invoke('themes:get', p.id).then((t) => t && setThemes((cur) => ({ ...cur, [p.id]: t }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packs, type])
  const act = async (fn: () => Promise<{ ok: boolean; message: string }>, success: string) => {
    const result = await fn()
    if (result.message === 'cancelled') return
    setMessage({ text: result.ok ? `${success}: ${result.message}` : result.message, error: !result.ok })
    onChanged()
  }
  return (
    <>
      <div className="st-themecards">
        {type === 'icons' && (
          <div className="st-themecard" data-active={activeId === ''}>
            <button className="st-themecard__pic" onClick={() => onUse('')} aria-label={tl('Sistem simgelerini kullan')}>
              <span className="st-iconstrip">{[0, 1, 2, 3].map((i) => <i key={i} />)}</span>
            </button>
            <div className="st-themecard__title"><b>{tl('Sistem simgeleri')}</b>{activeId === '' && <span className="st-badge"><Icon name="check" size={11} />{tl('Kullanımda')}</span>}</div>
            <small>{tl('Windows’un kendi simgeleri')}</small>
          </div>
        )}
        {list.map((p) => {
          const theme = themes[p.id]
          const active = activeId === p.id
          return (
            <div key={p.id} className="st-themecard" data-active={active}>
              <button className="st-themecard__pic" onClick={() => onUse(p.id)} aria-label={tl('{name} temasını kullan', { name: p.name })}>
                {type === 'theme' ? (theme ? <ThemeScene theme={theme} /> : <span className="pv" />) : <PackStrip name={p.name} />}
              </button>
              <div className="st-themecard__title">
                <b>{p.name}</b>
                {active && <span className="st-badge"><Icon name="check" size={11} />{tl('Kullanımda')}</span>}
              </div>
              <div className="st-badges">
                <span className="st-badge st-badge--plain">{p.builtin ? tl('Hazır') : p.author ?? tl('Bilinmeyen yazar')}</span>
                {p.hasDesk && <span className="st-badge"><Icon name="desk" size={11} />{tl('Raflı')}</span>}
                {type === 'theme' && p.hasWallpaper && <span className="st-badge"><Icon name="image" size={11} />{liveName(theme?.wallpaper?.live) ?? tl('Arka plan')}</span>}
              </div>
              <div className="st-themecard__actions">
                <button className="st-btn" onClick={() => onUse(p.id)} disabled={active}>{active ? tl('Seçili') : tl('Kullan')}</button>
                <button className="st-btn" onClick={() => act(() => invoke('packs:export', p.id), tl('Dışa aktarıldı'))}><Icon name="upload" size={14} />{tl('Dışa aktar')}</button>
                {!p.builtin && <button className="st-btn st-btn--danger" aria-label={tl('Sil')} onClick={() => invoke('packs:remove', p.id).then(onChanged)}><Icon name="trash" size={14} /></button>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="st-row-inline"><button className="st-btn st-btn--accent" onClick={() => act(() => invoke('packs:import'), tl('İçe aktarıldı'))}><Icon name="download" size={15} />{tl('Paket içe aktar (.flypack)')}</button></div>
      {message && <Message text={message.text} error={message.error} />}
    </>
  )
}
