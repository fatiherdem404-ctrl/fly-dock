import { ReactNode, useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent, useRemote } from '@/api'
import Icon, { IconName } from '@/icons'
import DockPreview from '@/components/DockPreview'
import { DESK_LABELS, DESK_PRESETS, deskTransform } from '@/desk'
import {
  DESK_STYLES, DockItem, DockSettings, PackInfo, ThemeDef, WidgetType,
  AnimationCurve, DeskStyle, FalloffCurve, HoverAnimation, IndicatorStyle, LaunchAnimation, ShowAnimation, SpeedPreset, StackSize, WindowAnimation, LabelMode,
} from '@/shared/types'

type Tab = 'dock' | 'desk' | 'motion' | 'windows' | 'theme' | 'icons' | 'items' | 'widgets' | 'general'
const TABS: [Tab, string, IconName][] = [
  ['dock', 'Dock', 'dock'],
  ['desk', 'Zemin ve raf', 'desk'],
  ['motion', 'Animasyonlar', 'motion'],
  ['windows', 'Dock pencereleri', 'window'],
  ['theme', 'Temalar', 'theme'],
  ['icons', 'Simge paketleri', 'pack'],
  ['items', 'Öğeler', 'items'],
  ['widgets', 'Widget\'lar', 'widgets'],
  ['general', 'Genel', 'general'],
]

type Update = (partial: Partial<DockSettings>) => void

// ---- building blocks ----

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="st-card">
      <header>
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </header>
      <div className="st-card__body">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="st-row__control">{children}</div>
    </div>
  )
}

function Switch({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button className="st-switch" role="switch" aria-checked={value} aria-label={label} disabled={disabled} onClick={() => onChange(!value)}><i /></button>
}

function Slider({ value, min, max, step = 1, unit = '', onChange, format }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="st-slider">
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{format ? format(value) : `${value}${unit}`}</output>
    </div>
  )
}

function Select<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select className="st-select" value={String(value)} onChange={(e) => {
      const picked = options.find(([v]) => String(v) === e.target.value)
      if (picked) onChange(picked[0])
    }}>
      {options.map(([v, label]) => <option key={String(v)} value={String(v)}>{label}</option>)}
    </select>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="st-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

function Choice<T extends string>({ value, options, onChange, children }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void; children?: (id: T) => ReactNode }) {
  return (
    <div className="st-choices">
      {options.map(([id, label, hint]) => (
        <button key={id} className="st-choice" aria-pressed={value === id} onClick={() => onChange(id)}>
          {children?.(id)}
          <b>{label}</b>
          {hint && <small>{hint}</small>}
        </button>
      ))}
    </div>
  )
}

function Message({ text, error }: { text: string; error?: boolean }) {
  return <div className={`st-message${error ? ' st-message--error' : ''}`}>{text}</div>
}

// ---- Dock ----

const SIDES: [DockSettings['position'], string][] = [['top', 'Üst'], ['left', 'Sol'], ['right', 'Sağ'], ['bottom', 'Alt']]

