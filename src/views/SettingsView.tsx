import { ReactNode, useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent, useRemote } from '@/api'
import type { DockItem, DockSettings, PackInfo, ThemeDef, WidgetType } from '@/shared/types'

type Tab = 'dock' | 'display' | 'theme' | 'items' | 'widgets' | 'general'
const TABS: [Tab, string][] = [
  ['dock', 'Dock'],
  ['display', 'Ekran'],
  ['theme', 'Tema ve simgeler'],
  ['items', 'Öğeler'],
  ['widgets', 'Widget\'lar'],
  ['general', 'Genel'],
]

// ---- small form controls ----

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div>
        {label}
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="toggle" role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)} />
}

function Range({ value, min, max, step = 1, unit = '', onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="field__range">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{value}{unit}</span>
    </div>
  )
}

function Select<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select value={String(value)} onChange={(e) => {
      const picked = options.find(([v]) => String(v) === e.target.value)
      if (picked) onChange(picked[0])
    }}>
      {options.map(([v, label]) => <option key={String(v)} value={String(v)}>{label}</option>)}
    </select>
  )
}

type Update = (partial: Partial<DockSettings>) => void

// ---- tabs ----

function DockTab({ s, set }: { s: DockSettings; set: Update }) {
  return (
    <>
      <h2>Dock</h2>
      <Field label="Konum">
        <Select value={s.position} onChange={(position) => set({ position })} options={[['bottom', 'Alt'], ['top', 'Üst'], ['left', 'Sol'], ['right', 'Sağ']]} />
      </Field>
      <Field label="Simge boyutu"><Range value={s.iconSize} min={24} max={96} unit=" px" onChange={(iconSize) => set({ iconSize, magnifiedSize: Math.max(s.magnifiedSize, iconSize) })} /></Field>
      <Field label="Büyütme" hint="Fare üzerine gelince simgeler büyür">
        <Toggle label="Büyütme" value={s.magnification} onChange={(magnification) => set({ magnification })} />
      </Field>
      <Field label="Büyütülmüş boyut"><Range value={s.magnifiedSize} min={s.iconSize} max={160} unit=" px" onChange={(magnifiedSize) => set({ magnifiedSize })} /></Field>
      <Field label="Etki alanı" hint="Kaç komşu simge etkilenir"><Range value={s.magnificationRadius} min={1} max={5} step={0.5} onChange={(magnificationRadius) => set({ magnificationRadius })} /></Field>
      <Field label="Animasyon">
        <Select value={s.animationCurve} onChange={(animationCurve) => set({ animationCurve })} options={[['spring', 'Yay'], ['bounce', 'Zıplama'], ['ease', 'Yumuşak'], ['linear', 'Doğrusal']]} />
      </Field>
      <Field label="Çalışan uygulama göstergesi"><Toggle label="Gösterge" value={s.showRunningIndicators} onChange={(showRunningIndicators) => set({ showRunningIndicators })} /></Field>
      <Field label="Çalışan programları da göster" hint="Dock'a sabitlenmemiş açık programlar ayraçtan sonra görünür">
        <Toggle label="Çalışan programlar" value={s.showRunningApps} onChange={(showRunningApps) => set({ showRunningApps })} />
      </Field>
      <Field label="Çöp kutusunu göster"><Toggle label="Çöp kutusu" value={s.showTrash} onChange={(showTrash) => set({ showTrash })} /></Field>
      <h3>Otomatik gizleme</h3>
      <Field label="Otomatik gizle" hint="İmleç ekran kenarına gidince dock belirir">
        <Toggle label="Otomatik gizle" value={s.autoHide} onChange={(autoHide) => set({ autoHide })} />
      </Field>
      <Field label="Gizlenme gecikmesi"><Range value={s.autoHideDelayMs} min={0} max={3000} step={100} unit=" ms" onChange={(autoHideDelayMs) => set({ autoHideDelayMs })} /></Field>
      <Field label="Tam ekranda gizle" hint="Oyun ve video tam ekranda dock görünmez">
        <Toggle label="Tam ekranda gizle" value={s.hideInFullscreen} onChange={(hideInFullscreen) => set({ hideInFullscreen })} />
      </Field>
    </>
  )
}

