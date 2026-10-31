import { useRemote } from '@/api'
import Icon from '@/icons'
import { separatorKind } from '@/desk'
import { DockLayer, DockSettings, SeparatorStyle, FalloffCurve, LabelMode } from '@/shared/types'
import { SepPreview, LabelPreview, LayerPreview, FalloffPreview } from '../previews'
import { Card, Cards, Pages, Row, Switch, Slider, Select, Update } from '../ui'

// ---- Dock ----

export const SIDES: [DockSettings['position'], string][] = [['top', 'Üst'], ['left', 'Sol'], ['right', 'Sağ'], ['bottom', 'Alt']]

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
    ['primary', 'Ana monitör'],
    ['all', 'Tüm monitörler (her birinde bir dock)'],
    ...(displays ?? []).map((d): [string, string] => [String(d.id), `Monitör ${d.label}${d.primary ? ' (ana)' : ''}`]),
  ]
  const current = typeof s.monitor === 'number' ? String(s.monitor) : s.monitor
  const horizontal = s.position === 'bottom' || s.position === 'top'
  return (
    <Pages id="dock">
      <Card icon="location" tab="Konum" title="Konum" hint="Dock'u ekranın hangi kenarına koyacağını, kenara uzaklığını ve kenar boyunca yerini seç. Değişiklikler anında dock'a uygulanır.">
        <PositionPicker value={s.position} onChange={(position) => set({ position })} />
        <Row icon="arrowDown" label="Kenardan uzaklık" hint="Dock ile ekran kenarı arasındaki boşluk">
          <Slider value={s.edgeOffset} min={0} max={160} unit=" px" onChange={(edgeOffset) => set({ edgeOffset })} />
        </Row>
        <Row icon="arrowRight" label={horizontal ? 'Yatay yer' : 'Dikey yer'} hint="Kenar boyunca kaydır: baş, orta ya da son">
          <Slider value={s.alignment} min={0} max={100} format={(v) => (v === 50 ? 'orta' : `%${v}`)} onChange={(alignment) => set({ alignment })} />
        </Row>
        <Row label="Konumu sıfırla"><button className="st-btn" onClick={() => set({ edgeOffset: 6, alignment: 50 })}><Icon name="refresh" size={15} />Ortala</button></Row>
        <Row icon="monitor" label="Monitör" hint="Birden çok monitörde her birine ayrı dock konabilir">
          <Select value={current} options={monitors} onChange={(v) => set({ monitor: v === 'primary' || v === 'all' ? v : Number(v) })} />
        </Row>
      </Card>

      <Card icon="dock" tab="Simgeler" title="Simgeler ve büyüme" hint="İkonun kendi boyutu ile fareyle büyümesi ayrı ayarlardır.">
        <Row icon="maximize" label="Simge boyutu"><Slider value={s.iconSize} min={24} max={96} unit=" px" onChange={(iconSize) => set({ iconSize })} /></Row>
        <Row label="Simge aralığı"><Slider value={s.iconSpacing} min={0} max={32} unit=" px" onChange={(iconSpacing) => set({ iconSpacing })} /></Row>
        <Row icon="search" label="Fareyle büyütme"><Switch label="Büyütme" value={s.magnification} onChange={(magnification) => set({ magnification })} /></Row>
        {s.magnification && (
          <>
            <Row label="En büyük boyut" hint="Simge boyutunun katı olarak"><Slider value={s.maxScale} min={1} max={3} step={0.05} format={(v) => `${v.toFixed(2)}× (${Math.round(v * s.iconSize)} px)`} onChange={(maxScale) => set({ maxScale })} /></Row>
            <Row label="Yayılma" hint="Kaç komşu simge etkilenir"><Slider value={s.magnificationRadius} min={0.5} max={5} step={0.5} format={(v) => `${v} simge`} onChange={(magnificationRadius) => set({ magnificationRadius })} /></Row>
            <Row icon="motion" label="Etki eğrisi" hint="Büyümenin komşulara nasıl yayıldığı" />
            <Cards<FalloffCurve> size="s" value={s.falloff} onChange={(falloff) => set({ falloff })} options={([['cosine', 'Yumuşak'], ['gaussian', 'Çan'], ['linear', 'Doğrusal'], ['sharp', 'Sivri']] as [FalloffCurve, string][]).map(([id, label]) => ({ id, label, preview: <FalloffPreview curve={id} /> }))} />
          </>
        )}
      </Card>

      <Card icon="minus" tab="Ayraç" title="Ayraç" hint="Dock'taki gruplar arasındaki çizgi. Otomatik seçeneği rafa ve temaya göre okunaklı olanı seçer: ahşap ve metalde oyuk, neonda ışıklı çubuk, camda net çizgi.">
        <Cards<SeparatorStyle> size="s" value={s.separatorStyle} onChange={(separatorStyle) => set({ separatorStyle })} options={([['auto', 'Otomatik'], ['line', 'Çizgi'], ['groove', 'Oyuk'], ['dots', 'Noktalı'], ['glow', 'Işıklı'], ['none', 'Yok']] as [SeparatorStyle, string][]).map(([id, label]) => ({ id, label, preview: <SepPreview kind={id === 'auto' ? separatorKind({ ...s, separatorStyle: 'auto' }) : id} /> }))} />
      </Card>

      <Card icon="settings" tab="Ayraç" title="Ayraç ayrıntıları" hint="Seçtiğin görünümün üstüne uygulanır. Boş bıraktığın ayar rafa ve temaya göre otomatik kalır.">
        <Row label="Kalınlık" hint="0 = görünümün kendi kalınlığı"><Slider value={s.sepThickness} min={0} max={16} format={(v) => (v === 0 ? 'otomatik' : `${v} px`)} onChange={(sepThickness) => set({ sepThickness })} /></Row>
        <Row label="Yükseklik" hint="Simge boyutunun yüzdesi"><Slider value={s.sepHeight} min={20} max={100} unit="%" onChange={(sepHeight) => set({ sepHeight })} /></Row>
        <Row label="Köşe yuvarlaklığı"><Slider value={s.sepRadius} min={0} max={8} unit=" px" onChange={(sepRadius) => set({ sepRadius })} /></Row>
        <Row label="Renk" hint="Boşsa otomatik">
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepColor) ? s.sepColor : '#cccccc'} onChange={(e) => set({ sepColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepColor: '' })} disabled={!s.sepColor}>Otomatik</button>
          </div>
        </Row>
        <Row label="Sol kenar" hint="0 = kenarlık yok"><Slider value={s.sepBorderL} min={0} max={6} unit=" px" onChange={(sepBorderL) => set({ sepBorderL })} /></Row>
        <Row label="Sol kenar rengi">
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepBorderLColor) ? s.sepBorderLColor : '#ffffff'} onChange={(e) => set({ sepBorderLColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepBorderLColor: '' })} disabled={!s.sepBorderLColor}>Otomatik</button>
          </div>
        </Row>
        <Row label="Sağ kenar"><Slider value={s.sepBorderR} min={0} max={6} unit=" px" onChange={(sepBorderR) => set({ sepBorderR })} /></Row>
        <Row label="Sağ kenar rengi">
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.sepBorderRColor) ? s.sepBorderRColor : '#000000'} onChange={(e) => set({ sepBorderRColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ sepBorderRColor: '' })} disabled={!s.sepBorderRColor}>Otomatik</button>
          </div>
        </Row>
        <Row label="Ayracı sıfırla"><button className="st-btn" onClick={() => set({ separatorStyle: 'auto', sepThickness: 0, sepHeight: 70, sepColor: '', sepRadius: 2, sepBorderL: 0, sepBorderR: 0, sepBorderLColor: '', sepBorderRColor: '' })}><Icon name="refresh" size={15} />Varsayılana dön</button></Row>
      </Card>

      <Card icon="list" tab="Etiketler" title="Etiketler" hint="Simgenin üstünde çıkan ad yazısı">
        <Cards<LabelMode> size="s" value={s.labelMode} onChange={(labelMode) => set({ labelMode })} options={([['hover', 'Üzerine gelince'], ['always', 'Hep görünsün'], ['never', 'Hiç']] as [LabelMode, string][]).map(([id, label]) => ({ id, label, preview: <LabelPreview mode={id} /> }))} />
        {s.labelMode !== 'never' && (
          <>
            <Row label="Yazı boyutu"><Slider value={s.labelSize} min={9} max={20} unit=" px" onChange={(labelSize) => set({ labelSize })} /></Row>
            <Row label="Yazı tipi"><Select value={s.labelFont} onChange={(labelFont) => set({ labelFont })} options={[['', 'Tema yazı tipi'], ['Segoe UI', 'Segoe UI'], ['Bahnschrift', 'Bahnschrift'], ['Consolas', 'Consolas'], ['Georgia', 'Georgia'], ['Trebuchet MS', 'Trebuchet MS']]} /></Row>
          </>
        )}
      </Card>

      <Card icon="settings" tab="Davranış" title="Davranış">
        <Row icon="stack" label="Pencerelere göre konum" hint="Diğer pencerelerle dock arasındaki sıra" />
        <Cards<DockLayer> size="s" value={s.layer} onChange={(layer) => set({ layer })} options={[{ id: 'above', label: 'Üstte', hint: 'Hep önde', preview: <LayerPreview layer="above" /> }, { id: 'normal', label: 'Normal', hint: 'Pencereler kapatabilir', preview: <LayerPreview layer="normal" /> }, { id: 'below', label: 'Altta', hint: 'Masaüstü gibi', preview: <LayerPreview layer="below" /> }]} />
        <Row label="Çalışan programlar" hint="Sabitlenmemiş açık programlar ayraçtan sonra görünür"><Switch label="Çalışan programlar" value={s.showRunningApps} onChange={(showRunningApps) => set({ showRunningApps })} /></Row>
        <Row label="Çalışma göstergesi" hint="Açık programın altında ışık"><Switch label="Gösterge" value={s.showRunningIndicators} onChange={(showRunningIndicators) => set({ showRunningIndicators })} /></Row>
        <Row label="Çöp kutusu"><Switch label="Çöp kutusu" value={s.showTrash} onChange={(showTrash) => set({ showTrash })} /></Row>
        <Row label="Simgeleri kilitle" hint="Sürükleyip sıralamayı ve kaldırmayı kapatır"><Switch label="Kilitle" value={s.lockItems} onChange={(lockItems) => set({ lockItems })} /></Row>
        <Row label="Otomatik gizle" hint="İmleç ekran kenarına gidince dock belirir"><Switch label="Otomatik gizle" value={s.autoHide} onChange={(autoHide) => set({ autoHide })} /></Row>
        {s.autoHide && <Row label="Gizlenme gecikmesi"><Slider value={s.autoHideDelayMs} min={0} max={3000} step={100} unit=" ms" onChange={(autoHideDelayMs) => set({ autoHideDelayMs })} /></Row>}
        <Row label="Tam ekranda gizle" hint="Oyun ve video tam ekranken dock görünmez"><Switch label="Tam ekranda gizle" value={s.hideInFullscreen} onChange={(hideInFullscreen) => set({ hideInFullscreen })} /></Row>
      </Card>
    </Pages>
  )
}