function PositionPicker({ value, onChange }: { value: DockSettings['position']; onChange: (p: DockSettings['position']) => void }) {
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

function DockTab({ s, set }: { s: DockSettings; set: Update }) {
  const [displays] = useRemote('displays:list', [])
  const monitors: [string, string][] = [
    ['primary', 'Ana monitör'],
    ['all', 'Tüm monitörler (her birinde bir dock)'],
    ...(displays ?? []).map((d): [string, string] => [String(d.id), `Monitör ${d.label}${d.primary ? ' (ana)' : ''}`]),
  ]
  const current = typeof s.monitor === 'number' ? String(s.monitor) : s.monitor
  const horizontal = s.position === 'bottom' || s.position === 'top'
  return (
    <>
      <Card title="Konum" hint="Dock'u ekranın hangi kenarına koyacağını, kenara uzaklığını ve kenar boyunca yerini seç. Değişiklikler anında dock'a uygulanır.">
        <PositionPicker value={s.position} onChange={(position) => set({ position })} />
        <Row label="Kenardan uzaklık" hint="Dock ile ekran kenarı arasındaki boşluk">
          <Slider value={s.edgeOffset} min={0} max={160} unit=" px" onChange={(edgeOffset) => set({ edgeOffset })} />
        </Row>
        <Row label={horizontal ? 'Yatay yer' : 'Dikey yer'} hint="Kenar boyunca kaydır: baş, orta ya da son">
          <Slider value={s.alignment} min={0} max={100} format={(v) => (v === 50 ? 'orta' : `%${v}`)} onChange={(alignment) => set({ alignment })} />
        </Row>
        <Row label="Konumu sıfırla"><button className="st-btn" onClick={() => set({ edgeOffset: 6, alignment: 50 })}><Icon name="refresh" size={15} />Ortala</button></Row>
        <Row label="Monitör" hint="Birden çok monitörde her birine ayrı dock konabilir">
          <Select value={current} options={monitors} onChange={(v) => set({ monitor: v === 'primary' || v === 'all' ? v : Number(v) })} />
        </Row>
      </Card>

      <Card title="Simgeler ve büyüme" hint="İkonun kendi boyutu ile fareyle büyümesi ayrı ayarlardır.">
        <Row label="Simge boyutu"><Slider value={s.iconSize} min={24} max={96} unit=" px" onChange={(iconSize) => set({ iconSize })} /></Row>
        <Row label="Simge aralığı"><Slider value={s.iconSpacing} min={0} max={32} unit=" px" onChange={(iconSpacing) => set({ iconSpacing })} /></Row>
        <Row label="Fareyle büyütme"><Switch label="Büyütme" value={s.magnification} onChange={(magnification) => set({ magnification })} /></Row>
        {s.magnification && (
          <>
            <Row label="En büyük boyut" hint="Simge boyutunun katı olarak"><Slider value={s.maxScale} min={1} max={3} step={0.05} format={(v) => `${v.toFixed(2)}× (${Math.round(v * s.iconSize)} px)`} onChange={(maxScale) => set({ maxScale })} /></Row>
            <Row label="Yayılma" hint="Kaç komşu simge etkilenir"><Slider value={s.magnificationRadius} min={0.5} max={5} step={0.5} format={(v) => `${v} simge`} onChange={(magnificationRadius) => set({ magnificationRadius })} /></Row>
            <Row label="Etki eğrisi" hint="Büyümenin komşulara nasıl yayıldığı">
              <Select<FalloffCurve> value={s.falloff} onChange={(falloff) => set({ falloff })} options={[['cosine', 'Yumuşak (kosinüs)'], ['gaussian', 'Çan eğrisi'], ['linear', 'Doğrusal'], ['sharp', 'Sivri']]} />
            </Row>
          </>
        )}
      </Card>

      <Card title="Etiketler">
        <Row label="Simge adları"><Segmented<LabelMode> value={s.labelMode} onChange={(labelMode) => set({ labelMode })} options={[['hover', 'Üzerine gelince'], ['always', 'Hep'], ['never', 'Hiç']]} /></Row>
        {s.labelMode !== 'never' && (
          <>
            <Row label="Yazı boyutu"><Slider value={s.labelSize} min={9} max={20} unit=" px" onChange={(labelSize) => set({ labelSize })} /></Row>
            <Row label="Yazı tipi"><Select value={s.labelFont} onChange={(labelFont) => set({ labelFont })} options={[['', 'Tema yazı tipi'], ['Segoe UI', 'Segoe UI'], ['Bahnschrift', 'Bahnschrift'], ['Consolas', 'Consolas'], ['Georgia', 'Georgia'], ['Trebuchet MS', 'Trebuchet MS']]} /></Row>
          </>
        )}
      </Card>

      <Card title="Davranış">
        <Row label="Çalışan programlar" hint="Sabitlenmemiş açık programlar ayraçtan sonra görünür"><Switch label="Çalışan programlar" value={s.showRunningApps} onChange={(showRunningApps) => set({ showRunningApps })} /></Row>
        <Row label="Çalışma göstergesi" hint="Açık programın altında ışık"><Switch label="Gösterge" value={s.showRunningIndicators} onChange={(showRunningIndicators) => set({ showRunningIndicators })} /></Row>
        <Row label="Çöp kutusu"><Switch label="Çöp kutusu" value={s.showTrash} onChange={(showTrash) => set({ showTrash })} /></Row>
        <Row label="Simgeleri kilitle" hint="Sürükleyip sıralamayı ve kaldırmayı kapatır"><Switch label="Kilitle" value={s.lockItems} onChange={(lockItems) => set({ lockItems })} /></Row>
        <Row label="Otomatik gizle" hint="İmleç ekran kenarına gidince dock belirir"><Switch label="Otomatik gizle" value={s.autoHide} onChange={(autoHide) => set({ autoHide })} /></Row>
        {s.autoHide && <Row label="Gizlenme gecikmesi"><Slider value={s.autoHideDelayMs} min={0} max={3000} step={100} unit=" ms" onChange={(autoHideDelayMs) => set({ autoHideDelayMs })} /></Row>}
        <Row label="Tam ekranda gizle" hint="Oyun ve video tam ekranken dock görünmez"><Switch label="Tam ekranda gizle" value={s.hideInFullscreen} onChange={(hideInFullscreen) => set({ hideInFullscreen })} /></Row>
      </Card>
    </>
  )
}

// ---- Desk ----

function DeskCard({ style }: { style: DeskStyle }) {
  const tilt = deskTransform(DESK_PRESETS[style].depth, 'bottom')
  return (
    <div className={`st-desk dock dock--desk-${style} dock--bottom`} style={{ '--desk-depth': `${DESK_PRESETS[style].depth}px` } as React.CSSProperties}>
      <div className="dock__desk" style={{ position: 'absolute', left: '10%', right: '10%', bottom: 6, height: 26, ...tilt }}>
        <span className="dock__desk-sheen" />
      </div>
      {[0, 1, 2].map((i) => <i key={i} className="st-desk__icon" style={{ left: `${26 + i * 18}%`, bottom: 14 + (i === 1 ? 4 : 0) }} />)}
    </div>
  )
}

function DeskTab({ s, set }: { s: DockSettings; set: Update }) {
  const supported = useRemote('app:info', [])[0]?.materialSupported
  return (
    <>
      <Card title="Raf stili" hint="Simgelerin üzerinde durduğu zemin. Seçince o stilin en iyi derinliği ve saydamlığı uygulanır, sonra ayrıca değiştirebilirsin.">
        <Choice<DeskStyle>
          value={s.deskStyle}
          onChange={(deskStyle) => set({ deskStyle, deskDepth: DESK_PRESETS[deskStyle].depth, deskOpacity: DESK_PRESETS[deskStyle].opacity })}
          options={DESK_STYLES.map((d): [DeskStyle, string] => [d, DESK_LABELS[d]])}
        >
          {(id) => <DeskCard style={id} />}
        </Choice>
      </Card>
      <Card title="Görünüm">
        <Row label="Renk tonu" hint="Boşsa temanın rengi kullanılır">
          <div className="st-color">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.deskColor) ? s.deskColor : '#4da3ff'} onChange={(e) => set({ deskColor: e.target.value })} />
            <button className="st-btn" onClick={() => set({ deskColor: '' })} disabled={!s.deskColor}>Temaya dön</button>
          </div>
        </Row>
        <Row label="Saydamlık"><Slider value={s.deskOpacity} min={0.2} max={1} step={0.05} format={(v) => `%${Math.round(v * 100)}`} onChange={(deskOpacity) => set({ deskOpacity })} /></Row>
        <Row label="3B derinlik" hint="0 = düz; yükseldikçe raf perspektifle yatar"><Slider value={s.deskDepth} min={0} max={60} unit=" px" onChange={(deskDepth) => set({ deskDepth })} /></Row>
        <Row label="Raf kalınlığı" hint="Simgenin altındaki ve üstündeki boşluk"><Slider value={s.shelfPadding} min={0} max={24} unit=" px" onChange={(shelfPadding) => set({ shelfPadding })} /></Row>
        <Row label="Raf simgelerle büyüsün" hint="Kapalıyken simgeler raftan taşar (macOS gibi)"><Switch label="Raf büyümesi" value={s.shelfGrows} onChange={(shelfGrows) => set({ shelfGrows })} /></Row>
      </Card>
      <Card title="Sistem camı (deneysel)" hint="Windows 11'in gerçek bulanıklığı. Ayrı bir pencere olduğu için hareketli olamaz: raf sabit durur, simgeler üstünde büyür.">
        <Row label="Malzeme">
          <Select value={s.material} onChange={(material) => set({ material })} options={[['none', 'Kapalı (tema rafı)'], ['acrylic', 'Akrilik'], ['mica', 'Mica']]} />
        </Row>
        {supported === false && <Message text="Bu Windows sürümü sistem camını desteklemiyor (Windows 11 22H2 gerekir)." error />}
      </Card>
    </>
  )
}

