import { useCallback, useEffect, useState } from 'react'
import Dock from './components/Dock'
import type { DockItem, DockSettings, RunningApp } from './types'

export default function App() {
  const [items, setItems] = useState<DockItem[]>([])
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [runningApps, setRunningApps] = useState<RunningApp[]>([])
  const [iconSrcById, setIconSrcById] = useState<Record<string, string>>({})

  // Initial load from the main-process store.
  useEffect(() => {
    window.dock.getItems().then(setItems)
    window.dock.getSettings().then(setSettings)
    window.dock.getRunningApps().then(setRunningApps)
    const offRunning = window.dock.onRunningAppsChanged(setRunningApps)
    const offItems = window.dock.onItemsChanged(setItems)
    return () => {
      offRunning()
      offItems()
    }
  }, [])

  // Resolve (and cache) icons whenever the item list changes.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        items
          .filter((i) => i.type === 'app' && i.targetPath)
          .map(async (i) => [i.id, await window.dock.resolveIcon(i.targetPath!, i.customIconPath)] as const),
      )
      if (!cancelled) setIconSrcById(Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1])))
    })()
    return () => {
      cancelled = true
    }
  }, [items])

  const handleLayoutChange = useCallback((width: number, height: number) => {
    window.dock.resize(Math.ceil(width), Math.ceil(height))
  }, [])

  const handleActivate = useCallback(
    (item: DockItem) => {
      if (item.type === 'trash') {
        // TODO: wire to a real recycle-bin watcher (SHQueryRecycleBin via a small native helper)
        // and open it with `shell.openPath('shell:RecycleBinFolder')` from main.
        return
      }
      if (!item.targetPath) return
      const running = runningApps.find((a) => a.exePath.toLowerCase() === item.targetPath!.toLowerCase())
      if (running) {
        if (running.isMinimized) window.dock.activateWindow(running.windowId)
        else window.dock.minimizeWindow(running.windowId)
      } else {
        window.dock.launch(item.targetPath)
      }
    },
    [runningApps],
  )

  if (!settings) return null

  return (
    <Dock
      items={items}
      settings={settings}
      runningApps={runningApps}
      iconSrcById={iconSrcById}
      onActivate={handleActivate}
      onLayoutChange={handleLayoutChange}
      onEmptyContextMenu={() => window.dock.showContextMenu({ kind: 'empty' })}
      onIconContextMenu={(item) => window.dock.showContextMenu({ kind: 'icon', itemId: item.id, itemType: item.type })}
    />
  )
}
