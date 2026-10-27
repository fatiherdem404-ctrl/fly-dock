import type { CSSProperties } from 'react'
import type { DockItem, DockPosition } from '@/shared/types'

interface DockIconProps {
  item: DockItem
  style: CSSProperties
  iconSrc?: string
  running?: { count: number; minimized: boolean }
  launching: boolean
  position: DockPosition
  hovered: boolean
  dragging: boolean
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}

export default function DockIcon({ item, style, iconSrc, running, launching, position, hovered, dragging, onClick, onDragStart, onDragEnd, onContextMenu }: DockIconProps) {
  const label = item.label ?? (item.type === 'trash' ? 'Çöp kutusu' : '')
  return (
    <div
      className={`dock-icon${launching ? ' dock-icon--launching' : ''}${dragging ? ' dock-icon--dragging' : ''}`}
      style={style}
      data-item-type={item.type}
      data-position={position}
      draggable={item.type !== 'trash'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      role="button"
      aria-label={label}
    >
      {hovered && label && <div className="dock-icon__tooltip">{label}</div>}
      {iconSrc ? <img className="dock-icon__image" src={iconSrc} alt="" draggable={false} /> : <div className="dock-icon__placeholder" />}
      {running && <span className={`dock-icon__indicator${running.minimized ? ' dock-icon__indicator--dim' : ''}`} />}
    </div>
  )
}
