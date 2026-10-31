import { useCallback, useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import { invoke, useActiveTheme, useEvent } from '@/api'
import type { DockItem, DockSettings, RunningState } from '@/shared/types'

export default function DockView() {
  const [items, setItems] = useState<DockItem[]>([])
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [running, setRunning] = useState<RunningState>({})
  const [icons, setIcons] = useState<Record<string, string>>({})
  const [trashItems, setTrashItems] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [launching, setLaunching] = useState<Set<string>>(new Set())

  useEffect(() => {
    invoke('items:get').then(setItems)
    invoke('settings:get').then(setSettings)
    invoke('windows:get').then(setRunning)
    invoke('trash:get').then((t) => setTrashItems(t.items))
    invoke('dock:state').then((s) => setHidden(s.hidden))
  }, [])
  useEvent('items:changed', setItems)
  useEvent('settings:changed', setSettings)
  useEvent('windows:changed', setRunning)
  useEvent('trash:changed', (t) => setTrashItems(t.items))
  useEvent('dock:hidden', (s) => setHidden(s.hidden))
  useActiveTheme(settings?.theme)

  // Icons are resolved in main (custom > icon pack > shell). Refetch when anything that affects them changes.
  const iconKey = `${items.map((i) => `${i.id}:${i.customIconPath ?? ''}`).join('|')}#${settings?.iconPack}#${trashItems > 0}`
  const [packTick, setPackTick] = useState(0)
  useEvent('themes:changed', () => setPackTick((n) => n + 1))
  useEffect(() => {
    let live = true
    Promise.all(items.filter((i) => i.type !== 'separator').map(async (i) => [i.id, await invoke('items:icon', i.id)] as const)).then((entries) => {
      if (live) setIcons(Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1])))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconKey, packTick])

  const activate = useCallback(
    (item: DockItem) => {
      if (item.type === 'app' && !running[item.id]) {
        setLaunching((s) => new Set(s).add(item.id))
        setTimeout(() => setLaunching((s) => (s.delete(item.id), new Set(s))), 1500)
      }
      invoke('items:activate', item.id)
    },
    [running],
  )

  if (!settings) return null
  const visible = items.filter((i) => i.type !== 'trash' || settings.showTrash)
  return <Dock items={visible} settings={settings} running={running} icons={icons} launching={launching} hidden={hidden} onActivate={activate} />
}
