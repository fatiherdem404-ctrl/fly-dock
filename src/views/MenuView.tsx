// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import Icon, { IconName } from '@/icons'
import type { DockSettings, MenuItemView } from '@/shared/types'
import { initSound, playSound } from '@/sound'

/** The dock's context menu: glass panel, icon per entry, grows out of the corner the pointer opened it at. */
export default function MenuView({ origin }: { origin: string }) {
  const [items, setItems] = useState<MenuItemView[]>([])
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [closing, setClosing] = useState(false)
  const pending = useRef<(() => void) | null>(null)
  useEffect(() => {
    initSound()
    setTimeout(() => playSound('menuOpen'), 60)
    invoke('menu:items').then(setItems)
    invoke('settings:get').then(setSettings)
  }, [])
  useActiveTheme(settings?.theme)

  // Plays the exit animation, then runs what should happen once the menu is gone.
  const leave = (then: () => void) => {
    if (closing) return
    pending.current = then
    setClosing(true)
    setTimeout(() => pending.current?.(), 110)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave(() => invoke('menu:close'))
    const onBlur = () => leave(() => invoke('menu:close'))
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
    }
  })

  return (
    <div className={`menu menu--${origin}${closing ? ' menu--closing' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) =>
        item.separator ? (
          <hr key={i} />
        ) : (
          <button key={i} className={`menu__item${item.danger ? ' menu__item--danger' : ''}`} disabled={item.disabled} style={{ animationDelay: `${i * 14}ms` }}
            onClick={() => { playSound('menuPick'); leave(() => invoke('menu:pick', i)) }}>
            <span className="menu__icon">{item.icon && <Icon name={item.icon as IconName} size={16} />}</span>
            <span className="menu__label">{item.label}</span>
            {item.checked && <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />}
          </button>
        ),
      )}
    </div>
  )
}
