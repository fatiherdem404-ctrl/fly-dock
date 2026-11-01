// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/icons'
import { CustomGlyph, parseGlyph } from '@/studio/custom'
import type { Design } from '@/studio/render'
import { Message, Segmented } from './ui'

import { t } from '../i18n'
/** What a card uses for its picture: a Lucide glyph by name, or ready markup (another library, or pasted SVG). `null` means the key's own default. */
export type GlyphChoice = { lucide: string } | { custom: CustomGlyph } | null

type LibId = 'lucide' | 'tabler' | 'fa' | 'brands'

/** The icon libraries the picker can browse; each loads on first use. `filled` glyphs are solid shapes, the others are strokes. */
const LIBS: Record<LibId, { label: string; filled: boolean; hint: string; load: () => Promise<Record<string, string>> }> = {
  lucide: { label: 'Lucide', filled: false, hint: 'trash, mail, camera', load: () => import('@/studio/lucide.generated').then((m) => m.LUCIDE) },
  tabler: { label: 'Tabler', filled: false, hint: 'brand-github, device-tv', load: () => import('@/studio/libs/tabler.generated').then((m) => m.GLYPHS) },
  fa: { label: 'Font Awesome', filled: true, hint: 'house, music, gear', load: () => import('@/studio/libs/fa-solid.generated').then((m) => m.GLYPHS) },
  brands: { label: t('Marka logoları'), filled: true, hint: 'whatsapp, spotify, chrome', load: () => import('@/studio/libs/fa-brands.generated').then((m) => m.GLYPHS) },
}

const MAX_SHOWN = 240
const svgOf = (art: string, filled: boolean) =>
  `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${art}</svg>`

const STYLE_FIELDS: [keyof Design, string][] = [['c1', t('Kart rengi')], ['c2', t('Kartın ikinci rengi')], ['g1', t('Çizgi rengi')], ['g2', t('Çizginin ikinci rengi')]]

/** Pick another picture for one card: from a library, or by pasting SVG code. The colours of just this card can be set here too. */
export function GlyphPicker({ title, current, design, style, onStyle, onPick, onClose }: { title: string; current: GlyphChoice; design: Design; style: Partial<Design>; onStyle: (s: Partial<Design>) => void; onPick: (g: GlyphChoice) => void; onClose: () => void }) {
  const [tab, setTab] = useState<LibId | 'svg'>('lucide')
  const [query, setQuery] = useState('')
  const [libs, setLibs] = useState<Partial<Record<LibId, Record<string, string>>>>({})
  const [code, setCode] = useState('')
  const [colors, setColors] = useState(false)
  useEffect(() => {
    if (tab === 'svg' || libs[tab]) return
    let live = true
    LIBS[tab].load().then((data) => live && setLibs((cur) => ({ ...cur, [tab]: data })))
    return () => {
      live = false
    }
  }, [tab, libs])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lib = tab === 'svg' ? null : libs[tab] ?? null
  const found = useMemo(() => {
    if (!lib) return []
    const q = query.trim().toLowerCase().replace(/\s+/g, '-')
    return Object.keys(lib).filter((n) => !q || n.includes(q)).slice(0, MAX_SHOWN)
  }, [lib, query])
  const parsed = useMemo(() => (code.trim() ? parseGlyph(code, colors) : null), [code, colors])

  const pick = (name: string) => {
    if (tab === 'svg' || !lib) return
    onPick(tab === 'lucide' ? { lucide: name } : { custom: { art: lib[name], filled: LIBS[tab].filled } })
  }

  return createPortal(
    <div className="wl-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wl-dialog gp" role="dialog" aria-modal="true" aria-label={t('Simge seç')}>
        <header>
          <h3>“{title}{t('” için simge seç')}</h3>
          <button className="wl-tool" onClick={onClose} aria-label={t('Kapat')}><Icon name="close" size={16} /></button>
        </header>
        <div className="gp__body">
          <div className="gp__style">
            <b>{t('Yalnızca bu simge için renkler')}</b>
            {STYLE_FIELDS.map(([key, label]) => (
              <label key={key} className={style[key] ? 'is-set' : ''}>
                <input type="color" value={String(style[key] ?? design[key]).slice(0, 7)} onChange={(e) => onStyle({ ...style, [key]: e.target.value })} />
                <span>{label}</span>
              </label>
            ))}
            <button className="st-btn" onClick={() => onStyle({})} disabled={Object.keys(style).length === 0}>{t('Renkleri sıfırla')}</button>
          </div>
          <div className="gp__bar">
            <Segmented value={tab} onChange={(t) => { setTab(t); setQuery('') }} options={[...(Object.entries(LIBS).map(([id, l]) => [id, l.label]) as [LibId, string][]), ['svg', t('SVG kodu')]]} />
            {tab !== 'svg' && <input className="st-input" autoFocus placeholder={lib ? t('{length} simge içinde ara (örn. {hint})', { length: Object.keys(lib).length, hint: LIBS[tab].hint }) : t('Yükleniyor…')} value={query} onChange={(e) => setQuery(e.target.value)} />}
          </div>
          {tab !== 'svg' ? (
            <div className="gp__grid">
              {found.map((n) => (
                <button key={n} title={n} className={current && 'lucide' in current && tab === 'lucide' && current.lucide === n ? 'is-on' : ''} onClick={() => pick(n)}>
                  <span dangerouslySetInnerHTML={{ __html: svgOf(lib![n], LIBS[tab].filled) }} />
                  <small>{n}</small>
                </button>
              ))}
              {lib && found.length === 0 && <p className="st-prose">{t('Bu ada uyan simge yok. İngilizce ara: “folder”, “music”, “heart”…')}</p>}
            </div>
          ) : (
            <div className="gp__svg">
              <textarea className="wl-code" spellCheck={false} value={code} placeholder={'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>'} onChange={(e) => setCode(e.target.value)} />
              <div className="gp__side">
                <div className="gp__preview">{parsed && !('error' in parsed) ? <span dangerouslySetInnerHTML={{ __html: parsed.colored ? `<svg viewBox="0 0 24 24">${parsed.art}</svg>` : svgOf(parsed.art, parsed.filled) }} /> : <small>{t('Önizleme')}</small>}</div>
                {parsed && 'error' in parsed && <Message error text={parsed.error} />}
                <label className="st-check"><input type="checkbox" checked={colors} onChange={(e) => setColors(e.target.checked)} />{t('Renkleri koru (marka logosu için)')}</label>
                <p className="st-prose">{t('Başka bir kütüphaneden (Heroicons, Phosphor, Bootstrap…) kopyaladığın SVG kodunu yapıştır. Yalnızca çizim şekilleri alınır; renkleri stüdyo kendi verir.')}</p>
                <button className="st-btn st-btn--accent" disabled={!parsed || 'error' in parsed} onClick={() => parsed && !('error' in parsed) && onPick({ custom: parsed })}>{t('Bu simgeyi kullan')}</button>
              </div>
            </div>
          )}
        </div>
        <footer>
          <small className="gp__credit">{t('Lucide (ISC), Tabler (MIT), Font Awesome Free (CC BY 4.0)')}</small>
          <span className="wl-spacer" />
          <button className="st-btn" onClick={() => onPick(null)} disabled={!current}>{t('Varsayılana dön')}</button>
          <button className="st-btn" onClick={onClose}>{t('Kapat')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
