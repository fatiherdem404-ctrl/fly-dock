import { useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon, { IconName } from '@/icons'
import { WidgetInstance, WidgetType } from '@/shared/types'
import { DEFAULT_WIDGET_OPTIONS, WIDGET_STYLES, WIDGET_TYPES, WidgetStyle, widgetScale, widgetStyle } from '@/shared/widgets'
import { WidgetPreview } from '@/widgets/frame'
import { Card, Pages, Row, Segmented, Slider, Switch } from '../ui'

export const WIDGET_INFO: Record<WidgetType, { name: string; hint: string; icon: IconName }> = {
  clock: { name: 'Dijital saat', hint: 'Büyük rakamlı saat ve tarih', icon: 'clock' },
  analog: { name: 'Analog saat', hint: 'Akrep, yelkovan ve saniye çubuğu', icon: 'clock' },
  calendar: { name: 'Takvim', hint: 'Ay takvimi ya da büyük gün kartı', icon: 'desk' },
  weather: { name: 'Hava durumu', hint: 'Şehrin anlık sıcaklığı ve durumu', icon: 'network' },
  system: { name: 'Sistem', hint: 'İşlemci, bellek ve disk halkaları', icon: 'chip' },
  media: { name: 'Medya', hint: 'Çalan parça ve oynatma düğmeleri', icon: 'sound' },
  battery: { name: 'Pil', hint: 'Pil yüzdesi ve şarj durumu', icon: 'battery' },
  note: { name: 'Not', hint: 'Masaüstüne yapışan not kâğıdı', icon: 'edit' },
}
export const WIDGET_NAMES = Object.fromEntries(WIDGET_TYPES.map((t) => [t, WIDGET_INFO[t].name])) as Record<WidgetType, string>

const STYLE_INFO: Record<WidgetStyle, { name: string; hint: string }> = {
  glass: { name: 'Cam', hint: 'Dock gibi, temanın cam yüzeyi' },
  solid: { name: 'Düz', hint: 'Ayar penceresinin düz rengi' },
  accent: { name: 'Vurgu', hint: 'Temanın vurgu renginde' },
  minimal: { name: 'Çıplak', hint: 'Kart yok, yalnızca yazı' },
}

type Update = (id: string, options: Record<string, string | number | boolean>) => void

/** What can be changed on one widget, depending on its kind. */
function WidgetOptionsRows({ w, update }: { w: WidgetInstance; update: Update }) {
  const o = w.options
  const flag = (key: string, fallback = false) => (o[key] === undefined ? fallback : !!o[key])
  return (
    <>
      {w.type === 'clock' && (
        <>
          <Row icon="clock" label="Saniyeyi göster"><Switch label="Saniye" value={flag('seconds')} onChange={(v) => update(w.id, { seconds: v })} /></Row>
          <Row icon="refresh" label="12 saat biçimi" hint="Öğleden önce / sonra"><Switch label="12 saat" value={flag('hour12')} onChange={(v) => update(w.id, { hour12: v })} /></Row>
          <Row icon="desk" label="Tarihi göster"><Switch label="Tarih" value={flag('date', true)} onChange={(v) => update(w.id, { date: v })} /></Row>
        </>
      )}
      {w.type === 'analog' && (
        <>
          <Row icon="clock" label="Saniye çubuğu"><Switch label="Saniye çubuğu" value={flag('seconds', true)} onChange={(v) => update(w.id, { seconds: v })} /></Row>
          <Row icon="motion" label="Akıcı hareket" hint="Kapalıyken saniye çubuğu tık tık ilerler"><Switch label="Akıcı hareket" value={flag('smooth', true)} onChange={(v) => update(w.id, { smooth: v })} /></Row>
          <Row icon="list" label="Rakamlar">
            <Segmented<string> value={String(o.numbers ?? 'quarters')} onChange={(v) => update(w.id, { numbers: v })} options={[['none', 'Yok'], ['quarters', '12-3-6-9'], ['all', 'Hepsi']]} />
          </Row>
        </>
      )}
      {w.type === 'calendar' && (
        <>
          <Row icon="desk" label="Görünüm"><Segmented<string> value={String(o.view ?? 'month')} onChange={(v) => update(w.id, { view: v })} options={[['month', 'Ay'], ['day', 'Gün kartı']]} /></Row>
          {o.view !== 'day' && <Row icon="list" label="Hafta numaraları"><Switch label="Hafta numaraları" value={flag('weekNumbers')} onChange={(v) => update(w.id, { weekNumbers: v })} /></Row>}
        </>
      )}
      {w.type === 'weather' && (
        <Row icon="location" label="Şehir" hint="Adını yaz, odaktan çıkınca güncellenir">
          <input className="st-input" type="text" placeholder="Şehir" defaultValue={String(o.city ?? '')} onBlur={(e) => update(w.id, { city: e.target.value.trim() || 'Istanbul' })} />
        </Row>
      )}
    </>
  )
}

export function WidgetsTab() {
  const [widgets, setWidgets] = useRemote('widgets:list', [], 'widgets:changed', (p) => p)
  const [style, setStyle] = useState<WidgetStyle>('glass')
  const [added, setAdded] = useState<string | null>(null)
  const list = widgets ?? []

  const add = async (type: WidgetType) => {
    const next = await invoke('widgets:add', type)
    const created = next[next.length - 1]
    if (created && style !== 'glass') invoke('widgets:update', created.id, { style }).then(setWidgets)
    else setWidgets(next)
    setAdded(WIDGET_INFO[type].name)
  }
  const update: Update = (id, options) => invoke('widgets:update', id, options).then(setWidgets)

  return (
    <Pages id="widgets">
      <Card icon="widgets" tab="Ekle" title="Widget ekle" hint="Her widget masaüstünde serbest bir pencere olarak durur; sürükleyerek yerini değiştirirsin. Önizlemeler gerçek ve canlıdır; renkleri seçili temadan gelir.">
        <Row icon="theme" label="Önizleme stili" hint="Eklediğin widget bu stille başlar; sonradan değiştirebilirsin">
          <Segmented<WidgetStyle> value={style} onChange={setStyle} options={WIDGET_STYLES.map((s): [WidgetStyle, string] => [s, STYLE_INFO[s].name])} />
        </Row>
        <div className="st-widgetgrid">
          {WIDGET_TYPES.map((type) => (
            <div className="st-widgetcard" key={type}>
              <WidgetPreview type={type} options={{ ...DEFAULT_WIDGET_OPTIONS[type], style }} />
              <div className="st-widgetcard__row">
                <div>
                  <b>{WIDGET_INFO[type].name}</b>
                  <small>{WIDGET_INFO[type].hint}</small>
                </div>
                <button className="st-btn st-btn--accent" onClick={() => add(type)}><Icon name="plus" size={14} />Ekle</button>
              </div>
            </div>
          ))}
        </div>
        {added && <p className="st-prose">“{added}” masaüstüne eklendi. Düzenlemek için “Eklenenler” sekmesine bak.</p>}
      </Card>

      <Card icon="items" tab="Eklenenler" title={`Eklenenler (${list.length})`} hint="Masaüstündeki widget’lar. Stilini, boyutunu ve ayrıntılarını buradan değiştirirsin.">
        {list.length === 0 && <p className="st-prose">Henüz widget yok. “Ekle” sekmesinden bir tane seç.</p>}
        <div className="st-widgetlist">
          {list.map((w) => (
            <div className="st-widgetitem" key={w.id}>
              <div className="st-widgetitem__pic">
                <WidgetPreview type={w.type} options={w.options} />
              </div>
              <div className="st-widgetitem__body">
                <div className="st-widgetitem__title">
                  <b>{WIDGET_INFO[w.type].name}</b>
                  <button className="st-btn st-btn--danger" aria-label="Kaldır" onClick={() => invoke('widgets:remove', w.id).then(setWidgets)}><Icon name="trash" size={14} />Kaldır</button>
                </div>
                <Row icon="theme" label="Stil">
                  <Segmented<WidgetStyle> value={widgetStyle(w.options)} onChange={(s) => update(w.id, { style: s })} options={WIDGET_STYLES.map((s): [WidgetStyle, string] => [s, STYLE_INFO[s].name])} />
                </Row>
                <Row icon="maximize" label="Boyut">
                  <Slider value={Math.round(widgetScale(w.options) * 100)} min={60} max={200} step={5} unit="%" onChange={(v) => update(w.id, { scale: v / 100 })} />
                </Row>
                <WidgetOptionsRows w={w} update={update} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Pages>
  )
}
