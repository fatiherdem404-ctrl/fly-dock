// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import Shelf from '@/components/Shelf'
import { useTexture, forgetTexture } from '@/useTexture'
import { DESK_LABELS, DESK_PRESETS, DESK_RADII } from '@/desk'
import { DESK_STYLES, DockSettings, DeskStyle, TextureMode } from '@/shared/types'
import { Card, Pages, Row, Switch, Slider, Segmented, Choice, Message, Update } from '../ui'

import { t } from '../../i18n'
// ---- Desk ----

export const PATTERNED: DeskStyle[] = ['wood', 'birch', 'walnut', 'metal', 'marble', 'blackmarble', 'concrete', 'crystal', 'wall']

export function TextureCard({ s, set }: { s: DockSettings; set: Update; tab?: string }) {
  const texture = useTexture(s.deskStyle === 'custom' ? s.deskTexFile : '')
  const [message, setMessage] = useState<string | null>(null)
  if (s.deskStyle !== 'custom' && !PATTERNED.includes(s.deskStyle)) return null

  if (s.deskStyle !== 'custom') {
    return (
      <Card title={t('Doku boyutu')} hint={t('Desenin raf üstündeki büyüklüğü. Küçültürsen damarlar, tuğlalar ve çizgiler sıklaşır.')}>
        <Row label={t('Desen boyutu')} hint={t('%100 = tasarlanan boyut')}><Slider value={s.deskTexScale} min={20} max={300} unit="%" onChange={(deskTexScale) => set({ deskTexScale })} /></Row>
        <Row label={t('Varsayılana dön')}><button className="st-btn" onClick={() => set({ deskTexScale: DESK_PRESETS[s.deskStyle].scale })}><Icon name="refresh" size={15} />{t('Sıfırla')}</button></Row>
      </Card>
    )
  }

  const pick = async () => {
    const result = await invoke('texture:pick')
    if (result.message === 'cancelled') return
    if (!result.ok || !result.file) return setMessage(result.message)
    if (s.deskTexFile && s.deskTexFile !== result.file) forgetTexture(s.deskTexFile)
    setMessage(null)
    set({ deskTexFile: result.file })
  }
  const remove = () => {
    if (s.deskTexFile) invoke('texture:remove', s.deskTexFile)
    forgetTexture(s.deskTexFile)
    set({ deskTexFile: '' })
  }
  return (
    <Card title={t('Özel doku')} hint={t('Kendi resmini raf yüzeyi yap. PNG, JPEG ya da WebP, en çok 4 MB. Resim uygulamanın kendi klasörüne kopyalanır; yedeğe de girer.')}>
      <div className="st-row-inline">
        <button className="st-btn st-btn--accent" onClick={pick}><Icon name="image" size={15} />{s.deskTexFile ? t('Başka resim seç…') : t('Resim seç…')}</button>
        {s.deskTexFile && <button className="st-btn st-btn--danger" onClick={remove}><Icon name="trash" size={15} />{t('Kaldır')}</button>}
        {texture && <img className="st-texthumb" src={texture.url} alt="" />}
      </div>
      {message && <Message text={message} error />}
      {!s.deskTexFile && <p className="st-prose">{t('Henüz resim seçilmedi; raf düz gri görünür.')}</p>}
      <Row label={t('Yerleşim')}><Segmented<TextureMode> value={s.deskTexMode} onChange={(deskTexMode) => set({ deskTexMode })} options={[['tile', t('Döşe (tekrarla)')], ['fit', t('Sığdır (tek parça)')]]} /></Row>
      <Row label={t('Boyut')} hint={texture ? t('Resim {w}×{h} px; döşemede bu boyut kaydırıcıyla çarpılır', { w: texture.w, h: texture.h }) : t('Döşemede resmin kendi boyutu çarpanı')}><Slider value={s.deskTexScale} min={10} max={400} unit="%" onChange={(deskTexScale) => set({ deskTexScale })} /></Row>
      {s.deskTexMode === 'tile' && (
        <>
          <Row label={t('Yatay kaydır')}><Slider value={s.deskTexX} min={-300} max={300} unit=" px" onChange={(deskTexX) => set({ deskTexX })} /></Row>
          <Row label={t('Dikey kaydır')}><Slider value={s.deskTexY} min={-300} max={300} unit=" px" onChange={(deskTexY) => set({ deskTexY })} /></Row>
        </>
      )}
      <Row label={t('Döndür')}><Slider value={s.deskTexRotate} min={0} max={360} unit="°" onChange={(deskTexRotate) => set({ deskTexRotate })} /></Row>
      <Row label={t('Sıfırla')}><button className="st-btn" onClick={() => set({ deskTexScale: 100, deskTexX: 0, deskTexY: 0, deskTexRotate: 0, deskTexMode: 'tile' })}><Icon name="refresh" size={15} />{t('Boyut ve konumu sıfırla')}</button></Row>
    </Card>
  )
}

