import { useEffect, useMemo, useRef, useState } from 'react'
import logoUrl from '@/assets/logo.png'
import Icon, { IconName } from '@/icons'
import { SEARCH_INDEX, SearchEntry, TAB_INFO } from './nav'

interface Props {
  name: string
  pageLabel: string
  pageIcon: IconName
  onControl: (action: 'minimize' | 'maximize' | 'close') => void
  onJump: (entry: SearchEntry) => void
}

const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '')

/** The app's own title bar: brand, current page, a settings search, and the window buttons. The empty parts drag the window. */
export default function TitleBar({ name, pageLabel, pageIcon, onControl, onJump }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return SEARCH_INDEX.filter((r) => fold(`${r.label} ${r.words ?? ''} ${TAB_INFO[r.tab].label} ${r.sub ?? ''}`).includes(q)).slice(0, 8)
  }, [query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (entry: SearchEntry) => {
    onJump(entry)
    setQuery('')
    setOpen(false)
    input.current?.blur()
  }

  return (
    <header className="st-title">
      <div className="st-title__brand">
        <span className="st-title__logo"><img src={logoUrl} alt="" /></span>
        <b>{name}</b>
        <span className="st-title__crumb"><Icon name="arrowRight" size={12} /><Icon name={pageIcon} size={14} />{pageLabel}</span>
      </div>

      <div className="st-search" data-open={open && results.length > 0}>
        <Icon name="search" size={15} />
        <input
          ref={input}
          value={query}
          placeholder="Ayarlarda ara…  (Ctrl+F)"
          spellCheck={false}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && results[active]) pick(results[active])
            else if (e.key === 'Escape') { setQuery(''); input.current?.blur() }
          }}
        />
        {open && query.trim() && (
          <div className="st-search__results" role="listbox">
            {results.length === 0 && <div className="st-search__none">Eşleşen ayar yok</div>}
            {results.map((r, i) => (
              <button key={r.label} role="option" aria-selected={i === active} className="st-search__item" onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(r) }}>
                <Icon name={TAB_INFO[r.tab].icon} size={16} />
                <span>{r.label}</span>
                <small>{TAB_INFO[r.tab].label}{r.sub ? ` › ${r.sub}` : ''}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="st-title__buttons">
        <button aria-label="Küçült" title="Küçült" onClick={() => onControl('minimize')}><Icon name="minimize" size={16} /></button>
        <button className="st-title__close" aria-label="Kapat" title="Kapat" onClick={() => onControl('close')}><Icon name="cross" size={16} /></button>
      </div>
    </header>
  )
}
