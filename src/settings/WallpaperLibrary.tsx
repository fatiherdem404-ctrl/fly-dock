import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import SceneFrame, { SceneError } from '@/SceneFrame'
import { SCENE_TEMPLATES } from '@/sceneTemplates'
import type { WallpaperItem, WallpaperPicked } from '@/shared/types'
import { Message, Segmented } from './ui'

const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const KIND_NAME = { image: 'Resim', video: 'Video', scene: 'Kod sahnesi' } as const

/** A file name that is fit to show: no extension, separators turned into spaces, first letter up. */
export function niceName(file: string) {
  const base = file.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base ? base[0].toLocaleUpperCase('tr') + base.slice(1) : ''
}

function Thumb({ item, hover }: { item: WallpaperItem; hover: boolean }) {
  if (item.kind === 'scene') return <div className="wl-thumb"><SceneFrame code={item.code ?? ''} paused={!hover} /></div>
  if (!item.url) return <div className="wl-thumb wl-thumb--missing"><Icon name="image" size={22} /><span>Dosya bulunamadı</span></div>
  return (
    <div className="wl-thumb">
      {item.kind === 'video'
        ? <video src={`${item.url}#t=0.5`} muted loop playsInline preload="metadata" ref={(v) => { if (v) hover ? v.play().catch(() => {}) : v.pause() }} />
        : <img src={item.url} alt="" loading="lazy" />}
    </div>
  )
}