export const RADIUS_KEYS: ['deskRadTL' | 'deskRadTR' | 'deskRadBL' | 'deskRadBR', string][] = [['deskRadTL', t('Sol üst')], ['deskRadTR', t('Sağ üst')], ['deskRadBL', t('Sol alt')], ['deskRadBR', t('Sağ alt')]]
export const allRadii = (v: number) => ({ deskRadTL: v, deskRadTR: v, deskRadBL: v, deskRadBR: v })

export const PAD_KEYS: ['deskPadTop' | 'deskPadBottom' | 'deskPadLeft' | 'deskPadRight', string][] = [['deskPadTop', t('Üst')], ['deskPadBottom', t('Alt')], ['deskPadLeft', t('Sol')], ['deskPadRight', t('Sağ')]]

/** A little shelf with three icons standing on it; `length` is the shelf's width in px, `label` a tooltip over the middle icon. */
export function DeskCard({ style, length = 116, label }: { style: DeskStyle; length?: number; label?: string }) {
  const preset = DESK_PRESETS[style]
  return (
    <div className={`st-desk dock dock--desk-${style} dock--bottom`} style={{ '--desk-depth': `${DESK_PRESETS[style].depth}px` } as React.CSSProperties}>
      <div style={{ position: 'absolute', left: '50%', width: length, marginLeft: -length / 2, bottom: 5, height: 34 }}>
        {style === 'none' ? null : preset.depth > 0 ? (
          <Shelf length={length} thickness={34} edge={Math.round(preset.edge * 0.5)} depth={preset.depth * 0.5} side="bottom" radii={{ tl: DESK_RADII[style][0], tr: DESK_RADII[style][0], bl: DESK_RADII[style][1], br: DESK_RADII[style][1] }} opacity={1} />
        ) : (
          <div className="dock__desk" style={{ position: 'absolute', inset: '8px 0 0 0', borderRadius: 999 }}><span className="dock__desk-sheen" /></div>
        )}
      </div>

      <div className="st-desk__row" style={{ bottom: style === 'none' ? 18 : 14, left: '50%', right: 'auto', width: length, marginLeft: -length / 2 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="st-desk__slot" style={{ transform: i === 1 ? 'translateY(-4px)' : undefined }}>
            {i === 1 && label && <em className="st-desk__tip">{label}</em>}
            <i className="st-desk__icon" />
          </span>
        ))}
      </div>
    </div>
  )
}

/** Right under the style list: a custom desk needs a picture, so ask for it where the style was chosen. */
export function CustomTexturePrompt({ s, set }: { s: DockSettings; set: Update }) {
  const texture = useTexture(s.deskStyle === 'custom' ? s.deskTexFile : '')
  const [message, setMessage] = useState<string | null>(null)
  const pick = async () => {
    const result = await invoke('texture:pick')
    if (result.message === 'cancelled') return
    if (!result.ok || !result.file) return setMessage(result.message)
    if (s.deskTexFile && s.deskTexFile !== result.file) forgetTexture(s.deskTexFile)
    setMessage(null)
    set({ deskTexFile: result.file })
  }
  return (
    <div className="st-custom-pick">
      <button className="st-btn st-btn--accent" onClick={pick}><Icon name="image" size={15} />{s.deskTexFile ? t('Başka resim seç…') : t('Raf için resim seç…')}</button>
      {texture && <img className="st-texthumb" src={texture.url} alt="" />}
      <span className="st-muted">{s.deskTexFile ? t('Boyut, kaydırma ve dönüş için Doku sekmesine bak.') : t('Özel doku bir resim ister; seçene kadar raf düz gri görünür.')}</span>
      {message && <Message text={message} error />}
    </div>
  )
}

