// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { CursorPackInfo, CursorStatus, DockSettings } from '@/shared/types'
import { Card, Cards, Message, Pages, Row } from '../ui'
import { Frame } from '../previews'

import { t } from '../../i18n'
// ---- Cursors ----

type Role = CursorPackInfo['roles'][number]

export function CursorsTab({ s }: { s: DockSettings }) {
  const [packs] = useRemote('cursors:list', [], 'cursors:changed')
  const [status, setStatus] = useState<CursorStatus>({ active: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null)
  const [newName, setNewName] = useState('')
  const [picked, setPicked] = useState('')
  useEffect(() => {
    invoke('cursors:status').then(setStatus)
  }, [])
  const active = status.active || (busy ? s.cursorPack : '')
  const shown = packs?.find((p) => p.id === picked) ?? packs?.find((p) => p.id === active) ?? packs?.[0]
  const editable = !!shown && !shown.builtin
  const choose = async (id: string) => {
    setPicked(id)
    if (!id) {
      setBusy(true)
      setStatus(await invoke('cursors:apply', id))
      setBusy(false)
      return
    }
    setBusy(true)
    setStatus(await invoke('cursors:apply', id))
    setBusy(false)
  }
  const report = (r: { ok: boolean; message: string } | undefined) => {
    if (r && r.message && r.message !== 'cancelled') setNote({ text: r.message, error: !r.ok })
    else setNote(null)
  }
  const peek = (id: string) => packs?.find((p) => p.id === id)?.roles.filter((r) => r.has && ['arrow', 'link', 'text', 'move'].includes(r.role)) ?? []

  const create = async (copyOf?: string) => {
    const made = await invoke('cursors:create', newName.trim() || t('Yeni imleç paketim'), copyOf)
    setNewName('')
    setPicked(made.id)
    setNote(null)
  }
  const importFrom = async (fn: 'cursors:import-file' | 'cursors:import-folder') => {
    const r = await invoke(fn)
    report(r)
    if (r.pack) setPicked(r.pack.id)
  }
  const remove = async () => {
    if (!shown) return
    if (await invoke('cursors:remove', shown.id)) setPicked('')
  }
  const exportPack = async () => shown && report(await invoke('cursors:export', shown.id))
  const setRole = async (role: string, strip: boolean) => shown && report(await invoke('cursors:set-role', shown.id, role, strip))

  return (
    <Pages id="cursors">
      <Card icon="cursor" tab={t('Paketler')} title={t('İmleç paketi')} hint={t('Seçtiğin paketin imleçleri fare okunun, elin, yazı imlecinin ve diğerlerinin yerine geçer. Yalnızca bu Windows oturumunda geçerlidir; uygulamayı kapatınca kendi imleçlerin geri gelir.')}>
        <Cards<string> size="m" value={shown && active ? shown.id : active} onChange={choose} options={[
          { id: '', label: t('Windows’un kendi imleçleri'), hint: t('Hiçbir şey değişmez'), preview: <Frame><span className="cp-peek"><i className="cp-plain" /></span></Frame> },
          ...(packs ?? []).map((p) => ({
            id: p.id,
            label: p.name,
            hint: p.author ? t('{length} imleç · {author}', { length: p.roles.filter((r) => r.has).length, author: p.author }) : t('{length} imleç', { length: p.roles.filter((r) => r.has).length }),
            preview: <Frame><span className="cp-peek">{peek(p.id).map((r) => <img key={r.role} src={r.image} alt="" />)}</span></Frame>,
          })),
        ]} />
        {status.message && <Message text={status.message} error />}
        {active && <p className="st-prose">“{packs?.find((p) => p.id === active)?.name}{t('” şu an çalışıyor. Başka bir pencerenin üstüne gelince imleçlerin değiştiğini göreceksin.')}</p>}
      </Card>

      <Card icon="plus" tab={t('Paketler')} title={t('Paket ekle')} hint={t('Boş bir paket aç, hazır bir paketin kopyasını al ya da başkasının paketini içe aktar.')}>
        <Row label={t('Paket adı')}>
          <input className="st-input" type="text" value={newName} placeholder={t('Yeni imleç paketim')} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Row>
        <div className="st-row-inline">
          <button className="st-btn st-btn--accent" onClick={() => create()}><Icon name="plus" size={15} />{t('Boş paket oluştur')}</button>
          {shown && <button className="st-btn" onClick={() => create(shown.id)}><Icon name="copy" size={15} />{t('Seçilenin kopyasını oluştur')}</button>}
          <button className="st-btn" onClick={() => importFrom('cursors:import-file')}><Icon name="download" size={15} />{t('Paket dosyası içe aktar…')}</button>
          <button className="st-btn" onClick={() => importFrom('cursors:import-folder')}><Icon name="folder" size={15} />{t('Klasörden içe aktar…')}</button>
        </div>
        {note && <Message text={note.text} error={note.error} />}
      </Card>

      {shown && (
        <Card icon="image" tab={t('Paketler')} title={t('Pakette neler var')} hint={editable ? t('Her imleç için bir resim seç. Resimler PNG olmalı ve kare olmalı; pakette olmayan imleçlerde Windows’un kendi imleci kullanılır.') : t('Bu paket uygulamayla gelir; değiştirilemez. Kopyasını oluşturup kopyayı düzenleyebilirsin.')}>
          {editable && (
            <div className="st-row-inline">
              <input className="st-input" type="text" key={shown.id} defaultValue={shown.name} aria-label={t('Paket adı')} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== shown.name && invoke('cursors:rename', shown.id, e.target.value.trim())} />
              <button className="st-btn" onClick={exportPack}><Icon name="upload" size={15} />{t('Dışa aktar')}</button>
              <button className="st-btn st-btn--danger" onClick={remove}><Icon name="trash" size={15} />{t('Sil')}</button>
            </div>
          )}
          {!editable && <div className="st-row-inline"><button className="st-btn st-btn--accent" onClick={() => create(shown.id)}><Icon name="copy" size={15} />{t('Kopyasını oluştur ve düzenle')}</button><button className="st-btn" onClick={exportPack}><Icon name="upload" size={15} />{t('Dışa aktar')}</button></div>}
          <div className="cp-grid">
            {shown.roles.filter((r) => editable || r.has).map((r) => (
              <RoleTile key={r.role} pack={shown} role={r} editable={editable} onPick={setRole} />
            ))}
          </div>
        </Card>
      )}
    </Pages>
  )
}

