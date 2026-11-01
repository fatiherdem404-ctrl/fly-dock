import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/icons'
import { CustomGlyph, parseGlyph } from '@/studio/custom'
import { Message, Segmented } from './ui'

/** What a card uses for its picture: a Lucide glyph by name, or pasted SVG. `null` means the key's own default. */
export type GlyphChoice = { lucide: string } | { custom: CustomGlyph } | null

const MAX_SHOWN = 240
const svgOf = (art: string, filled: boolean) =>
  `<svg viewBox="0 0 24 24" ${filled ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${art}</svg>`

/** Pick another picture for one card: from the Lucide library, or by pasting SVG code (Tabler and others). */
export function GlyphPicker({ title, current, onPick, onClose }: { title: string; current: GlyphChoice; onPick: (g: GlyphChoice) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'lucide' | 'svg'>(current && 'custom' in current ? 'svg' : 'lucide')
  const [query, setQuery] = useState('')
  const [lib, setLib] = useState<Record<string, string> | null>(null)
  const [code, setCode] = useState('')
  useEffect(() => {
    let live = true
    import('@/studio/lucide.generated').then((m) => live && setLib(m.LUCIDE))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const found = useMemo(() => {
    if (!lib) return []
    const q = query.trim().toLowerCase().replace(/\s+/g, '-')
    return Object.keys(lib).filter((n) => !q || n.includes(q)).slice(0, MAX_SHOWN)
  }, [lib, query])
  const parsed = useMemo(() => (code.trim() ? parseGlyph(code) : null), [code])

  return createPortal(
    <div className="wl-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wl-dialog gp" role="dialog" aria-modal="true" aria-label="Simge seç">
        <header>
          <h3>“{title}” için simge seç</h3>
          <button className="wl-tool" onClick={onClose} aria-label="Kapat"><Icon name="close" size={16} /></button>
        </header>
        <div className="gp__body">
          <div className="gp__bar">
            <Segmented value={tab} onChange={setTab} options={[['lucide', 'Lucide kütüphanesi'], ['svg', 'SVG kodu yapıştır']]} />
            {tab === 'lucide' && <input className="st-input" autoFocus placeholder={lib ? `${Object.keys(lib).length} simge içinde ara (örn. trash, mail, camera)` : 'Yükleniyor…'} value={query} onChange={(e) => setQuery(e.target.value)} />}
          </div>
          {tab === 'lucide' ? (
            <div className="gp__grid">
              {found.map((n) => (
                <button key={n} title={n} className={current && 'lucide' in current && current.lucide === n ? 'is-on' : ''} onClick={() => onPick({ lucide: n })}>
                  <span dangerouslySetInnerHTML={{ __html: svgOf(lib![n], false) }} />
                  <small>{n}</small>
                </button>
              ))}
              {lib && found.length === 0 && <p className="st-prose">Bu ada uyan simge yok. İngilizce ara: “folder”, “music”, “heart”…</p>}
            </div>
          ) : (
            <div className="gp__svg">
              <textarea className="wl-code" spellCheck={false} value={code} placeholder={'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>'} onChange={(e) => setCode(e.target.value)} />
              <div className="gp__side">
                <div className="gp__preview">{parsed && !('error' in parsed) ? <span dangerouslySetInnerHTML={{ __html: svgOf(parsed.art, parsed.filled) }} /> : <small>Önizleme</small>}</div>
                {parsed && 'error' in parsed && <Message error text={parsed.error} />}
                <p className="st-prose">Tabler, Lucide, Feather, Heroicons ya da Font Awesome’dan kopyaladığın SVG kodunu yapıştır. Yalnızca çizim şekilleri alınır; renkleri stüdyo kendi verir.</p>
                <button className="st-btn st-btn--accent" disabled={!parsed || 'error' in parsed} onClick={() => parsed && !('error' in parsed) && onPick({ custom: parsed })}>Bu simgeyi kullan</button>
              </div>
            </div>
          )}
        </div>
        <footer>
          <button className="st-btn" onClick={() => onPick(null)} disabled={!current}>Varsayılana dön</button>
          <span className="wl-spacer" />
          <button className="st-btn" onClick={onClose}>Kapat</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