export function DeskTab({ s, set }: { s: DockSettings; set: Update }) {
  return (
    <Pages id="desk">
      <Card icon="desk" tab={t('Raf')} title={t('Raf stili')} hint={t('Simgelerin üzerinde durduğu zemin. Seçince o stilin en iyi derinliği ve saydamlığı uygulanır, sonra ayrıca değiştirebilirsin.')}>
        <Choice<DeskStyle>
          value={s.deskStyle}
          onChange={(deskStyle) => set({ deskStyle, deskDepth: DESK_PRESETS[deskStyle].depth, deskOpacity: DESK_PRESETS[deskStyle].opacity, deskEdge: DESK_PRESETS[deskStyle].edge, deskTexScale: DESK_PRESETS[deskStyle].scale, deskRadTL: DESK_RADII[deskStyle][0], deskRadTR: DESK_RADII[deskStyle][0], deskRadBL: DESK_RADII[deskStyle][1], deskRadBR: DESK_RADII[deskStyle][1] })}
          options={DESK_STYLES.map((d): [DeskStyle, string] => [d, DESK_LABELS[d]])}
        >
          {(id) => <DeskCard style={id} />}
        </Choice>
        {s.deskStyle === 'custom' && <CustomTexturePrompt s={s} set={set} />}
      </Card>
      <Card icon="theme" tab={t('Raf')} title={t('Görünüm')}>
        <Row label={t('Renk tonu')} hint={t('Boşsa temanın rengi kullanılır')}>
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.deskColor) ? s.deskColor : '#4da3ff'} onChange={(e) => set({ deskColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ deskColor: '' })} disabled={!s.deskColor}>{t('Temaya dön')}</button>
          </div>
        </Row>
        <Row label={t('Saydamlık')}><Slider value={s.deskOpacity} min={0.2} max={1} step={0.05} format={(v) => `%${Math.round(v * 100)}`} onChange={(deskOpacity) => set({ deskOpacity })} /></Row>
        <Row label={t('Alt kalınlığı')} hint={t('Rafın ekran kenarına bakan ön yüzü; 3B rafların altındaki kalınlık')}><Slider value={s.deskEdge} min={0} max={30} unit=" px" onChange={(deskEdge) => set({ deskEdge })} /></Row>
        <Row label={t('3B derinlik')} hint={t('0 = düz; yükseldikçe raf perspektifle yatar')}><Slider value={s.deskDepth} min={0} max={60} unit=" px" onChange={(deskDepth) => set({ deskDepth })} /></Row>
        <Row label={t('Raf simgelerle büyüsün')} hint={t('Kapalıyken simgeler raftan taşar (macOS gibi)')}><Switch label={t('Raf büyümesi')} value={s.shelfGrows} onChange={(shelfGrows) => set({ shelfGrows })} /></Row>
      </Card>
      {(s.deskStyle === 'custom' || PATTERNED.includes(s.deskStyle)) && <TextureCard tab={t('Doku')} s={s} set={set} />}
      <Card icon="maximize" tab={t('Şekil')} title={t('Köşe yuvarlaklığı')} hint={t('Rafın dört köşesi ayrı ayrı. Alt köşeler yuvarlanınca ön yüzün kalınlığı da o köşeyle birlikte yuvarlanır.')}>
        <Row label={t('Hazır şekiller')}>
          <div className="st-row-inline" style={{ margin: 0 }}>
            <button className="st-btn" onClick={() => set(allRadii(60))}>{t('Hap')}</button>
            <button className="st-btn" onClick={() => set(allRadii(14))}>{t('Yuvarlak')}</button>
            <button className="st-btn" onClick={() => set(allRadii(2))}>{t('Kare')}</button>
          </div>
        </Row>
        <Row label={t('Hepsini bağla')} hint={t('Bir kaydırıcıyı oynatınca dördü birlikte değişir')}><Switch label={t('Köşeleri bağla')} value={s.deskRadLinked} onChange={(deskRadLinked) => set(deskRadLinked ? { deskRadLinked, ...allRadii(s.deskRadTL) } : { deskRadLinked })} /></Row>
        {RADIUS_KEYS.map(([key, label]) => (
          <Row key={key} label={label}>
            <Slider value={s[key]} min={0} max={60} unit=" px" onChange={(v) => set(s.deskRadLinked ? allRadii(v) : { [key]: v })} />
          </Row>
        ))}
      </Card>
      <Card icon="items" tab={t('Şekil')} title={t('Raf boşlukları')} hint={t('Rafın kenarları ile simgeler arasındaki boşluk, ekranın dört yanı için ayrı. Pencere bu boşluklara göre kendiliğinden büyür.')}>
        <Row label={t('Hepsini bağla')} hint={t('Bir kaydırıcıyı oynatınca dördü birlikte değişir')}><Switch label={t('Hepsini bağla')} value={s.deskPadLinked} onChange={(deskPadLinked) => set(deskPadLinked ? { deskPadLinked, deskPadTop: s.deskPadTop, deskPadBottom: s.deskPadTop, deskPadLeft: s.deskPadTop, deskPadRight: s.deskPadTop } : { deskPadLinked })} /></Row>
        {PAD_KEYS.map(([key, label]) => (
          <Row key={key} label={label}>
            <Slider value={s[key]} min={0} max={48} unit=" px" onChange={(v) => set(s.deskPadLinked ? { deskPadTop: v, deskPadBottom: v, deskPadLeft: v, deskPadRight: v } : { [key]: v })} />
          </Row>
        ))}
        <Row label={t('Varsayılana dön')}><button className="st-btn" onClick={() => set({ deskPadTop: 10, deskPadBottom: 10, deskPadLeft: 16, deskPadRight: 16, deskPadLinked: false })}><Icon name="refresh" size={15} />{t('Sıfırla')}</button></Row>
      </Card>
    </Pages>
  )
}
