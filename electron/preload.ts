import { contextBridge, ipcRenderer } from 'electron'
import type { DockItem, DockSettings } from './store'
import type { RunningApp } from './windowManager'

const dockBridge = {
  getItems: (): Promise<DockItem[]> => ipcRenderer.invoke('dock:get-items'),
  setItems: (items: DockItem[]) => ipcRenderer.invoke('dock:set-items', items),
  getSettings: (): Promise<DockSettings> => ipcRenderer.invoke('dock:get-settings'),
  updateSettings: (partial: Partial<DockSettings>) => ipcRenderer.invoke('dock:update-settings', partial),

  resize: (width: number, height: number) => ipcRenderer.invoke('dock:resize', { width, height }),

  resolveIcon: (targetPath: string, customIconPath?: string): Promise<string> =>
    ipcRenderer.invoke('dock:resolve-icon', { targetPath, customIconPath }),

  getRunningApps: (): Promise<RunningApp[]> => ipcRenderer.invoke('dock:get-running-apps'),
  activateWindow: (windowId: number) => ipcRenderer.invoke('dock:activate-window', windowId),
  minimizeWindow: (windowId: number) => ipcRenderer.invoke('dock:minimize-window', windowId),
  launch: (targetPath: string) => ipcRenderer.invoke('dock:launch', targetPath),

  pickExecutable: (): Promise<string | null> => ipcRenderer.invoke('dock:pick-executable'),
  pickIcon: (): Promise<string | null> => ipcRenderer.invoke('dock:pick-icon'),
  showContextMenu: (payload: { kind: 'empty' | 'icon'; itemId?: string; itemType?: DockItem['type'] }) =>
    ipcRenderer.invoke('dock:show-context-menu', payload),

  onRunningAppsChanged: (cb: (apps: RunningApp[]) => void) => {
    const listener = (_e: unknown, apps: RunningApp[]) => cb(apps)
    ipcRenderer.on('running-apps-changed', listener)
    return () => ipcRenderer.removeListener('running-apps-changed', listener)
  },
  onItemsChanged: (cb: (items: DockItem[]) => void) => {
    const listener = (_e: unknown, items: DockItem[]) => cb(items)
    ipcRenderer.on('items-changed', listener)
    return () => ipcRenderer.removeListener('items-changed', listener)
  },
  onOpenSettings: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('open-settings', listener)
    return () => ipcRenderer.removeListener('open-settings', listener)
  },
}

contextBridge.exposeInMainWorld('dock', dockBridge)

export type DockBridge = typeof dockBridge
