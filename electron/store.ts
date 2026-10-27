import Store from 'electron-store'

export type DockItemType = 'app' | 'separator' | 'trash' | 'widget'

export interface DockItem {
  id: string
  type: DockItemType
  /** Absolute path to the .exe / .lnk this icon launches. Not used for separator/trash. */
  targetPath?: string
  /** Manual icon override chosen by the user (.ico/.png). If absent, we auto-extract from targetPath. */
  customIconPath?: string
  /** Display label shown in tooltip. */
  label?: string
  /** Sort order within the dock. */
  order: number
}

export interface DockSettings {
  position: 'bottom' | 'top' | 'left' | 'right'
  iconSize: number // px, base (unmagnified) size
  magnifiedSize: number // px, size at peak magnification
  magnificationRadius: number // how many neighboring icons feel the effect
  autoHide: boolean
  theme: string // theme id, resolved against themes/ directory
  animationCurve: 'linear' | 'spring' | 'bounce' | 'ease'
}

export interface StoreSchema {
  items: DockItem[]
  settings: DockSettings
}

const defaults: StoreSchema = {
  items: [
    { id: 'trash', type: 'trash', order: 999 },
  ],
  settings: {
    position: 'bottom',
    iconSize: 48,
    magnifiedSize: 84,
    magnificationRadius: 2,
    autoHide: false,
    theme: 'glass-dark',
    animationCurve: 'spring',
  },
}

export const store = new Store<StoreSchema>({ defaults })

export function getItems(): DockItem[] {
  return store.get('items').sort((a, b) => a.order - b.order)
}

export function setItems(items: DockItem[]) {
  store.set('items', items)
}

export function getSettings(): DockSettings {
  return store.get('settings')
}

export function updateSettings(partial: Partial<DockSettings>) {
  store.set('settings', { ...store.get('settings'), ...partial })
}
