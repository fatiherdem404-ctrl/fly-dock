import { useEffect, useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import WheelGlyph from '@/components/WheelGlyph'
import IconLibrary from '@/components/IconLibrary'
import { Card, Row, Message } from '../ui'

type Picked = { path: string; preview: string }

export function PackBuilder({ onMade }: { tab?: string; onMade: (id: string) => void }) {
  const [keys] = useRemote('builder:keys', [])
  const [wheel] = useRemote('wheel:list', [])
  const [current, setCurrent] = useState<Record<string, string>>({})
  const [chosen, setChosen] = useState<Record<string, Picked>>({})
  const [active, setActive] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const count = Object.keys(chosen).length
  const row = active ?? keys?.[0]?.key ?? null

  useEffect(() => {
    ;(keys ?? []).forEach((k) => k.itemId && invoke('items:icon', k.itemId).then((src) => src && setCurrent((cur) => ({ ...cur, [k.key]: src }))))
  }, [keys])

  const assign = async (file: string, preview?: string) => {
    if (!row || !keys) return
    const shown = preview ?? (await invoke('library:thumb', file))
    if (!shown) return setMessage({ text: 'Bu resim okunamadı ya da çok büyük (en çok 2 MB).', error: true })
    setChosen((cur) => ({ ...cur, [row]: { path: file, preview: shown } }))
    const i = keys.findIndex((k) => k.key === row)
    setActive(keys[i + 1]?.key ?? row)
    setMessage(null)
  }
  const fromFolder = async () => {
    const got = await invoke('builder:folder', (keys ?? []).map((k) => k.key))
    const n = Object.keys(got).length
    setChosen((cur) => ({ ...cur, ...got }))
    setMessage({ text: n ? `${n} simge eşleşti.` : 'Bu klasörde öğelerle aynı adlı resim bulunamadı (ör. chrome.png, folder.png, wheel-apps.png).', error: n === 0 })
  }
  const create = async () => {
    const map = Object.fromEntries(Object.entries(chosen).map(([k, v]) => [k, v.path]))
    const r = await invoke('builder:create', name, author, map)
    setMessage({ text: r.ok ? `"${r.message}" oluşturuldu ve kullanılıyor. Dışa aktarmak için Simge paketleri sekmesindeki listeyi kullan.` : r.message, error: !r.ok })
    if (r.ok && r.pack) onMade(r.pack.id)
  }
  const glyph = (k: { key: string; wheelId?: string }) => {
    if (chosen[k.key]) return <img src={chosen[k.key].preview} alt="" />
    if (k.wheelId) {
      const e = wheel?.entries.find((w) => w.id === k.wheelId)
      return e ? <WheelGlyph entry={e} size={28} /> : <Icon name="image" size={16} />
    }
    return current[k.key] ? <img src={current[k.key]} alt="" /> : <Icon name="image" size={16} />
  }
  return (
    <Card title="Paket oluştur" hint="Soldan bir öğe seç, sağdaki kütüphaneden simgesine tıkla; sıradaki öğeye kendiliğinden geçer. Kütüphaneye simge klasörü ekleyebilir ya da tek tek resim seçebilirsin. Simgeler dock'tan da değiştirilebilir: bir öğeye sağ tıkla, 'Simge değiştir'.">
      <div className="st-builder">
        <div className="st-builder__items">
          {(keys ?? []).map((k) => (
            <button key={k.key} className="st-builder__item" aria-pressed={row === k.key} onClick={() => setActive(k.key)}>
              <span className="st-builder-thumb">{glyph(k)}</span>
              <span className="st-builder__label">{k.label}{chosen[k.key] && <i className="st-builder__done" />}</span>
              {chosen[k.key] && <span className="st-builder__clear" role="button" aria-label="Seçimi kaldır" onClick={(e) => { e.stopPropagation(); setChosen((cur) => { const { [k.key]: _gone, ...rest } = cur; return rest }) }}>×</span>}
            </button>
          ))}
        </div>
        <div className="st-builder__lib"><IconLibrary onPick={assign} selected={row ? chosen[row]?.path : null} /></div>
      </div>
      <div className="st-row-inline">
        <button className="st-btn" onClick={fromFolder}><Icon name="folder" size={15} />Adlarına göre klasörden dağıt…</button>
        {count > 0 && <button className="st-btn" onClick={() => setChosen({})}><Icon name="refresh" size={15} />Seçimleri temizle</button>}
      </div>
      <Row label="Paket adı"><input className="st-input" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Benim simgelerim" /></Row>
      <Row label="Yapımcı" hint="İstersen boş bırak"><input className="st-input" type="text" value={author} maxLength={60} onChange={(e) => setAuthor(e.target.value)} /></Row>
      <div className="st-row-inline"><button className="st-btn st-btn--accent" disabled={count === 0 || !name.trim()} onClick={create}><Icon name="download" size={15} />Paketi oluştur ve kullan ({count})</button></div>
      {message && <Message text={message.text} error={message.error} />}
    </Card>
  )
}
