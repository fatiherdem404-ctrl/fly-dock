// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useRemote } from '@/api'
import Icon from '@/icons'
import { separatorKind } from '@/desk'
import { DockLayer, DockSettings, SeparatorStyle, FalloffCurve, LabelMode } from '@/shared/types'
import { SepPreview, LabelPreview, LayerPreview, FalloffPreview } from '../previews'
import { Card, Cards, Pages, Row, Switch, Slider, Select, Update } from '../ui'

import { t } from '../../i18n'
// ---- Dock ----

export const SIDES: [DockSettings['position'], string][] = [['top', t('Üst')], ['left', t('Sol')], ['right', t('Sağ')], ['bottom', t('Alt')]]

export function PositionPicker({ value, onChange }: { value: DockSettings['position']; onChange: (p: DockSettings['position']) => void }) {
  return (
    <div className="st-sides">
      {SIDES.map(([side, label]) => (
        <button key={side} className={`st-side st-side--${side}`} aria-pressed={value === side} onClick={() => onChange(side)}>
          <span className="st-side__screen"><i /></span>
          <b>{label}</b>
        </button>
      ))}
    </div>
  )
}

export function DockTab({ s, set }: { s: DockSettings; set: Update }) {
  const [displays] = useRemote('displays:list', [])
  const monitors: [string, string][] = [
    ['primary', t('Ana monitör')],
    ['all', t('Tüm monitörler (her birinde bir dock)')],
    ...(displays ?? []).map((d): [string, string] => [String(d.id), t('Monitör {label}{v1}', { label: d.label, v1: d.primary ? ` (${t('ana')})` : '' })]),
  ]
  const current = typeof s.monitor === 'number' ? String(s.monitor) : s.monitor
  const horizontal = s.position === 'bottom' || s.position === 'top'
  return (
    <Pages id="dock">
      <Card icon="location" tab={t('Konum')} title={t('Konum')} hint={t('Dock’u ekranın hangi kenarına koyacağını, kenara uzaklığını ve kenar boyunca yerini seç. Değişiklikler anında dock’a uygulanır.')}>
        <PositionPicker value={s.position} onChange={(position) => set({ position })} />
        <Row icon="arrowDown" label={t('Kenardan uzaklık')} hint={t('Dock ile ekran kenarı arasındaki boşluk')}>
          <Slider value={s.edgeOffset} min={0} max={160} unit=" px" onChange={(edgeOffset) => set({ edgeOffset })} />
        </Row>
        <Row icon="arrowRight" label={horizontal ? t('Yatay yer') : t('Dikey yer')} hint={t('Kenar boyunca kaydır: baş, orta ya da son')}>
          <Slider value={s.alignment} min={0} max={100} format={(v) => (v === 50 ? t('orta') : `%${v}`)} onChange={(alignment) => set({ alignment })} />
        </Row>
        <Row label={t('Konumu sıfırla')}><button className="st-btn" onClick={() => set({ edgeOffset: 6, alignment: 50 })}><Icon name="refresh" size={15} />{t('Ortala')}</button></Row>
        <Row icon="monitor" label={t('Monitör')} hint={t('Birden çok monitörde her birine ayrı dock konabilir')}>
          <Select value={current} options={monitors} onChange={(v) => set({ monitor: v === 'primary' || v === 'all' ? v : Number(v) })} />
        </Row>
      </Card>

      <Card icon="dock" tab={t('Simgeler')} title={t('Simgeler ve büyüme')} hint={t('İkonun kendi boyutu ile fareyle büyümesi ayrı ayarlardır.')}>
        <Row icon="maximize" label={t('Simge boyutu')}><Slider value={s.iconSize} min={24} max={96} unit=" px" onChange={(iconSize) => set({ iconSize })} /></Row>
        <Row label={t('Simge aralığı')}><Slider value={s.iconSpacing} min={0} max={32} unit=" px" onChange={(iconSpacing) => set({ iconSpacing })} /></Row>
        <Row icon="search" label={t('Fareyle büyütme')}><Switch label={t('Büyütme')} value={s.magnification} onChange={(magnification) => set({ magnification })} /></Row>
        {s.magnification && (
          <>
            <Row label={t('En büyük boyut')} hint={t('Simge boyutunun katı olarak')}><Slider value={s.maxScale} min={1} max={3} step={0.05} format={(v) => `${v.toFixed(2)}× (${Math.round(v * s.iconSize)} px)`} onChange={(maxScale) => set({ maxScale })} /></Row>
            <Row label={t('Yayılma')} hint={t('Kaç komşu simge etkilenir')}><Slider value={s.magnificationRadius} min={0.5} max={5} step={0.5} format={(v) => `${v} ${t('simge')}`} onChange={(magnificationRadius) => set({ magnificationRadius })} /></Row>
            <Row icon="motion" label={t('Etki eğrisi')} hint={t('Büyümenin komşulara nasıl yayıldığı')} />
            <Cards<FalloffCurve> size="s" value={s.falloff} onChange={(falloff) => set({ falloff })} options={([['cosine', t('Yumuşak')], ['gaussian', t('Çan')], ['linear', t('Doğrusal')], ['sharp', t('Sivri')]] as [FalloffCurve, string][]).map(([id, label]) => ({ id, label, preview: <FalloffPreview curve={id} /> }))} />
          </>
        )}
      </Card>

      <Card icon="minus" tab={t('Ayraç')} title={t('Ayraç')} hint={t('Dock’taki gruplar arasındaki çizgi. Otomatik seçeneği rafa ve temaya göre okunaklı olanı seçer: ahşap ve metalde oyuk, neonda ışıklı çubuk, camda net çizgi.')}>
        <Cards<SeparatorStyle> size="s" value={s.separatorStyle} onChange={(separatorStyle) => set({ separatorStyle })} options={([['auto', t('Otomatik')], ['line', t('Çizgi')], ['groove', t('Oyuk')], ['dots', t('Noktalı')], ['glow', t('Işıklı')], ['none', t('Yok')]] as [SeparatorStyle, string][]).map(([id, label]) => ({ id, label, preview: <SepPreview kind={id === 'auto' ? separatorKind({ ...s, separatorStyle: 'auto' }) : id} /> }))} />
      </Card>

      <Card icon="settings" tab={t('Ayraç')} title={t('Ayraç ayrıntıları')} hint={t('Seçtiğin görünümün üstüne uygulanır. Boş bıraktığın ayar rafa ve temaya göre otomatik kalır.')}>
        <Row label={t('Kalınlık')} hint={t('0 = görünümün kendi kalınlığı')}><Slider value={s.sepThickness} min={0} max={16} format={(v) => (v === 0 ? t('otomatik') : `${v} px`)} onChange={(sepThickness) => set({ sepThickness })} /></Row>
        <Row label={t('Yükseklik')} hint={t('Simge boyutunun yüzdesi')}><Slider value={s.sepHeight} min={20} max={100} unit="%" onChange={(sepHeight) => set({ sepHeight })} /></Row>
        <Row label={t('Köşe yuvarlaklığı')}><Slider value={s.sepRadius} min={0} max={8} unit=" px" onChange={(sepRadius) => set({ sepRadius })} /></Row>
        <Row label={t('Renk')} hint={t('Boşsa otomatik')}>
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepColor) ? s.sepColor : '#cccccc'} onChange={(e) => set({ sepColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepColor: '' })} disabled={!s.sepColor}>{t('Otomatik')}</button>
          </div>
        </Row>
        <Row label={t('Sol kenar')} hint={t('0 = kenarlık yok')}><Slider value={s.sepBorderL} min={0} max={6} unit=" px" onChange={(sepBorderL) => set({ sepBorderL })} /></Row>
        <Row label={t('Sol kenar rengi')}>
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepBorderLColor) ? s.sepBorderLColor : '#ffffff'} onChange={(e) => set({ sepBorderLColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepBorderLColor: '' })} disabled={!s.sepBorderLColor}>{t('Otomatik')}</button>
          </div>
        </Row>
        <Row label={t('Sağ kenar')}><Slider value={s.sepBorderR} min={0} max={6} unit=" px" onChange={(sepBorderR) => set({ sepBorderR })} /></Row>
        <Row label={t('Sağ kenar rengi')}>
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepBorderRColor) ? s.sepBorderRColor : '#000000'} onChange={(e) => set({ sepBorderRColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepBorderRColor: '' })} disabled={!s.sepBorderRColor}>{t('Otomatik')}</button>
          </div>
        </Row>
        <Row label={t('Ayracı sıfırla')}><button className="st-btn" onClick={() => set({ separatorStyle: 'auto', sepThickness: 0, sepHeight: 70, sepColor: '', sepRadius: 2, sepBorderL: 0, sepBorderR: 0, sepBorderLColor: '', sepBorderRColor: '' })}><Icon name="refresh" size={15} />{t('Varsayılana dön')}</button></Row>
      </Card>

      <Card icon="list" tab={t('Etiketler')} title={t('Etiketler')} hint={t('Simgenin üstünde çıkan ad yazısı')}>
        <Cards<LabelMode> size="s" value={s.labelMode} onChange={(labelMode) => set({ labelMode })} options={([['hover', t('Üzerine gelince')], ['always', t('Hep görünsün')], ['never', t('Hiç')]] as [LabelMode, string][]).map(([id, label]) => ({ id, label, preview: <LabelPreview mode={id} /> }))} />
        {s.labelMode !== 'never' && (
          <>
            <Row label={t('Yazı boyutu')}><Slider value={s.labelSize} min={9} max={20} unit=" px" onChange={(labelSize) => set({ labelSize })} /></Row>
            <Row label={t('Yazı tipi')}><Select value={s.labelFont} onChange={(labelFont) => set({ labelFont })} options={[['', t('Tema yazı tipi')], ['Segoe UI', t('Segoe UI')], [t('Bahnschrift'), t('Bahnschrift')], [t('Consolas'), t('Consolas')], ['Georgia', t('Georgia')], ['Trebuchet MS', t('Trebuchet MS')]]} /></Row>
          </>
        )}
      </Card>

      <Card icon="settings" tab={t('Davranış')} title={t('Davranış')}>
        <Row icon="stack" label={t('Pencerelere göre konum')} hint={t('Diğer pencerelerle dock arasındaki sıra')} />
        <Cards<DockLayer> size="s" value={s.layer} onChange={(layer) => set({ layer })} options={[{ id: 'above', label: t('Üstte'), hint: t('Hep önde'), preview: <LayerPreview layer="above" /> }, { id: 'normal', label: t('Normal'), hint: t('Pencereler kapatabilir'), preview: <LayerPreview layer="normal" /> }, { id: 'below', label: t('Altta'), hint: t('Masaüstü gibi'), preview: <LayerPreview layer="below" /> }]} />
        <Row label={t('Çalışan programlar')} hint={t('Sabitlenmemiş açık programlar ayraçtan sonra görünür')}><Switch label={t('Çalışan programlar')} value={s.showRunningApps} onChange={(showRunningApps) => set({ showRunningApps })} /></Row>
        <Row label={t('Çalışma göstergesi')} hint={t('Açık programın altında ışık')}><Switch label={t('Gösterge')} value={s.showRunningIndicators} onChange={(showRunningIndicators) => set({ showRunningIndicators })} /></Row>
        <Row label={t('Çöp kutusu')}><Switch label={t('Çöp kutusu')} value={s.showTrash} onChange={(showTrash) => set({ showTrash })} /></Row>
        <Row label={t('Simgeleri kilitle')} hint={t('Sürükleyip sıralamayı ve kaldırmayı kapatır')}><Switch label={t('Kilitle')} value={s.lockItems} onChange={(lockItems) => set({ lockItems })} /></Row>
        <Row label={t('Otomatik gizle')} hint={t('İmleç ekran kenarına gidince dock belirir')}><Switch label={t('Otomatik gizle')} value={s.autoHide} onChange={(autoHide) => set({ autoHide })} /></Row>
        {s.autoHide && <Row label={t('Gizlenme gecikmesi')}><Slider value={s.autoHideDelayMs} min={0} max={3000} step={100} unit=" ms" onChange={(autoHideDelayMs) => set({ autoHideDelayMs })} /></Row>}
        <Row label={t('Tam ekranda gizle')} hint={t('Oyun ve video tam ekranken dock görünmez')}><Switch label={t('Tam ekranda gizle')} value={s.hideInFullscreen} onChange={(hideInFullscreen) => set({ hideInFullscreen })} /></Row>
      </Card>
    </Pages>
  )
}
