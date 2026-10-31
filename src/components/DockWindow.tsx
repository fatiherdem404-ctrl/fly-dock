import { ReactNode } from 'react'
import Icon, { IconName } from '@/icons'
import Panel, { usePanelClose } from './Panel'
import type { DockSettings } from '@/shared/types'

function Frame({ title, icon, toolbar, children }: { title: string; icon: IconName; toolbar?: ReactNode; children: ReactNode }) {
  const close = usePanelClose()
  return (
    <div className="dw">
      <header className="dw__head">
        <span className="dw__icon"><Icon name={icon} size={16} /></span>
        <h2 title={title}>{title}</h2>
        <button className="dw__close" aria-label="Kapat" title="Kapat (Esc)" onClick={close}><Icon name="cross" size={15} /></button>
      </header>
      {toolbar && <div className="dw__bar">{toolbar}</div>}
      <div className="dw__body">{children}</div>
    </div>
  )
}

/**
 * The one window every dock popup uses (folders, groups, the gear menu): the same themed frame, a title bar with a
 * close button, an optional toolbar row and a scrolling body. Its colours all come from the active theme.
 */
export default function DockWindow({ title, icon, toolbar, onSettings, children }: { title: string; icon: IconName; toolbar?: ReactNode; onSettings?: (s: DockSettings) => void; children: ReactNode }) {
  return (
    <Panel onSettings={onSettings}>
      <Frame title={title} icon={icon} toolbar={toolbar}>{children}</Frame>
    </Panel>
  )
}
