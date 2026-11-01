// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { Children, isValidElement, ReactElement, ReactNode, useState } from 'react'
import { playSound } from '@/sound'
import Icon, { IconName } from '@/icons'
import { DockSettings } from '@/shared/types'

import { t } from '../i18n'
export type Update = (partial: Partial<DockSettings>) => void

// ---- building blocks ----

const FOLD = 'settings.fold.'
const folded = (title: string) => {
  try {
    return localStorage.getItem(FOLD + title) === '1'
  } catch {
    return false
  }
}

/** A group of settings. Its header folds it away (remembered per group), so a long page can be kept short. */
export function Card({ title, hint, icon, glyph, children }: { title: string; hint?: string; icon?: IconName; /** A picture of its own instead of a line icon (a game's ball, for instance). */ glyph?: ReactNode; tab?: string; children: ReactNode }) {
  const [closed, setClosed] = useState(() => folded(title))
  const toggle = () => {
    setClosed((c) => {
      try {
        localStorage.setItem(FOLD + title, c ? '0' : '1')
      } catch {
        /* the choice just is not remembered */
      }
      return !c
    })
  }
  return (
    <section className={closed ? 'st-card is-folded' : 'st-card'}>
      <header className={icon || glyph ? 'st-card__head st-card__head--icon' : 'st-card__head'}>
        <button className="st-card__toggle" aria-expanded={!closed} onClick={toggle} title={closed ? t('Göster') : t('Gizle')}>
          {glyph ? <span className="st-card__icon st-card__icon--glyph">{glyph}</span> : icon && <span className="st-card__icon"><Icon name={icon} size={18} /></span>}
          <div>
            <h3>{title}</h3>
            {hint && !closed && <p>{hint}</p>}
          </div>
          <span className="st-card__chev"><Icon name="chevronDown" size={16} /></span>
        </button>
      </header>
      {!closed && <div className="st-card__body">{children}</div>}
    </section>
  )
}

/** Groups of a page as sub-tabs: each child's `tab` (or `title`) names its tab, only the chosen one is shown. */
export function Pages({ id, children }: { id: string; children: ReactNode }) {
  type PageEl = ReactElement<{ title?: string; tab?: string }>
  const pages = Children.toArray(children).filter(isValidElement) as PageEl[]
  const label = (p: PageEl) => p.props.tab ?? p.props.title ?? ''
  const labels = [...new Set(pages.map(label))]
  // a sub-tab wears the icon of the first group inside it
  const iconOf = (name: string) => (pages.find((p) => label(p) === name)?.props as { icon?: IconName } | undefined)?.icon
  const glyphOf = (name: string) => (pages.find((p) => label(p) === name)?.props as { glyph?: ReactNode } | undefined)?.glyph
  const key = 'settings.sub.' + id
  const [chosen, setChosen] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  const pick = (name: string) => {
    setChosen(name)
    try {
      localStorage.setItem(key, name)
    } catch {
      /* private window: the choice just is not remembered */
    }
  }
  const current = labels.includes(chosen) ? chosen : labels[0]
  if (!current) return null
  return (
    <>
      {labels.length > 1 && (
        <div className="st-subtabs" role="tablist">
          {labels.map((name) => (
            <button key={name} role="tab" aria-selected={name === current} onClick={() => pick(name)}>{glyphOf(name) ? <span className="st-subtabs__glyph">{glyphOf(name)}</span> : iconOf(name) && <Icon name={iconOf(name)!} size={14} />}{name}</button>
          ))}
        </div>
      )}
      <div key={current} className="st-subpage">{pages.filter((p) => label(p) === current)}</div>
    </>
  )
}

export function Row({ label, hint, icon, children }: { label: string; hint?: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row__text">
        <span>{icon && <Icon name={icon} size={15} />}{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="st-row__control">{children}</div>
    </div>
  )
}

export function Switch({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button className="st-switch" role="switch" aria-checked={value} aria-label={label} disabled={disabled} onClick={() => { playSound('toggle'); onChange(!value) }}><i /></button>
}

export function Slider({ value, min, max, step = 1, unit = '', onChange, format }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="st-slider">
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{format ? format(value) : `${value}${unit}`}</output>
    </div>
  )
}

export function Select<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select className="st-select" value={String(value)} onChange={(e) => {
      const picked = options.find(([v]) => String(v) === e.target.value)
      if (picked) onChange(picked[0])
    }}>
      {options.map(([v, label]) => <option key={String(v)} value={String(v)}>{label}</option>)}
    </select>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="st-seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => { playSound('toggle'); onChange(v) }}>{label}</button>
      ))}
    </div>
  )
}

export function Choice<T extends string>({ value, options, onChange, children }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void; children?: (id: T) => ReactNode }) {
  return (
    <div className="st-choices">
      {options.map(([id, label, hint]) => (
        <button key={id} className="st-choice" aria-pressed={value === id} onClick={() => { playSound('toggle'); onChange(id) }}>
          {children?.(id)}
          <b>{label}</b>
          {hint && <small>{hint}</small>}
        </button>
      ))}
    </div>
  )
}

export function Message({ text, error }: { text: string; error?: boolean }) {
  return <div className={`st-message${error ? ' st-message--error' : ''}`}>{text}</div>
}

/** One choice with a small picture of what it does. */
export interface Option<T> {
  id: T
  label: string
  hint?: string
  icon?: IconName
  preview?: ReactNode
}

/** A responsive grid of picture cards; the selected one is outlined. Every setting with a visual meaning uses these. */
export function Cards<T extends string>({ value, options, onChange, size = 'm' }: { value: T; options: Option<T>[]; onChange: (v: T) => void; size?: 's' | 'm' | 'l' }) {
  return (
    <div className={`st-optcards st-optcards--${size}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className="st-optcard" onClick={() => { playSound('toggle'); onChange(o.id) }}>
          <span className="st-optcard__pic">{o.preview ?? (o.icon ? <Icon name={o.icon} size={26} /> : null)}</span>
          <b>{o.label}</b>
          {o.hint && <small>{o.hint}</small>}
          <i className="st-optcard__check"><Icon name="check" size={12} /></i>
        </button>
      ))}
    </div>
  )
}
