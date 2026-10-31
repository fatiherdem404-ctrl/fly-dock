import { useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import Icon from '@/icons'
import { initSound, playSound } from '@/sound'
import type { ConfirmRequest, DockSettings } from '@/shared/types'

/** The app's own confirmation window. Enter confirms, Esc cancels; dangerous questions default to Cancel. */
export default function ConfirmView() {
  const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const id = query.get('id') ?? ''
  const request: ConfirmRequest = (() => {
    try {
      return JSON.parse(query.get('q') ?? '{}')
    } catch {
      return { title: '', message: '' }
    }
  })()
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [closing, setClosing] = useState(false)
  const [text, setText] = useState(request.input?.value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    initSound()
    invoke('settings:get').then(setSettings)
    if (request.input) {
      inputRef.current?.focus()
      const dot = text.lastIndexOf('.')
      inputRef.current?.setSelectionRange(0, dot > 0 ? dot : text.length)
    } else (request.danger ? cancelRef : okRef).current?.focus()
    // the sound engine needs its settings first; a short wait keeps the opening chime from being skipped
    const t = setTimeout(() => playSound(request.danger ? 'warn' : 'confirmOpen'), 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useActiveTheme(settings?.theme)

  const answer = (yes: boolean) => {
    if (closing) return
    setClosing(true)
    playSound(yes ? 'accept' : 'cancel')
    setTimeout(() => invoke('confirm:answer', id, yes, request.input ? text : undefined), 140)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false)
      else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') answer(!request.danger)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="confirm-shell">
      <div className={`confirm${closing ? ' confirm--closing' : ''}${request.danger ? ' confirm--danger' : ''}`} role="alertdialog" aria-label={request.title}>
        <span className="confirm__icon"><Icon name={request.danger ? 'trash' : request.input ? 'edit' : 'check'} size={22} /></span>
        <div className="confirm__text">
          <h2>{request.title}</h2>
          <p>{request.message}</p>
          {request.input && <input ref={inputRef} className="confirm__input" value={text} maxLength={200} spellCheck={false} onChange={(e) => setText(e.target.value)} />}
        </div>
        <div className="confirm__buttons">
          <button ref={cancelRef} className="confirm__btn" onClick={() => answer(false)}>{request.cancelLabel ?? 'Vazgeç'}</button>
          <button ref={okRef} className="confirm__btn confirm__btn--ok" onClick={() => answer(true)}>{request.confirmLabel ?? 'Tamam'}</button>
        </div>
      </div>
    </div>
  )
}