function DisplayTab({ s, set }: { s: DockSettings; set: Update }) {
  const [displays] = useRemote('displays:list', [])
  const monitorOptions: [string, string][] = [
    ['primary', 'Ana monitör'],
    ['all', 'Tüm monitörler'],
    ...(displays ?? []).map((d): [string, string] => [String(d.id), `Monitör ${d.label}${d.primary ? ' (ana)' : ''}`]),
  ]
  const current = typeof s.monitor === 'number' ? String(s.monitor) : s.monitor
  return (
    <>
      <h2>Ekran</h2>
      <Field label="Monitör" hint="Birden çok monitörde her birine bir dock konabilir">
        <Select value={current} options={monitorOptions} onChange={(v) => set({ monitor: v === 'primary' || v === 'all' ? v : Number(v) })} />
      </Field>
      <Field label="Arka plan malzemesi" hint="Windows 11: sistemin bulanık cam efekti">
        <Select value={s.material} onChange={(material) => set({ material })} options={[['none', 'Tema camı'], ['acrylic', 'Akrilik'], ['mica', 'Mica']]} />
      </Field>
    </>
  )
}

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
      <div className="cards">
        {type === 'icons' && (
          <div className="card" data-active={activeId === ''}>
            <div className="card__title">Sistem simgeleri</div>
            <div className="card__meta">Windows'un kendi simgeleri</div>
            <div className="card__actions"><button className="btn" onClick={() => onUse('')}>Kullan</button></div>
          </div>
        )}
        {list.map((p) => (
          <div key={p.id} className="card" data-active={activeId === p.id}>
            <div className="card__title">{p.name}</div>
            <div className="card__meta">{p.builtin ? 'Hazır' : p.author ?? 'Bilinmeyen yazar'}{p.version ? ` · ${p.version}` : ''}</div>
            <div className="card__actions">
              <button className="btn" onClick={() => onUse(p.id)}>Kullan</button>
              <button className="btn" onClick={() => act(() => invoke('packs:export', p.id), 'Dışa aktarıldı')}>Dışa aktar</button>
              {!p.builtin && <button className="btn btn--danger" onClick={() => invoke('packs:remove', p.id).then(onChanged)}>Sil</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button className="btn btn--accent" onClick={() => act(() => invoke('packs:import'), 'İçe aktarıldı')}>Paket içe aktar (.flypack)</button>
      </div>
      {message && <div className={`message${message.error ? ' message--error' : ''}`}>{message.text}</div>}
    </>
  )
}

function ThemeTab({ s, set }: { s: DockSettings; set: Update }) {
  const [packs, setPacks] = useRemote('packs:list', [], 'themes:changed')
  const refresh = () => invoke('packs:list').then(setPacks)
  const [swatches, setSwatches] = useState<Record<string, ThemeDef['vars']>>({})
  useEffect(() => {
    ;(packs ?? []).filter((p) => p.type === 'theme').forEach((p) => invoke('themes:get', p.id).then((t) => t && setSwatches((cur) => ({ ...cur, [p.id]: t.vars }))))
  }, [packs])
  return (
    <>
      <h2>Tema ve simgeler</h2>
      <h3>Temalar</h3>
      <PackCards packs={packs ?? []} activeId={s.theme} onUse={(theme) => set({ theme })} type="theme" onChanged={refresh} />
      <div className="swatches">
        {swatches[s.theme] && [swatches[s.theme].surface, swatches[s.theme].accent, swatches[s.theme].indicator, swatches[s.theme].panelBg].map((c, i) => <i key={i} style={{ background: c }} />)}
      </div>
      <h3>Simge paketleri</h3>
      <PackCards packs={packs ?? []} activeId={s.iconPack} onUse={(iconPack) => set({ iconPack })} type="icons" onChanged={refresh} />
    </>
  )
}

function ItemsTab() {
  const [items, setItems] = useRemote('items:get', [], 'items:changed', (p) => p)
  const [icons, setIcons] = useState<Record<string, string>>({})
  useEffect(() => {
    ;(items ?? []).filter((i) => i.type !== 'separator').forEach((i) => invoke('items:icon', i.id).then((src) => src && setIcons((cur) => ({ ...cur, [i.id]: src }))))
  }, [items])
  const update = (id: string, patch: Partial<DockItem>) => invoke('items:update', id, patch).then(setItems)
  return (
    <>
      <h2>Öğeler</h2>
      <p className="about">Simgeleri dock üzerinde sürükleyerek sıralayabilir, dock'a dosya, program ya da klasör bırakarak ekleyebilirsin. Buradan ad ve kısayol düzenlenir.</p>
      <div className="list">
        {(items ?? []).filter((i) => i.type !== 'separator' && i.type !== 'trash').map((item) => (
          <div className="list__row" key={item.id}>
            {icons[item.id] ? <img src={icons[item.id]} alt="" /> : <span />}
            <input className="input" type="text" defaultValue={item.label ?? ''} onBlur={(e) => e.target.value !== (item.label ?? '') && update(item.id, { label: e.target.value })} />
            <input className="input" type="text" placeholder="Kısayol (ör. Ctrl+Alt+1)" defaultValue={item.hotkey ?? ''}
              onBlur={(e) => e.target.value !== (item.hotkey ?? '') && update(item.id, { hotkey: e.target.value.trim() || undefined })} />
            <button className="btn btn--danger" onClick={() => invoke('items:remove', item.id).then(setItems)}>Kaldır</button>
          </div>
        ))}
        {(items ?? []).filter((i) => i.type !== 'separator' && i.type !== 'trash').length === 0 && <div className="about">Dock'ta henüz öğe yok. Bir programı dock'a sürükleyip bırak.</div>}
      </div>
    </>
  )
}

const WIDGET_NAMES: Record<WidgetType, string> = { clock: 'Saat', weather: 'Hava durumu', system: 'CPU / RAM / Disk', media: 'Medya', calendar: 'Takvim' }

function WidgetsTab() {
  const [widgets, setWidgets] = useRemote('widgets:list', [], 'widgets:changed', (p) => p)
  return (
    <>
      <h2>Widget'lar</h2>
      <p className="about">Widget'lar masaüstünde serbest pencereler olarak durur; sürükleyerek yerini değiştirebilirsin.</p>
      <div className="row-actions">
        {(Object.keys(WIDGET_NAMES) as WidgetType[]).map((type) => (
          <button key={type} className="btn" onClick={() => invoke('widgets:add', type).then(setWidgets)}>+ {WIDGET_NAMES[type]}</button>
        ))}
      </div>
      <div className="list">
        {(widgets ?? []).map((w) => (
          <div className="list__row" key={w.id} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <strong>{WIDGET_NAMES[w.type]}</strong>
            {w.type === 'weather' ? (
              <input className="input" type="text" placeholder="Şehir" defaultValue={String(w.options.city ?? '')} onBlur={(e) => invoke('widgets:update', w.id, { city: e.target.value.trim() || 'Istanbul' }).then(setWidgets)} />
            ) : w.type === 'clock' ? (
              <label><input type="checkbox" checked={!!w.options.seconds} onChange={(e) => invoke('widgets:update', w.id, { seconds: e.target.checked }).then(setWidgets)} /> Saniye göster</label>
            ) : <span />}
            <button className="btn btn--danger" onClick={() => invoke('widgets:remove', w.id).then(setWidgets)}>Kaldır</button>
          </div>
        ))}
      </div>
    </>
  )
}

function GeneralTab({ s, set }: { s: DockSettings; set: Update }) {
  const [info] = useRemote('app:info', [])
  return (
    <>
      <h2>Genel</h2>
      <Field label="Windows ile başlat"><Toggle label="Windows ile başlat" value={s.launchAtLogin} onChange={(launchAtLogin) => set({ launchAtLogin })} /></Field>
      <Field label="Dock'u göster / gizle kısayolu" hint="Electron biçimi: Control+Alt+D">
        <input className="input" type="text" defaultValue={s.toggleHotkey} onBlur={(e) => e.target.value !== s.toggleHotkey && set({ toggleHotkey: e.target.value.trim() })} />
      </Field>
      <h3>Hakkında</h3>
      <div className="about">
        <strong>{info?.name}</strong> {info?.version && `v${info.version}`}<br />
        {info?.tagline}<br />
        Ücretsiz ve açık kaynak (GPLv3). Beğendiysen geliştirmeyi destekleyebilirsin.
      </div>
      <div className="row-actions">
        <button className="btn btn--accent" onClick={() => invoke('app:open-external', 'support')}>Ko-fi'de destek ol</button>
        <button className="btn" onClick={() => invoke('app:open-external', 'repo')}>Kaynak kodu</button>
        <button className="btn" onClick={() => invoke('app:open-external', 'issues')}>Sorun bildir</button>
        <button className="btn btn--danger" onClick={() => invoke('app:quit')}>Uygulamadan çık</button>
      </div>
    </>
  )
}

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>('dock')
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [info] = useRemote('app:info', [])
  useEffect(() => {
    invoke('settings:get').then(setSettings)
  }, [])
  useEvent('settings:changed', setSettings)
  useActiveTheme(settings?.theme)

  const set: Update = (partial) => {
    setSettings((cur) => (cur ? { ...cur, ...partial } : cur))
    invoke('settings:update', partial)
  }

  if (!settings) return null
  return (
    <>
      <nav className="settings__nav" role="tablist">
        <div className="settings__brand">{info?.name}<small>{info?.tagline}</small></div>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="settings__tab" onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      <main className="settings__body">
        {tab === 'dock' && <DockTab s={settings} set={set} />}
        {tab === 'display' && <DisplayTab s={settings} set={set} />}
        {tab === 'theme' && <ThemeTab s={settings} set={set} />}
        {tab === 'items' && <ItemsTab />}
        {tab === 'widgets' && <WidgetsTab />}
        {tab === 'general' && <GeneralTab s={settings} set={set} />}
      </main>
    </>
  )
}
