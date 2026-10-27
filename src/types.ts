export type DockItemType = 'app' | 'separator' | 'trash' | 'widget'

export interface DockItem {
  id: string
  type: DockItemType
  targetPath?: string
  customIconPath?: string
  label?: string
  order: number
}

export interface DockSettings {
  position: 'bottom' | 'top' | 'left' | 'right'
  iconSize: number
  magnifiedSize: number
  magnificationRadius: number
  autoHide: boolean
  theme: string
  animationCurve: 'linear' | 'spring' | 'bounce' | 'ease'
}

export interface RunningApp {
  windowId: number
  processId: number
  exePath: string
  title: string
  isMinimized: boolean
}
