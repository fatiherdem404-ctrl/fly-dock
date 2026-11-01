import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@/api'
import { STUDIO_KEYS } from '@/studio/keys'
import { DEFAULT_DESIGN, PATTERNS, TEMPLATES, Design, cardSvg, designFrom, rasterize } from '@/studio/render'
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

const indexOfKey = (k: string) => STUDIO_KEYS.findIndex(([x]) => x === k)
const GROUPS: [string, string, (k: string) => boolean][] = [
  ['main', 'Ana öğeler', (k) => !k.startsWith('wheel-') && !['belgeler', 'indirilenler', 'resimler', 'videolar'].includes(k) && indexOfKey(k) < 38],
  ['wheel', 'Kontrol paneli', (k) => k.startsWith('wheel-') || k === 'wheel'],
  ['apps', 'Programlar', (k) => indexOfKey(k) >= 38 && !k.startsWith('wheel-')],
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
  const newName = useRef('')
  const d = (patch: Partial<Design>) => setDesign((cur) => ({ ...cur, ...patch }))
  useEffect(() => write('design', design), [design])

  const cards = useMemo(() => {
    const test = GROUPS.find(([id]) => id === group)![2]
    return STUDIO_KEYS.filter(([k]) => test(k)).map(([key, label, glyph], i) => ({ key, label, svg: cardSvg(design, glyph, { index: indexOfKey(key), badge: key === 'trash-full', uid: `s${i}` }) }))
  }, [design, group])

  const make = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const images: Record<string, string> = {}
      for (let i = 0; i < STUDIO_KEYS.length; i++) {
        const [key, , glyph] = STUDIO_KEYS[i]
        images[key] = await rasterize(cardSvg(design, glyph, { index: i, badge: key === 'trash-full', uid: 'x' }), 256)
      }
      const r = await invoke('studio:make-pack', name, 'İkon stüdyosu', images)
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
            <figure key={c.key}>
              <span dangerouslySetInnerHTML={{ __html: c.svg }} />
              <figcaption>{c.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
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
        <Card icon="pack" title="Paketi oluştur" hint={`${STUDIO_KEYS.length} simge, 256 piksel PNG olarak ayrı bir simge paketine yazılır; sonra Simge paketleri sayfasından dışa aktarabilirsin.`}>
          <Row label="Paket adı"><input className="st-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Row>
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
