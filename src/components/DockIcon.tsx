import { useState } from 'react'
import type { DockItem } from '@/types'

interface DockIconProps {
  item: DockItem
  size: number
  transition: string
  iconSrc?: string
  isRunning: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export default function DockIcon({ item, size, transition, iconSrc, isRunning, onClick, onContextMenu }: DockIconProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="dock-icon"
      style={{ width: size, height: size, transition: `width 120ms ${transition}, height 120ms ${transition}` }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      aria-label={item.label ?? item.type}
    >
      {showTooltip && item.label && <div className="dock-icon__tooltip">{item.label}</div>}

      {item.type === 'trash' ? (
        <div className="dock-icon__trash" data-empty="true" />
      ) : iconSrc ? (
        <img className="dock-icon__image" src={iconSrc} alt={item.label ?? ''} draggable={false} />
      ) : (
        <div className="dock-icon__placeholder" />
      )}

      {isRunning && <span className="dock-icon__indicator" />}
    </div>
  )
}
