import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@/api'
import { STUDIO_KEYS } from '@/studio/keys'
import { DEFAULT_DESIGN, PATTERNS, TEMPLATES, Design, cardSvg, designFrom } from '@/studio/render'
import { rasterize } from '@/studio/raster'
import { GlyphPicker, GlyphChoice } from '../GlyphPicker'
import { Card, Message, Row, Segmented, Select, Slider, Switch, Update } from '../ui'

// ---- Icon studio (development builds only): design the cards and glyphs of a whole icon pack ----

const STORE = 'flydock.studio'
const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`${STORE}.${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(`${STORE}.${key}`, JSON.stringify(value))
  } catch {
    /* storage can be unavailable */
  }
}

/** Stands in for a program the pack has no picture for (Claude, WhatsApp…), to show how the card would carry its own icon. */
const SAMPLE_APP = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a5a"/><stop offset="1" stop-color="#d9482a"/></linearGradient></defs><circle cx="32" cy="32" r="28" fill="url(#a)"/><path d="M20 38c4 8 20 8 24 0M24 25v4M40 25v4" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>')

/** Marks for the studio to find a glyph again: the library name, or the pasted markup. */
async function artOf(choice: GlyphChoice): Promise<{ glyphArt?: string; glyphFilled?: boolean; glyphColored?: boolean }> {
  if (!choice) return {}
  if ('custom' in choice) return { glyphArt: choice.custom.art, glyphFilled: choice.custom.filled, glyphColored: choice.custom.colored }
  const { LUCIDE } = await import('@/studio/lucide.generated')
  return LUCIDE[choice.lucide] ? { glyphArt: LUCIDE[choice.lucide] } : {}
}

const GROUPS: [string, string, (k: string, i: number) => boolean][] = [
  ['main', 'Ana öğeler', (k, i) => !k.startsWith('wheel-') && !['belgeler', 'indirilenler', 'resimler', 'videolar'].includes(k) && i < 38],
  ['wheel', 'Kontrol paneli', (k) => k.startsWith('wheel-') || k === 'wheel'],
  ['apps', 'Programlar', (k, i) => i >= 38 && !k.startsWith('wheel-')],
]
const BACKDROPS: [string, string][] = [['dark', 'Koyu'], ['light', 'Açık'], ['check', 'Dama']]

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="st-color">
      <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} />
      <span className="st-muted">{value.slice(0, 7)}</span>
    </div>
  )
}

export function StudioTab({ set }: { set: Update }) {
  const [design, setDesign] = useState<Design>(() => ({ ...DEFAULT_DESIGN, ...read<Partial<Design>>('design', designFrom(TEMPLATES[0])) }))
  const [mine, setMine] = useState<{ name: string; design: Design }[]>(() => read('mine', []))
  const [group, setGroup] = useState('main')
  const [backdrop, setBackdrop] = useState('dark')
  const [name, setName] = useState('Benim paketim')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [use, setUse] = useState(true)
  const [fallback, setFallback] = useState(() => read('fallback', true))
  useEffect(() => write('fallback', fallback), [fallback])
  const newName = useRef('')
  const [picks, setPicks] = useState<Record<string, GlyphChoice>>(() => read('picks', {}))
  const [arts, setArts] = useState<Record<string, { glyphArt?: string; glyphFilled?: boolean; glyphColored?: boolean }>>({})
  const [extras, setExtras] = useState<{ key: string; label: string }[]>(() => read('extras', []))
  const [addKey, setAddKey] = useState('')
  const [addLabel, setAddLabel] = useState('')
  useEffect(() => write('extras', extras), [extras])
  const all = useMemo(() => [...STUDIO_KEYS, ...extras.map((e) => [e.key, e.label, 'app-window'] as [string, string, string])], [extras])
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => write('picks', picks), [picks])
  useEffect(() => {
    let live = true
    Promise.all(Object.entries(picks).map(async ([k, v]) => [k, await artOf(v)] as const)).then((rows) => live && setArts(Object.fromEntries(rows)))
    return () => {
      live = false
    }
  }, [picks])
  const d = (patch: Partial<Design>) => setDesign((cur) => ({ ...cur, ...patch }))
  useEffect(() => write('design', design), [design])

  const cards = useMemo(() => {
    const test = GROUPS.find(([id]) => id === group)![2]
    return all.map((x, idx) => [...x, idx] as [string, string, string, number]).filter(([k, , , idx]) => test(k, idx)).map(([key, label, glyph, idx], i) => ({ key, label, extra: idx >= STUDIO_KEYS.length, svg: cardSvg(design, glyph, { index: idx, badge: key === 'trash-full', uid: `s${i}`, ...arts[key] }) }))
  }, [design, group, arts, all])

  const make = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const images: Record<string, string> = {}
      for (let i = 0; i < all.length; i++) {
        const [key, , glyph] = all[i]
        images[key] = await rasterize(cardSvg(design, glyph, { index: i, badge: key === 'trash-full', uid: 'x', ...(await artOf(picks[key] ?? null)) }), 256)
      }
      const r = await invoke('studio:make-pack', name, 'İkon stüdyosu', images, fallback ? { ...design } : null)
      if (r.ok && r.pack) {
        if (use) set({ iconPack: r.pack.id })
        setMsg({ text: `“${r.pack.name}” paketi oluşturuldu${use ? ' ve kullanılıyor' : ''}: ${Object.keys(images).length} simge.` })
      } else setMsg({ text: r.message, error: true })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Paket oluşturulamadı', error: true })
    }
    setBusy(false)
  }

  const saveMine = () => {
    const n = newName.current.trim() || `Şablonum ${mine.length + 1}`
    const next = [...mine.filter((m) => m.name !== n), { name: n, design }]
    setMine(next)
    write('mine', next)
  }

  const num = (key: keyof Design, min: number, max: number, step = 1, unit = '') => (
    <Slider value={design[key] as number} min={min} max={max} step={step} unit={unit} onChange={(v) => d({ [key]: v } as Partial<Design>)} />
  )

  return (
    <div className="sd">
      <div className="sd__view">
        <div className="sd__bar">
          <Segmented value={group} onChange={setGroup} options={GROUPS.map(([id, label]) => [id, label] as [string, string])} />
          <Segmented value={backdrop} onChange={setBackdrop} options={BACKDROPS} />
        </div>
        <div className={`sd__grid sd__grid--${backdrop}`}>
          {cards.map((c) => (
            <figure key={c.key} className="sd__card" onClick={() => setEditing(c.key)} title="Simgeyi değiştirmek için tıkla">
              <span dangerouslySetInnerHTML={{ __html: c.svg }} />
              <figcaption>{c.label}{picks[c.key] ? ' ✎' : ''}{c.extra && <button className="sd__x" title="Bu programı listeden çıkar" onClick={(e) => { e.stopPropagation(); setExtras((cur) => cur.filter((x) => x.key !== c.key)) }}>✕</button>}</figcaption>
            </figure>
          ))}
          {group === 'apps' && (
            <form className="sd__add" onSubmit={(e) => {
              e.preventDefault()
              const key = addKey.trim().toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9._-]/g, '').slice(0, 40)
              if (!key || all.some(([k]) => k === key)) return
              setExtras((cur) => [...cur, { key, label: addLabel.trim() || key }])
              setAddKey('')
              setAddLabel('')
              setEditing(key)
            }}>
              <b>Kendi programını ekle</b>
              <input className="st-input" placeholder="exe adı, örn. claude" value={addKey} onChange={(e) => setAddKey(e.target.value)} />
              <input className="st-input" placeholder="Görünen ad (isteğe bağlı)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
              <button className="st-btn st-btn--accent" type="submit" disabled={!addKey.trim()}>Ekle ve simge seç</button>
              <small>Programın exe dosyasının adı (uzantısız) paketteki anahtarı olur. Simgesini Lucide’dan seçebilir ya da SVG kodu yapıştırabilirsin.</small>
            </form>
          )}
          {fallback && group === 'apps' && (
            <figure>
              <span dangerouslySetInnerHTML={{ __html: cardSvg(design, '', { appIcon: SAMPLE_APP, uid: 'smp' }) }} />
              <figcaption>Pakette olmayan program</figcaption>
            </figure>
          )}
        </div>
      </div>
      {editing && (
        <GlyphPicker
          title={all.find(([k]) => k === editing)?.[1] ?? editing}
          current={picks[editing] ?? null}
          onClose={() => setEditing(null)}
          onPick={(g) => {
            setPicks((cur) => {
              const next = { ...cur }
              if (g) next[editing] = g
              else delete next[editing]
              return next
            })
            setEditing(null)
          }}
        />
      )}
      <div className="sd__side">
        <Card icon="edit" title="Şablon" hint="Bir şablonla başla, sonra istediğin gibi değiştir.">
          <div className="sd__chips">
            {TEMPLATES.map((t) => <button key={t.id} className="st-btn" onClick={() => setDesign(designFrom(t))}>{t.name}</button>)}
            {mine.map((m) => (
              <button key={m.name} className="st-btn" onClick={() => setDesign({ ...DEFAULT_DESIGN, ...m.design })} title="Kendi şablonun">★ {m.name}</button>
            ))}
          </div>
          <div className="st-row-inline">
            <input className="st-input sd__name" placeholder="Şablon adı" onChange={(e) => (newName.current = e.target.value)} />
            <button className="st-btn" onClick={saveMine}>Şablonu kaydet</button>
          </div>
        </Card>
        <Card icon="desk" title="Kart">
          <Row label="Dolgu"><Segmented value={design.fill} onChange={(fill) => d({ fill })} options={[['solid', 'Düz'], ['gradient', 'Degrade'], ['none', 'Kartsız']]} /></Row>
          {design.fill !== 'none' && (
            <>
              <Row label="Renk"><Color value={design.c1} onChange={(c1) => d({ c1 })} /></Row>
              {design.fill === 'gradient' && <Row label="İkinci renk"><Color value={design.c2} onChange={(c2) => d({ c2 })} /></Row>}
              {design.fill === 'gradient' && <Row label="Degrade yönü">{num('angle', 0, 360, 5, '°')}</Row>}
              <Row label="Köşe yuvarlaklığı">{num('radius', 0, 100, 1, '%')}</Row>
              <Row label="Kenar boşluğu" hint="Kartın resim kenarından uzaklığı">{num('inset', 0, 48, 1, ' px')}</Row>
              <Row label="Desen"><Select value={design.pattern} onChange={(pattern) => d({ pattern })} options={PATTERNS} /></Row>
              {design.pattern !== 'none' && <Row label="Desen rengi"><Color value={design.patternColor} onChange={(patternColor) => d({ patternColor })} /></Row>}
              {design.pattern !== 'none' && <Row label="Desen yoğunluğu">{num('patternOpacity', 0.02, 0.6, 0.01)}</Row>}
            </>
          )}
        </Card>
        {design.fill !== 'none' && (
          <Card icon="maximize" title="Derinlik ve kenar">
            <Row label="3B kabartma" hint="Bir kenar ışık alır, karşısı gölgede kalır">{num('bevel', 0, 100, 1, '%')}</Row>
            <Row label="Işık yönü">{num('lightAngle', 0, 360, 5, '°')}</Row>
            <Row label="Parlak yüzey">{num('gloss', 0, 100, 1, '%')}</Row>
            <Row label="Çerçeve kalınlığı">{num('borderWidth', 0, 12, 0.5, ' px')}</Row>
            {design.borderWidth > 0 && <Row label="Çerçeve rengi"><Color value={design.borderColor} onChange={(borderColor) => d({ borderColor })} /></Row>}
            {design.borderWidth > 0 && <Row label="Çerçeve görünürlüğü">{num('borderOpacity', 0.05, 1, 0.05)}</Row>}
            <Row label="Gölge bulanıklığı">{num('shadowBlur', 0, 40, 1, ' px')}</Row>
            <Row label="Gölge aşağıda">{num('shadowY', 0, 30, 1, ' px')}</Row>
            <Row label="Gölge koyuluğu">{num('shadowOpacity', 0, 1, 0.05)}</Row>
            <Row label="Gölge rengi"><Color value={design.shadowColor} onChange={(shadowColor) => d({ shadowColor })} /></Row>
          </Card>
        )}
        <Card icon="image" title="Simge çizgisi">
          <Row label="Renk"><Segmented value={design.glyphMode} onChange={(glyphMode) => d({ glyphMode })} options={[['solid', 'Tek renk'], ['gradient', 'Degrade']]} /></Row>
          <Row label={design.glyphMode === 'solid' ? 'Çizgi rengi' : 'Başlangıç rengi'}><Color value={design.g1} onChange={(g1) => d({ g1 })} /></Row>
          {design.glyphMode === 'gradient' && <Row label="Bitiş rengi"><Color value={design.g2} onChange={(g2) => d({ g2 })} /></Row>}
          <Row label="Boyut">{num('glyphSize', 30, 92, 1, '%')}</Row>
          <Row label="Çizgi kalınlığı">{num('glyphStroke', 0.8, 3.6, 0.1)}</Row>
          <Row label="Çizgi gölgesi">{num('glyphShadow', 0, 100, 1, '%')}</Row>
          <Row label="Neon ışıma">{num('glyphGlow', 0, 100, 1, '%')}</Row>
          <Row label="Renk çeşitliliği" hint="Her simgenin rengi çarkta biraz ileri döner; 0 hepsini aynı yapar">{num('hueSpread', 0, 120, 1, '°')}</Row>
        </Card>
        <Card icon="pack" title="Paketi oluştur" hint={`${all.length} simge, 256 piksel PNG olarak ayrı bir simge paketine yazılır; sonra Simge paketleri sayfasından dışa aktarabilirsin.`}>
          <Row label="Paket adı"><input className="st-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Row>
          <Row label="Eksik programlara kart ekle" hint="Pakette resmi olmayan programların (Claude, WhatsApp…) kendi simgesi bu kartın içine konur. Önizlemesi Programlar sekmesinin sonunda"><Switch label="Eksik programlara kart ekle" value={fallback} onChange={setFallback} /></Row>
          {fallback && <Row label="Program simgesi boyutu">{num('appIconSize', 40, 90, 1, '%')}</Row>}
          <Row label="Oluşunca kullan"><Switch label="Oluşunca kullan" value={use} onChange={setUse} /></Row>
          <div className="st-row-inline">
            <button className="st-btn st-btn--accent" onClick={make} disabled={busy || !name.trim()}>{busy ? 'Üretiliyor…' : 'Paketi oluştur'}</button>
            <button className="st-btn" onClick={() => setDesign({ ...DEFAULT_DESIGN })}>Ayarları sıfırla</button>
          </div>
          {msg && <Message text={msg.text} error={msg.error} />}
        </Card>
      </div>
    </div>
  )
}