function RoleTile({ pack, role: r, editable, onPick }: { pack: CursorPackInfo; role: Role; editable: boolean; onPick: (role: string, strip: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const hot = (axis: 0 | 1) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = Math.max(0, Math.min(255, Math.round(Number(e.target.value) || 0)))
    const next: [number, number] = [...r.hotspot]
    next[axis] = v
    invoke('cursors:role-options', pack.id, r.role, { hotspot: next })
  }
  return (
    <figure>
      <span>{r.has ? <img src={r.image} alt="" /> : <em className="cp-empty">{t('Windows’un')}</em>}</span>
      <figcaption>{r.label}{r.animated ? ` · ${t('hareketli')}` : ''}</figcaption>
      {editable && (
        <div className="cp-actions">
          <button className="st-btn " onClick={() => onPick(r.role, false)} title={t('Resim seç…')}><Icon name="image" size={13} />{r.has ? t('Değiştir') : t('Resim seç')}</button>
          <button className="st-btn " onClick={() => onPick(r.role, true)} title={t('Hareketli şerit (yan yana kareler)')}><Icon name="play" size={13} /></button>
          {r.has && <button className="st-btn " onClick={() => invoke('cursors:clear-role', pack.id, r.role)} title={t('Kaldır')}><Icon name="cross" size={13} /></button>}
          {r.has && <button className="st-btn " onClick={() => setOpen(!open)} title={t('Ayrıntılar')}><Icon name="settings" size={13} /></button>}
        </div>
      )}
      {editable && r.has && open && (
        <div className="cp-detail">
          <label>{t('Tıklama noktası')}<span><input className="st-input" type="number" min={0} max={255} defaultValue={r.hotspot[0]} onBlur={hot(0)} /><input className="st-input" type="number" min={0} max={255} defaultValue={r.hotspot[1]} onBlur={hot(1)} /></span></label>
          {r.animated && <label>{t('Kare hızı')}<input className="st-input" type="number" min={1} max={60} defaultValue={r.fps} onBlur={(e) => invoke('cursors:role-options', pack.id, r.role, { fps: Math.max(1, Math.min(60, Math.round(Number(e.target.value) || r.fps))) })} /></label>}
        </div>
      )}
    </figure>
  )
}
