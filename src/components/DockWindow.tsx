// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { ReactNode } from 'react'
import Icon, { IconName } from '@/icons'
import Panel, { usePanelClose, usePanelDrag } from './Panel'
import type { DockSettings } from '@/shared/types'

function Frame({ title, icon, toolbar, footer, children }: { title: string; icon: IconName; toolbar?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const close = usePanelClose()
  const startDrag = usePanelDrag()
  return (
    <div className="dw">
      <header className="dw__head" onPointerDown={startDrag}>
        <span className="dw__icon"><Icon name={icon} size={16} /></span>
        <h2 title={title}>{title}</h2>
        <button className="dw__close" aria-label="Kapat" title="Kapat (Esc)" onClick={close}><Icon name="cross" size={15} /></button>
      </header>
      {toolbar && <div className="dw__bar">{toolbar}</div>}
      <div className="dw__body">{children}</div>
      {footer && <footer className="dw__foot">{footer}</footer>}
    </div>
  )
}

/**
 * The one window every dock popup uses (folders, groups, the gear menu): the same themed frame, a title bar with a
 * close button, an optional toolbar row, a scrolling body and an optional status bar. Its colours all come from the active theme.
 */
export default function DockWindow({ title, icon, toolbar, footer, onSettings, children }: { title: string; icon: IconName; toolbar?: ReactNode; footer?: ReactNode; onSettings?: (s: DockSettings) => void; children: ReactNode }) {
  return (
    <Panel onSettings={onSettings}>
      <Frame title={title} icon={icon} toolbar={toolbar} footer={footer}>{children}</Frame>
    </Panel>
  )
}
