import type { CSSProperties } from 'react'
import type { DockItem, DockPosition, IndicatorStyle, LaunchAnimation } from '@/shared/types'

interface DockIconProps {
  item: DockItem
  style: CSSProperties
  iconSrc?: string
  running?: { count: number; minimized: boolean }
  launching: boolean
  launchAnimation: LaunchAnimation
  indicator: IndicatorStyle
  position: DockPosition
  showLabel: boolean
  dragging: boolean
  locked: boolean
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}

export default function DockIcon({ item, style, iconSrc, running, launching, launchAnimation, indicator, position, showLabel, dragging, locked, onClick, onDragStart, onDragEnd, onContextMenu }: DockIconProps) {
  const label = item.label ?? (item.type === 'trash' ? 'Çöp kutusu' : '')
  const launchClass = launching && launchAnimation !== 'none' ? ` dock-icon--launch-${launchAnimation}` : ''
  return (
    <div
      className={`dock-icon${launchClass}${dragging ? ' dock-icon--dragging' : ''}`}
      style={style}
      data-item-type={item.type}
      data-position={position}
      draggable={!locked && item.type !== 'trash'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      role="button"
      aria-label={label}
    >
      {showLabel && label && <div className="dock-icon__label">{label}</div>}
      {iconSrc ? <img className="dock-icon__image" src={iconSrc} alt="" draggable={false} /> : <div className="dock-icon__placeholder" />}
      {running && <span className={`dock-icon__indicator dock-icon__indicator--${indicator}${running.minimized ? ' dock-icon__indicator--dim' : ''}`} />}
    </div>
  )
}
