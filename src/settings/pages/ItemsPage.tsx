// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { DockItem, PlaceInfo } from '@/shared/types'
import { Card } from '../ui'

/** The ready-made items (My Computer, Documents, Network…): one click puts one in the dock. */
function Places({ onAdded }: { onAdded: (items: DockItem[]) => void }) {
  const [places, setPlaces] = useState<PlaceInfo[]>([])
  const [icons, setIcons] = useState<Record<string, string>>({})
  const refresh = () => invoke('places:list').then(setPlaces)
  useEffect(() => {
    refresh()
    invoke('places:list').then((list) => list.forEach((p) => invoke('places:icon', p.id).then((src) => src && setIcons((cur) => ({ ...cur, [p.id]: src })))))
  }, [])
  const add = (id: string) => invoke('places:add', id).then((items) => { onAdded(items); refresh() })
  return (
    <Card icon="plus" title="Hazır öğeler" hint="Sık kullanılan yerleri tek tıkla dock’a ekle. Eklenenler aşağıdaki listeye düşer; adını, simgesini değiştirebilir ya da kaldırabilirsin.">
      <div className="st-places">
        {places.map((p) => (
          <button key={p.id} className="st-place" disabled={p.added} onClick={() => add(p.id)} title={p.added ? 'Dockta var' : 'Docka ekle'}>
            {icons[p.id] ? <img src={icons[p.id]} alt="" /> : <span />}
            <b>{p.label}</b>
            <small>{p.added ? 'Eklendi' : 'Ekle'}</small>
          </button>
        ))}
      </div>
    </Card>
  )
}

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
    <>
    <Places onAdded={setItems} />
    <Card icon="items" title="Sabit öğeler" hint="Dock’a dosya, program ya da klasör sürükleyip bırakarak ekleyebilirsin. Buradan ad ve kısayol düzenlenir.">
      <div className="st-list">
        {pinned.map((item) => (
          <div className="st-list__row" key={item.id}>
            {icons[item.id] ? <img src={icons[item.id]} alt="" /> : <span />}
            <input className="st-input" type="text" defaultValue={item.label ?? ''} onBlur={(e) => e.target.value !== (item.label ?? '') && update(item.id, { label: e.target.value })} />
            <input className="st-input" type="text" placeholder="Kısayol" title="Örnek: Ctrl+Alt+1" defaultValue={item.hotkey ?? ''} onBlur={(e) => e.target.value !== (item.hotkey ?? '') && update(item.id, { hotkey: e.target.value.trim() || undefined })} />
            <button className="st-btn st-btn--danger" onClick={() => invoke('items:remove', item.id).then(setItems)}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        {pinned.length === 0 && <p className="st-prose">Dock’ta henüz sabit öğe yok. Bir programı dock’a sürükleyip bırak.</p>}
      </div>
    </Card>
    </>
  )
}
