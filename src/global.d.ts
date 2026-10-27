import type { DockItem, DockSettings, RunningApp } from './types'

declare global {
  interface Window {
    dock: {
      getItems: () => Promise<DockItem[]>
      setItems: (items: DockItem[]) => Promise<void>
      getSettings: () => Promise<DockSettings>
      updateSettings: (partial: Partial<DockSettings>) => Promise<void>
      resize: (width: number, height: number) => Promise<void>
      resolveIcon: (targetPath: string, customIconPath?: string) => Promise<string>
      getRunningApps: () => Promise<RunningApp[]>
      activateWindow: (windowId: number) => Promise<void>
      minimizeWindow: (windowId: number) => Promise<void>
      launch: (targetPath: string) => Promise<void>
      pickExecutable: () => Promise<string | null>
      pickIcon: () => Promise<string | null>
      showContextMenu: (payload: { kind: 'empty' | 'icon'; itemId?: string; itemType?: DockItem['type'] }) => Promise<void>
      onRunningAppsChanged: (cb: (apps: RunningApp[]) => void) => () => void
      onItemsChanged: (cb: (items: DockItem[]) => void) => () => void
      onOpenSettings: (cb: () => void) => () => void
    }
  }
}

export {}