// ---- Motion ----

function MotionTab({ s, set, preview }: { s: DockSettings; set: Update; preview: () => void }) {
  return (
    <>
      <Card title="Hız" hint="Tüm dock animasyonlarının süresi">
        <Row label="Hız"><Segmented<SpeedPreset> value={s.speed} onChange={(speed) => set({ speed })} options={[['fast', 'Hızlı'], ['medium', 'Orta'], ['slow', 'Yavaş'], ['custom', 'Özel']]} /></Row>
        {s.speed === 'custom' && <Row label="Süre"><Slider value={s.speedMs} min={100} max={1500} step={10} unit=" ms" onChange={(speedMs) => set({ speedMs })} /></Row>}
        <Row label="Hareket tipi">
          <Select<AnimationCurve> value={s.animationCurve} onChange={(animationCurve) => set({ animationCurve })} options={[['spring', 'Yay (sıçramasız)'], ['bounce', 'Zıplayan yay'], ['ease', 'Yumuşak'], ['linear', 'Hızlı ve düz']]} />
        </Row>
      </Card>
      <Card title="Fare üzerine gelince">
        <Choice<HoverAnimation> value={s.hoverAnimation} onChange={(hoverAnimation) => set({ hoverAnimation })} options={[['zoom', 'Büyüme', 'Simge büyür'], ['lift', 'Yükselme', 'Simge raftan kalkar'], ['wave', 'Dalga', 'Büyür ve kalkar']]} />
      </Card>
      <Card title="Uygulama başlatma" hint="Bir programı başlatınca simgenin hareketi">
        <Choice<LaunchAnimation> value={s.launchAnimation} onChange={(launchAnimation) => set({ launchAnimation })} options={[['bounce', 'Sıçrama', 'İki kez zıplar'], ['hop', 'Atlama', 'Tek zıplama'], ['pulse', 'Işık atımı', 'Parlar ve büyür'], ['none', 'Yok']]} />
        <div className="st-row-inline"><button className="st-btn" onClick={preview}><Icon name="play" size={14} />Önizle</button></div>
      </Card>
      <Card title="Çalışan uygulama göstergesi">
        <Choice<IndicatorStyle> value={s.indicatorStyle} onChange={(indicatorStyle) => set({ indicatorStyle })} options={[['dot', 'Nokta'], ['bar', 'Çubuk'], ['glow', 'Işıltı'], ['ring', 'Halka']]} />
      </Card>
      <Card title="Dock giriş ve çıkışı" hint="Otomatik gizleme açıkken dock'un ekrana gelişi">
        <Choice<ShowAnimation> value={s.showAnimation} onChange={(showAnimation) => set({ showAnimation })} options={[['slide', 'Kayma'], ['fade', 'Solma'], ['scale', 'Ölçek']]} />
      </Card>
      <Card title="Dock pencereleri" hint="Klasör ve grup pencerelerinin açılış/kapanış efekti">
        <Choice<WindowAnimation> value={s.windowAnimation} onChange={(windowAnimation) => set({ windowAnimation })} options={[['genie', 'Cin (genie)', 'Simgeden akarak açılır'], ['scale', 'Büyüme'], ['fade', 'Solma'], ['slide', 'Kayma']]} />
      </Card>
    </>
  )
}

