import { useEffect, useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { DockItem } from '@/shared/types'
import { Card } from '../ui'

export function ItemsTab() {
  const [items, setItems] = useRemote('items:get', [], 'items:changed', (p) => p)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const pinned = (items ?? []).filter((i) => i.type !== 'separator' && i.type !== 'trash' && !i.id.startsWith('run:'))
  useEffect(() => {
    pinned.forEach((i) => invoke('items:icon', i.id).then((src) => src && setIcons((cur) => ({ ...cur, [i.id]: src }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  const update = (id: string, patch: Partial<DockItem>) => invoke('items:update', id, patch).then(setItems)
  return (
    <Card icon="items" title="Sabit öğeler" hint="Dock'a dosya, program ya da klasör sürükleyip bırakarak ekleyebilirsin. Buradan ad ve kısayol düzenlenir.">
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
