import { useEffect, useState } from 'react'
import { invoke, useRemote } from '@/api'
import { CursorStatus, DockSettings } from '@/shared/types'
import { Card, Cards, Message, Pages } from '../ui'
import { Frame } from '../previews'

// ---- Cursors ----

export function CursorsTab({ s }: { s: DockSettings }) {
  const [packs] = useRemote('cursors:list', [])
  const [status, setStatus] = useState<CursorStatus>({ active: '', message: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    invoke('cursors:status').then(setStatus)
  }, [])
  const active = status.active || (busy ? s.cursorPack : '')
  const choose = async (id: string) => {
    setBusy(true)
    setStatus(await invoke('cursors:apply', id))
    setBusy(false)
  }
  const shown = packs?.find((p) => p.id === active) ?? packs?.[0]
  const peek = (id: string) => packs?.find((p) => p.id === id)?.roles.filter((r) => ['arrow', 'link', 'text', 'move'].includes(r.role)) ?? []
  return (
    <Pages id="cursors">
      <Card icon="cursor" tab="Paketler" title="İmleç paketi" hint="Seçtiğin paketin imleçleri fare okunun, elin, yazı imlecinin ve diğerlerinin yerine geçer. Yalnızca bu Windows oturumunda geçerlidir; uygulamayı kapatınca kendi imleçlerin geri gelir.">
        <Cards<string> size="m" value={active} onChange={choose} options={[
          { id: '', label: 'Windows’un kendi imleçleri', hint: 'Hiçbir şey değişmez', preview: <Frame><span className="cp-peek"><i className="cp-plain" /></span></Frame> },
          ...(packs ?? []).map((p) => ({
            id: p.id,
            label: p.name,
            hint: `${p.roles.length} imleç · ${p.author}`,
            preview: <Frame><span className="cp-peek">{peek(p.id).map((r) => <img key={r.role} src={r.image} alt="" />)}</span></Frame>,
          })),
        ]} />
        {status.message && <Message text={status.message} error />}
        {active && <p className="st-prose">“{shown?.name}” şu an çalışıyor. Başka bir pencerenin üstüne gelince imleçlerin değiştiğini göreceksin.</p>}
      </Card>
      {shown && (
        <Card icon="image" tab="Paketler" title="Pakette neler var" hint="Pakette olmayan imleçlerde Windows’un kendi imleci kullanılır.">
          <div className="cp-grid">
            {shown.roles.map((r) => (
              <figure key={r.role}>
                <span><img src={r.image} alt="" /></span>
                <figcaption>{r.label}{r.animated ? ' · hareketli' : ''}</figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}
    </Pages>
  )
}