// ---- Dock windows ----

function WindowsTab({ s, set }: { s: DockSettings; set: Update }) {
  return (
    <>
      <Card title="Pencere boyutu" hint="Bir klasöre ya da gruba tıklayınca açılan dock penceresinin boyutu. İçerik uzunsa kaydırılır.">
        <Choice<StackSize> value={s.stackSize} onChange={(stackSize) => set({ stackSize })} options={[['small', 'Küçük', '360 × 300'], ['medium', 'Orta', '520 × 420'], ['full', 'Tam ekran', 'Çalışma alanı'], ['custom', 'Özel']]} />
        {s.stackSize === 'custom' && (
          <>
            <Row label="Genişlik"><Slider value={s.stackWidth} min={240} max={1600} step={10} unit=" px" onChange={(stackWidth) => set({ stackWidth })} /></Row>
            <Row label="Yükseklik"><Slider value={s.stackHeight} min={200} max={1000} step={10} unit=" px" onChange={(stackHeight) => set({ stackHeight })} /></Row>
          </>
        )}
      </Card>
      <Card title="Nasıl çalışır">
        <p className="st-prose">Dock'taki bir klasöre sağ tıklayıp <b>Yığın olarak göster</b> de, ya da <b>Yeni grup</b> ile bir uygulama grubu oluştur. Tıklayınca pencere simgeden büyüyerek açılır; <kbd>Esc</kbd> ya da dışarı tıklama kapatır. Açılış efektini Animasyonlar sekmesinden seçebilirsin.</p>
      </Card>
    </>
  )
}