function ItemCard({ item, active, onUse, onEdit, onRemove }: { item: WallpaperItem; active: boolean; onUse: () => void; onEdit: () => void; onRemove: () => void }) {
  const [hover, setHover] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className={`wl-item${active ? ' is-active' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setConfirm(false) }}>
      <button className="wl-item__pick" onClick={onUse} aria-pressed={active} aria-label={`${item.name} duvar kâğıdı olarak kullan`}>
        <Thumb item={item} hover={hover} />
        {active && <span className="wl-badge"><Icon name="check" size={12} />Kullanımda</span>}
      </button>
      <div className="wl-item__meta">
        <b title={item.name}>{item.name}</b>
        <small>{KIND_NAME[item.kind]}{item.size ? ` · ${bytes(item.size)}` : ''}{item.author ? ` · ${item.author}` : ''}</small>
      </div>
      {confirm ? (
        <div className="wl-item__confirm">
          <span>Silinsin mi?</span>
          <button className="st-btn st-btn--danger" onClick={onRemove}>Sil</button>
          <button className="st-btn" onClick={() => setConfirm(false)}>Vazgeç</button>
        </div>
      ) : (
        <div className="wl-item__tools">
          <button className="wl-tool" onClick={onEdit} title="Adı ve bilgileri düzenle" aria-label="Düzenle"><Icon name="edit" size={14} /></button>
          <button className="wl-tool" onClick={() => setConfirm(true)} title="Kütüphaneden sil" aria-label="Sil"><Icon name="trash" size={14} /></button>
        </div>
      )}
    </div>
  )
}

export function Library({ current, onUse, legacyFile }: { current: string; onUse: (id: string | null, fallback?: string) => void; legacyFile: string }) {
  const [items] = useRemote('wallpaper:library', [], 'wallpaper:library-changed', undefined)
  const [dialog, setDialog] = useState<null | { item?: WallpaperItem; scene?: boolean; legacy?: boolean }>(null)
  const list = items ?? []
  return (
    <>
      <div className="wl-bar">
        <button className="st-btn st-btn--accent" onClick={() => setDialog({})}><Icon name="plus" size={15} />Duvar kâğıdı ekle…</button>
        <button className="st-btn" onClick={() => setDialog({ scene: true })}><Icon name="code" size={15} />Kendi sahneni yaz…</button>
      </div>
      {legacyFile && (
        <div className="wl-legacy">
          <Icon name="image" size={16} />
          <span>Şu an kullanılan dosya kütüphanede değil ve adı yok: <code>{legacyFile.split(/[\\/]/).pop()}</code></span>
          <button className="st-btn" onClick={() => setDialog({ legacy: true })}>Ad verip kütüphaneye ekle</button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="st-prose">Kütüphane boş. Resim ya da video ekleyebilir, istersen JavaScript ile kendi hareketli arka planını yazabilirsin; eklediklerin burada adıyla durur, istediğinde değiştirir ya da silersin.</p>
      ) : (
        <div className="wl-grid">
          {list.map((it) => (
            <ItemCard key={it.id} item={it} active={current === `lib:${it.id}`} onUse={() => onUse(it.id)} onEdit={() => setDialog({ item: it })} onRemove={() => invoke('wallpaper:remove', it.id)} />
          ))}
        </div>
      )}
      {dialog && (
        <WallpaperDialog
          {...dialog}
          legacyFile={legacyFile}
          onClose={() => setDialog(null)}
          onSaved={(item, use) => {
            setDialog(null)
            if (use) onUse(item.id)
          }}
        />
      )}
    </>
  )
}

interface DialogProps {
  item?: WallpaperItem
  scene?: boolean
  legacy?: boolean
  legacyFile: string
  onClose: () => void
  onSaved: (item: WallpaperItem, use: boolean) => void
}

function WallpaperDialog({ item, scene, legacy, legacyFile, onClose, onSaved }: DialogProps) {
  const editing = !!item
  const [tab, setTab] = useState<'file' | 'scene'>(item ? (item.kind === 'scene' ? 'scene' : 'file') : scene ? 'scene' : 'file')
  const [picked, setPicked] = useState<WallpaperPicked | null>(null)
  const [name, setName] = useState(item?.name ?? '')
  const [author, setAuthor] = useState(item?.author ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [code, setCode] = useState(item?.code ?? SCENE_TEMPLATES[0].code)
  const [applied, setApplied] = useState(code)
  const [error, setError] = useState<SceneError | null>(null)
  const [fail, setFail] = useState('')
  const [busy, setBusy] = useState(false)
  const [use, setUse] = useState(!editing)
  const nameTouched = useRef(editing)
  const area = useRef<HTMLTextAreaElement>(null)

  const choose = (p: WallpaperPicked) => {
    setPicked(p)
    if (!nameTouched.current) setName(niceName(p.fileName))
    setFail('')
  }
  const pick = async () => {
    const p = await invoke('wallpaper:pick-new')
    if (p) choose(p)
  }
  useEffect(() => {
    if (!legacy) return
    invoke('wallpaper:pick-new', legacyFile).then((p) => p && choose(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // the preview follows the code a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => setApplied(code), 450)
    return () => clearTimeout(t)
  }, [code])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isScene = editing ? item!.kind === 'scene' : tab === 'scene'
  const ready = name.trim().length > 0 && (editing || isScene ? code.trim().length > 0 : !!picked)

  const save = async () => {
    setBusy(true)
    setFail('')
    try {
      const saved = editing
        ? await invoke('wallpaper:edit', item!.id, { name, author, note, ...(isScene ? { code } : {}) })
        : await invoke('wallpaper:add', isScene ? { kind: 'scene', name, author, note, code } : { kind: picked!.kind, name, author, note, file: picked!.file })
      if (!saved) throw new Error('Kayıt bulunamadı')
      onSaved(saved, use)
    } catch (e) {
      setFail(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Kaydedilemedi')
      setBusy(false)
    }
  }

  const onCodeKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: a, selectionEnd: b } = el
    setCode(code.slice(0, a) + '  ' + code.slice(b))
    requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
  }

  return (
    <Portal><div className="wl-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`wl-dialog${isScene ? ' wl-dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-label={editing ? 'Duvar kâğıdını düzenle' : 'Duvar kâğıdı ekle'}>
        <header>
          <h3>{editing ? 'Duvar kâğıdını düzenle' : 'Duvar kâğıdı ekle'}</h3>
          <button className="wl-tool" onClick={onClose} aria-label="Kapat"><Icon name="close" size={16} /></button>
        </header>
        <div className="wl-dialog__body">
          <div className="wl-preview">
            <div className="wl-preview__stage">
              {isScene ? (
                <SceneFrame code={applied} onError={setError} />
              ) : picked ? (
                picked.kind === 'video' ? <video src={picked.url} autoPlay loop muted playsInline controls /> : <img src={picked.url} alt="" />
              ) : item?.url ? (
                item.kind === 'video' ? <video src={item.url} autoPlay loop muted playsInline controls /> : <img src={item.url} alt="" />
              ) : (
                <button className="wl-drop" onClick={pick}><Icon name="upload" size={26} /><b>Resim ya da video seç</b><small>jpg, png, webp, gif, bmp · mp4, webm</small></button>
              )}
            </div>
            {!isScene && picked && (
              <div className="wl-preview__info">
                <span>{picked.fileName} · {KIND_NAME[picked.kind]} · {bytes(picked.size)}</span>
                {!legacy && <button className="st-btn" onClick={pick}>Başka dosya…</button>}
              </div>
            )}
          </div>

          <div className="wl-form">
            {!editing && !legacy && (
              <Segmented<'file' | 'scene'> value={tab} onChange={setTab} options={[['file', 'Resim / video'], ['scene', 'Kod sahnesi']]} />
            )}
            <label className="wl-field">
              <span>Ad</span>
              <input className="st-input" value={name} maxLength={80} placeholder="Örneğin: Gece şehri" onChange={(e) => { nameTouched.current = true; setName(e.target.value) }} autoFocus />
            </label>
            <label className="wl-field">
              <span>Yapan <em>(isteğe bağlı)</em></span>
              <input className="st-input" value={author} maxLength={80} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <label className="wl-field">
              <span>Not <em>(isteğe bağlı)</em></span>
              <textarea className="st-input wl-note" value={note} maxLength={400} rows={2} onChange={(e) => setNote(e.target.value)} />
            </label>
            {isScene && (
              <div className="wl-field">
                <span className="wl-code-head">
                  Kod
                  {!editing && (
                    <select className="st-select wl-templates" value="" onChange={(e) => { const t = SCENE_TEMPLATES.find((x) => x.id === e.target.value); if (t) setCode(t.code) }} aria-label="Şablon">
                      <option value="" disabled>Şablondan başla…</option>
                      {SCENE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </span>
                <textarea ref={area} className="wl-code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onCodeKey} />
                {error ? (
                  <Message error text={`${error.line ? `Satır ${error.line}: ` : ''}${error.message}`} />
                ) : (
                  <small className="wl-help">Kod, dışarıya kapalı bir kutuda çalışır: dosyalara ya da uygulamaya erişemez. Sonuç solda canlı görünür.</small>
                )}
              </div>
            )}
          </div>
        </div>
        {fail && <Message error text={fail} />}
        <footer>
          <label className="st-check"><input type="checkbox" checked={use} onChange={(e) => setUse(e.target.checked)} />{editing ? 'Kaydedince bunu kullan' : 'Ekleyince duvar kâğıdı yap'}</label>
          <span className="wl-spacer" />
          <button className="st-btn" onClick={onClose}>Vazgeç</button>
          <button className="st-btn st-btn--accent" onClick={save} disabled={!ready || busy || (isScene && !!error)}>{busy ? 'Kaydediliyor…' : editing ? 'Kaydet' : 'Ekle'}</button>
        </footer>
      </div>
    </div></Portal>
  )
}

/** The dialog lives on the page itself: the cards animate with a transform, which would otherwise make "fixed" mean "inside the card". */
function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}
