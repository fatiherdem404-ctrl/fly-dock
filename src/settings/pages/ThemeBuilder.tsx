// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import { PackInfo, ThemeVars } from '@/shared/types'
import { Card, Row, Switch, Slider, Select, Segmented, Message } from '../ui'

import { t as tl } from '../../i18n'
// ---- Theme builder ----

/** "#rrggbb" plus alpha 0..1 from any hex / rgb() / rgba() colour; falls back to the given colour when it cannot be read. */
export function readColor(css: string, fallback = '#808080'): { hex: string; alpha: number } {
  const c = css.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1]
    return { hex: '#' + h.toLowerCase(), alpha: 1 }
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(c)
  if (rgb) {
    const to = (n: string) => Math.min(255, Number(n)).toString(16).padStart(2, '0')
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])
    return { hex: '#' + to(rgb[1]) + to(rgb[2]) + to(rgb[3]), alpha: Math.min(1, Math.max(0, a)) }
  }
  return { hex: fallback, alpha: 1 }
}

export function writeColor(hex: string, alpha: number): string {
  if (alpha >= 0.995) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 100) / 100})`
}

export const SHADOWS: [string, string][] = [['none', tl('Yok')], ['soft', tl('Hafif')], ['strong', tl('Güçlü')], ['glow', tl('Parlama')]]
export const shadowCss = (kind: string, accent: string) =>
  kind === 'none' ? '0 0 0 rgba(0, 0, 0, 0)' : kind === 'soft' ? '0 6px 16px rgba(0, 0, 0, 0.25)' : kind === 'glow' ? `0 0 26px ${accent}` : '0 14px 34px rgba(0, 0, 0, 0.55)'
export const FONTS: [string, string][] = [
  ["'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif", tl('Segoe UI (varsayılan)')],
  ["'Bahnschrift', 'Segoe UI', sans-serif", tl('Bahnschrift')],
  ["'Trebuchet MS', 'Segoe UI', sans-serif", 'Trebuchet'],
  [tl('Georgia, \'Times New Roman\', serif'), tl('Georgia (serif)')],
  [tl('Consolas, \'Cascadia Mono\', monospace'), tl('Consolas (mono)')],
]

export const COLOR_FIELDS: [keyof ThemeVars, string, string, boolean][] = [
  ['surface', tl('Dock zemini'), tl('Simgelerin arkasındaki cam ya da düz renk'), true],
  ['surfaceBorder', tl('Dock kenarlığı'), tl('İnce çerçeve'), true],
  ['accent', tl('Vurgu rengi'), tl('Düğmeler, seçili öğeler, ayar penceresi'), false],
  ['indicator', tl('Çalışan uygulama işareti'), tl('Simgenin altındaki nokta'), false],
  ['tooltipBg', tl('Etiket ve menü zemini'), tl('Sağ tık menüsü, simge etiketi, klasör penceresi'), true],
  ['tooltipText', tl('Etiket ve menü yazısı'), '', false],
  ['panelBg', tl('Ayar penceresi zemini'), '', false],
  ['panelText', tl('Ayar penceresi yazısı'), '', false],
  ['panelMuted', tl('Soluk yazı'), tl('Açıklamalar ve ikincil metin'), false],
]

export function ThemeBuilder({ packs, onMade }: { tab?: string; packs: PackInfo[]; onMade: (id: string) => void }) {
  const themes = packs.filter((p) => p.type === 'theme')
  const [base, setBase] = useState('glass-dark')
  const [vars, setVars] = useState<ThemeVars | null>(null)
  const [shadowKind, setShadowKind] = useState('strong')
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [withDesk, setWithDesk] = useState(true)
  const [withWallpaper, setWithWallpaper] = useState(true)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  useEffect(() => {
    invoke('themes:get', base).then((t) => t && setVars(t.vars))
  }, [base])
  if (!vars) return null
  const put = (partial: Partial<ThemeVars>) => setVars((cur) => (cur ? { ...cur, ...partial } : cur))
  const setShadow = (kind: string, accent = vars.accent) => {
    setShadowKind(kind)
    put({ shadow: shadowCss(kind, accent) })
  }
  const create = async () => {
    const r = await invoke('themes:create', name, author, vars, withDesk, withWallpaper)
    setMessage({ text: r.ok ? tl('"{message}" oluşturuldu ve kullanılıyor. Dışa aktarmak için Temalar sekmesindeki listeyi kullan.', { message: r.message }) : r.message, error: !r.ok })
    if (r.ok && r.pack) onMade(r.pack.id)
  }
  const css = {
    '--surface': vars.surface, '--surface-border': vars.surfaceBorder, '--surface-blur': `${vars.surfaceBlur}px`, '--radius': `${vars.radius}px`, '--shadow': vars.shadow,
    '--indicator': vars.indicator, '--tooltip-bg': vars.tooltipBg, '--tooltip-text': vars.tooltipText, '--accent': vars.accent,
    '--panel-bg': vars.panelBg, '--panel-text': vars.panelText, '--panel-muted': vars.panelMuted, '--font': vars.fontFamily,
  } as React.CSSProperties
  return (
    <Card title={tl('Tema oluştur')} hint={tl('Bir temayı başlangıç noktası al, renkleri ve camı değiştir; solda canlı görürsün. Bitince adını yazıp oluştur: tema listene eklenir, oradan .flypack olarak dışa aktarabilirsin.')}>
      <Row label={tl('Başlangıç teması')}><Select<string> value={base} onChange={setBase} options={themes.map((t): [string, string] => [t.id, t.name])} /></Row>
      <div className="st-tb">
        <div className="st-tb__preview" style={css}>
          <div className="st-tb__wall">
            <div className="st-tb__dock">
              {['#ff7a59', '#4da3ff', '#8be28b', '#f5c542'].map((c, i) => <i key={c} style={{ background: `linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 55%, #000))` }}>{i === 1 && <b />}</i>)}
            </div>
            <div className="st-tb__tip">{tl('Etiket')}</div>
          </div>
          <div className="st-tb__panel">
            <strong>{tl('Ayar penceresi')}</strong>
            <span>{tl('Soluk açıklama yazısı')}</span>
            <em>{tl('Düğme')}</em>
          </div>
          <div className="st-tb__menu"><span>{tl('Aç')}</span><span className="on">{tl('Seçili')}</span><span>{tl('Ayarlar')}</span></div>
        </div>
        <div className="st-tb__fields">
          {COLOR_FIELDS.map(([key, label, hint, alpha]) => {
            const c = readColor(String(vars[key]))
            return (
              <Row key={key} label={label} hint={hint || undefined}>
                <div className="st-color">
                  <input type="color" value={c.hex} onChange={(e) => { put({ [key]: writeColor(e.target.value, c.alpha) }); if (key === 'accent' && shadowKind === 'glow') setShadow('glow', e.target.value) }} />
                  {alpha && <input className="st-tb__alpha" type="range" min={0} max={100} value={Math.round(c.alpha * 100)} title={tl('Saydamlık')} onChange={(e) => put({ [key]: writeColor(c.hex, Number(e.target.value) / 100) })} />}
                </div>
              </Row>
            )
          })}
          <Row label={tl('Cam bulanıklığı')} hint={tl('0 = düz renk')}><Slider value={vars.surfaceBlur} min={0} max={60} unit=" px" onChange={(surfaceBlur) => put({ surfaceBlur })} /></Row>
          <Row label={tl('Köşe yuvarlaklığı')}><Slider value={vars.radius} min={0} max={40} unit=" px" onChange={(radius) => put({ radius })} /></Row>
          <Row label={tl('Gölge')}><Segmented<string> value={shadowKind} onChange={(k) => setShadow(k)} options={SHADOWS} /></Row>
          <Row label={tl('Yazı tipi')}><Select<string> value={vars.fontFamily} onChange={(fontFamily) => put({ fontFamily })} options={FONTS.some(([v]) => v === vars.fontFamily) ? FONTS : [[vars.fontFamily, tl('Özel')], ...FONTS]} /></Row>
        </div>
      </div>
      <Row label={tl('Şu anki rafı da ekle')} hint={tl('Rafın stili, derinliği, köşeleri ve özel dokusu temayla birlikte kaydedilir; tema seçilince raf da değişir')}><Switch label={tl('Rafı da ekle')} value={withDesk} onChange={setWithDesk} /></Row>
      <Row label={tl('Duvar kâğıdını da ekle')} hint={tl('Seçili canlı arka plan, resim ya da video (en çok 8 MB) temayla birlikte kaydedilir')}><Switch label={tl('Duvar kâğıdını da ekle')} value={withWallpaper} onChange={setWithWallpaper} /></Row>
      <Row label={tl('Tema adı')}><input className="st-input" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={tl('Benim temam')} /></Row>
      <Row label={tl('Yapımcı')} hint={tl('İstersen boş bırak')}><input className="st-input" type="text" value={author} maxLength={60} onChange={(e) => setAuthor(e.target.value)} /></Row>
      <div className="st-row-inline"><button className="st-btn st-btn--accent" disabled={!name.trim()} onClick={create}><Icon name="download" size={15} />{tl('Temayı oluştur ve kullan')}</button></div>
      {message && <Message text={message.text} error={message.error} />}
    </Card>
  )
}