// ---- Themes and icon packs ----

function PackCards({ packs, activeId, onUse, type, onChanged }: { packs: PackInfo[]; activeId: string; onUse: (id: string) => void; type: PackInfo['type']; onChanged: () => void }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const list = packs.filter((p) => p.type === type)
  const act = async (fn: () => Promise<{ ok: boolean; message: string }>, success: string) => {
    const result = await fn()
    if (result.message === 'cancelled') return
    setMessage({ text: result.ok ? `${success}: ${result.message}` : result.message, error: !result.ok })
    onChanged()
  }
  return (
    <>
      <div className="st-cards">
        {type === 'icons' && (
          <div className="st-pack" data-active={activeId === ''}>
            <b>Sistem simgeleri</b>
            <small>Windows'un kendi simgeleri</small>
            <div className="st-pack__actions"><button className="st-btn" onClick={() => onUse('')}>Kullan</button></div>
          </div>
        )}
        {list.map((p) => (
          <div key={p.id} className="st-pack" data-active={activeId === p.id}>
            <b>{p.name}</b>
            <small>{p.builtin ? 'Hazır' : p.author ?? 'Bilinmeyen yazar'}{p.version ? ` · ${p.version}` : ''}</small>
            <div className="st-pack__actions">
              <button className="st-btn" onClick={() => onUse(p.id)}>Kullan</button>
              <button className="st-btn" onClick={() => act(() => invoke('packs:export', p.id), 'Dışa aktarıldı')}>Dışa aktar</button>
              {!p.builtin && <button className="st-btn st-btn--danger" onClick={() => invoke('packs:remove', p.id).then(onChanged)}>Sil</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="st-row-inline"><button className="st-btn st-btn--accent" onClick={() => act(() => invoke('packs:import'), 'İçe aktarıldı')}><Icon name="download" size={15} />Paket içe aktar (.flypack)</button></div>
      {message && <Message text={message.text} error={message.error} />}
    </>
  )
}

function ThemeTab({ s, set, kind }: { s: DockSettings; set: Update; kind: 'theme' | 'icons' }) {
  const [packs, setPacks] = useRemote('packs:list', [], 'themes:changed')
  const refresh = () => invoke('packs:list').then(setPacks)
  const [swatches, setSwatches] = useState<Record<string, ThemeDef['vars']>>({})
  useEffect(() => {
    ;(packs ?? []).filter((p) => p.type === 'theme').forEach((p) => invoke('themes:get', p.id).then((t) => t && setSwatches((cur) => ({ ...cur, [p.id]: t.vars }))))
  }, [packs])
  const vars = swatches[s.theme]
  return kind === 'theme' ? (
    <Card title="Temalar" hint="Renkler, cam ve yazı tipi. Tema dosyaları .flypack olarak içe ve dışa aktarılır.">
      <PackCards packs={packs ?? []} activeId={s.theme} onUse={(theme) => set({ theme })} type="theme" onChanged={refresh} />
      {vars && <div className="st-swatches">{[vars.surface, vars.accent, vars.indicator, vars.panelBg].map((c, i) => <i key={i} style={{ background: c }} />)}</div>}
    </Card>
  ) : (
    <Card title="Simge paketleri" hint="Programlar için toplu simge değişimi">
      <PackCards packs={packs ?? []} activeId={s.iconPack} onUse={(iconPack) => set({ iconPack })} type="icons" onChanged={refresh} />
    </Card>
  )
}

// ---- Items and widgets ----

function ItemsTab() {
  const [items, setItems] = useRemote('items:get', [], 'items:changed', (p) => p)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const pinned = (items ?? []).filter((i) => i.type !== 'separator' && i.type !== 'trash' && !i.id.startsWith('run:'))
  useEffect(() => {
    pinned.forEach((i) => invoke('items:icon', i.id).then((src) => src && setIcons((cur) => ({ ...cur, [i.id]: src }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  const update = (id: string, patch: Partial<DockItem>) => invoke('items:update', id, patch).then(setItems)
  return (
    <Card title="Sabit öğeler" hint="Dock'a dosya, program ya da klasör sürükleyip bırakarak ekleyebilirsin. Buradan ad ve kısayol düzenlenir.">
      <div className="st-list">
        {pinned.map((item) => (
          <div className="st-list__row" key={item.id}>
            {icons[item.id] ? <img src={icons[item.id]} alt="" /> : <span />}
            <input className="st-input" type="text" defaultValue={item.label ?? ''} onBlur={(e) => e.target.value !== (item.label ?? '') && update(item.id, { label: e.target.value })} />
            <input className="st-input" type="text" placeholder="Kısayol (ör. Ctrl+Alt+1)" defaultValue={item.hotkey ?? ''} onBlur={(e) => e.target.value !== (item.hotkey ?? '') && update(item.id, { hotkey: e.target.value.trim() || undefined })} />
            <button className="st-btn st-btn--danger" onClick={() => invoke('items:remove', item.id).then(setItems)}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        {pinned.length === 0 && <p className="st-prose">Dock'ta henüz sabit öğe yok. Bir programı dock'a sürükleyip bırak.</p>}
      </div>
    </Card>
  )
}

const WIDGET_NAMES: Record<WidgetType, string> = { clock: 'Saat', weather: 'Hava durumu', system: 'CPU / RAM / Disk', media: 'Medya', calendar: 'Takvim' }

function WidgetsTab() {
  const [widgets, setWidgets] = useRemote('widgets:list', [], 'widgets:changed', (p) => p)
  return (
    <Card title="Widget'lar" hint="Masaüstünde serbest pencereler olarak durur; sürükleyerek yerini değiştirebilirsin.">
      <div className="st-row-inline">
        {(Object.keys(WIDGET_NAMES) as WidgetType[]).map((type) => (
          <button key={type} className="st-btn" onClick={() => invoke('widgets:add', type).then(setWidgets)}><Icon name="plus" size={14} />{WIDGET_NAMES[type]}</button>
        ))}
      </div>
      <div className="st-list">
        {(widgets ?? []).map((w) => (
          <div className="st-list__row st-list__row--widget" key={w.id}>
            <b>{WIDGET_NAMES[w.type]}</b>
            {w.type === 'weather' ? (
              <input className="st-input" type="text" placeholder="Şehir" defaultValue={String(w.options.city ?? '')} onBlur={(e) => invoke('widgets:update', w.id, { city: e.target.value.trim() || 'Istanbul' }).then(setWidgets)} />
            ) : w.type === 'clock' ? (
              <label className="st-check"><input type="checkbox" checked={!!w.options.seconds} onChange={(e) => invoke('widgets:update', w.id, { seconds: e.target.checked }).then(setWidgets)} /> Saniye göster</label>
            ) : <span />}
            <button className="st-btn st-btn--danger" onClick={() => invoke('widgets:remove', w.id).then(setWidgets)}><Icon name="trash" size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---- General ----

function GeneralTab({ s, set }: { s: DockSettings; set: Update }) {
  const [info] = useRemote('app:info', [])
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const backup = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    const r = await fn()
    if (r.message !== 'cancelled') setMessage({ text: r.ok ? r.message : r.message, error: !r.ok })
  }
  return (
    <>
      <Card title="Başlangıç">
        <Row label="Windows ile başlat" hint={info && !info.loginSupported ? 'Yalnızca kurulu sürümde çalışır (geliştirme çalıştırmasında kapalı)' : 'Bilgisayar açılınca dock kendiliğinden başlar'}>
          <Switch label="Windows ile başlat" value={s.launchAtLogin} disabled={info ? !info.loginSupported : true} onChange={(launchAtLogin) => set({ launchAtLogin })} />
        </Row>
        <Row label="Dock'u göster / gizle kısayolu" hint="Electron biçimi: Control+Alt+D">
          <input className="st-input" type="text" defaultValue={s.toggleHotkey} onBlur={(e) => e.target.value !== s.toggleHotkey && set({ toggleHotkey: e.target.value.trim() })} />
        </Row>
      </Card>
      <Card title="Yedekle ve geri yükle" hint="Ayarlar, öğeler ve widget'lar tek bir JSON dosyasında. Geri yükleyince uygulama yeniden başlar.">
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => backup(() => invoke('backup:export'))}><Icon name="upload" size={15} />Yedekle</button>
          <button className="st-btn" onClick={() => backup(() => invoke('backup:import'))}><Icon name="download" size={15} />Geri yükle</button>
        </div>
        {message && <Message text={message.text} error={message.error} />}
      </Card>
      <Card title="Hakkında">
        <p className="st-prose"><b>{info?.name}</b> {info?.version && `v${info.version}`}<br />{info?.tagline}<br />Ücretsiz ve açık kaynak (GPLv3). Beğendiysen geliştirmeyi destekleyebilirsin.</p>
        <div className="st-row-inline">
          <button className="st-btn st-btn--accent" onClick={() => invoke('app:open-external', 'support')}><Icon name="heart" size={15} />Ko-fi'de destek ol</button>
          <button className="st-btn" onClick={() => invoke('app:open-external', 'repo')}><Icon name="code" size={15} />Kaynak kodu</button>
          <button className="st-btn" onClick={() => invoke('app:open-external', 'issues')}><Icon name="bug" size={15} />Sorun bildir</button>
          <button className="st-btn st-btn--danger" onClick={() => invoke('app:quit')}><Icon name="power" size={15} />Çık</button>
        </div>
      </Card>
    </>
  )
}

// ---- shell ----

const PREVIEW_TABS: Tab[] = ['dock', 'desk', 'motion']

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>('dock')
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [info] = useRemote('app:info', [])
  const [launchTick, setLaunchTick] = useState(0)
  useEffect(() => {
    invoke('settings:get').then(setSettings)
  }, [])
  useEvent('settings:changed', setSettings)
  useActiveTheme(settings?.theme)

  const set: Update = (partial) => {
    setSettings((cur) => (cur ? { ...cur, ...partial } : cur))
    if ('launchAnimation' in partial) setLaunchTick((t) => t + 1)
    invoke('settings:update', partial)
  }

  if (!settings) return null
  return (
    <div className="st">
      <nav className="st-nav" role="tablist">
        <div className="st-brand">
          <span className="st-brand__mark"><Icon name="dock" size={22} /></span>
          <div><b>{info?.name}</b><small>{info?.tagline}</small></div>
        </div>
        {TABS.map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="st-tab" onClick={() => setTab(id)}>
            <Icon name={icon} size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <main className="st-main">
        {PREVIEW_TABS.includes(tab) && (
          <div className="st-preview">
            <DockPreview settings={settings} launchTick={launchTick} />
            <span className="st-preview__tag">Canlı önizleme</span>
          </div>
        )}
        <div className="st-page" key={tab}>
          <h2>{TABS.find(([id]) => id === tab)?.[1]}</h2>
          {tab === 'dock' && <DockTab s={settings} set={set} />}
          {tab === 'desk' && <DeskTab s={settings} set={set} />}
          {tab === 'motion' && <MotionTab s={settings} set={set} preview={() => setLaunchTick((t) => t + 1)} />}
          {tab === 'windows' && <WindowsTab s={settings} set={set} />}
          {tab === 'theme' && <ThemeTab s={settings} set={set} kind="theme" />}
          {tab === 'icons' && <ThemeTab s={settings} set={set} kind="icons" />}
          {tab === 'items' && <ItemsTab />}
          {tab === 'widgets' && <WidgetsTab />}
          {tab === 'general' && <GeneralTab s={settings} set={set} />}
        </div>
      </main>
    </div>
  )
}
