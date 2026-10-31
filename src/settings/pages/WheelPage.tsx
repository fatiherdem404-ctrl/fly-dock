import { invoke, useEvent, useRemote } from '@/api'
import Icon from '@/icons'
import WheelGlyph from '@/components/WheelGlyph'
import { Card, Switch } from '../ui'

export function WheelTab() {
  const [data, setData] = useRemote('wheel:list', [])
  useEvent('icons:changed', () => void invoke('wheel:list').then(setData))
  const save = (hidden: string[], order: string[]) => invoke('wheel:set', { hidden, order }).then(setData)
  if (!data) return null
  const order = data.entries.map((e) => e.id)
  const move = (i: number, by: number) => {
    const next = [...order]
    const j = i + by
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    save(data.hidden, next)
  }
  const add = (kind: 'file' | 'folder') => invoke('wheel:add', kind).then((d) => d && setData(d))
  return (
    <Card icon="settings" title="Çark menüsü" hint="Dock'a sağ tıklayıp 'Çark menüsü ekle' dersen bu liste açılır. Windows'un kendi araçlarını açıp kapatabilir, kendi program, dosya ve klasörlerini ekleyebilir, her birine istediğin simgeyi verebilirsin.">
      <div className="st-row-inline">
        <button className="st-btn st-btn--accent" onClick={() => add('file')}><Icon name="plus" size={15} />Program ya da dosya ekle…</button>
        <button className="st-btn" onClick={() => add('folder')}><Icon name="folder" size={15} />Klasör ekle…</button>
      </div>
      <div className="st-list">
        {data.entries.map((e, i) => (
          <div className="st-list__row st-list__row--wheel" key={e.id}>
            <span className="st-wheel-icon"><WheelGlyph entry={e} size={e.iconFile || e.path || e.packIcon ? 28 : 18} /></span>
            <span>{e.name}<small className="st-muted"> · {e.category}</small></span>
            <div className="st-row-inline" style={{ margin: 0 }}>
              <button className="st-btn" aria-label="Simge seç" title="Simge seç" onClick={() => invoke('iconpick:show', `wheel:${e.id}`)}><Icon name="image" size={14} /></button>
              {e.iconFile && <button className="st-btn" aria-label="Simgeyi sıfırla" title="Varsayılan simge" onClick={() => invoke('iconpick:apply', `wheel:${e.id}`, null).then(() => invoke('wheel:list').then(setData))}><Icon name="refresh" size={14} /></button>}
              <button className="st-btn" aria-label="Yukarı" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrowUp" size={14} /></button>
              <button className="st-btn" aria-label="Aşağı" disabled={i === order.length - 1} onClick={() => move(i, 1)}><Icon name="arrowDown" size={14} /></button>
              {e.path && <button className="st-btn st-btn--danger" aria-label="Kaldır" title="Listeden kaldır" onClick={() => invoke('wheel:remove', e.id).then(setData)}><Icon name="trash" size={14} /></button>}
            </div>
            <Switch label={e.name} value={!data.hidden.includes(e.id)} onChange={(on) => save(on ? data.hidden.filter((h) => h !== e.id) : [...data.hidden, e.id], order)} />
          </div>
        ))}
      </div>
    </Card>
  )
}
