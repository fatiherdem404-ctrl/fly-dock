import Store from 'electron-store'
import {
  DEFAULT_SETTINGS, SCHEMA_VERSION,
  DockItem, DockSettings, Persisted, WidgetInstance,
} from '../src/shared/types'

// schemaVersion is deliberately absent: a missing value means an old file that still needs migrating.
const defaults: Omit<Persisted, 'schemaVersion'> = {
  items: [{ id: 'trash', type: 'trash' }],
  settings: DEFAULT_SETTINGS,
  widgets: [],
}

export const store = new Store<Persisted>({ defaults: defaults as Persisted })

/** Upgrades whatever an older build wrote. Each step only knows about the version before it. */
function migrate() {
  const version = (store.get('schemaVersion') as number | undefined) ?? 1
  if (version < 2) {
    const old = store.get('items') as (DockItem & { order?: number })[]
    const sorted = [...old].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    store.set('items', sorted.map(({ order: _order, ...rest }) => rest as DockItem))
    store.set('widgets', [])
  }
  if (version >= 3 && version < 4) {
    // Version 3 switched everyone to a system-drawn shelf that had to chase the icons from another window.
    const settings = store.get('settings')
    if (settings.material === 'acrylic') store.set('settings', { ...settings, material: 'none' })
  }
  if (version < 5) {
    // magnifiedSize (px) became maxScale (a ratio of the icon size).
    const old = store.get('settings') as unknown as { magnifiedSize?: number; iconSize?: number }
    if (old.magnifiedSize && old.iconSize) {
      const { magnifiedSize: _gone, ...rest } = old
      store.set('settings', { ...rest, maxScale: Math.round((old.magnifiedSize / old.iconSize) * 100) / 100 } as unknown as DockSettings)
    }
  }
  // Fill settings added since the file was written.
  store.set('settings', { ...DEFAULT_SETTINGS, ...store.get('settings') })
  store.set('schemaVersion', SCHEMA_VERSION)
}
migrate()

export function getItems(): DockItem[] {
  return store.get('items')
}

export function setItems(items: DockItem[]) {
  store.set('items', items)
}

export function getSettings(): DockSettings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function updateSettings(partial: Partial<DockSettings>): DockSettings {
  const next = { ...getSettings(), ...partial }
  store.set('settings', next)
  return next
}

export function getWidgets(): WidgetInstance[] {
  return store.get('widgets')
}

export function setWidgets(widgets: WidgetInstance[]) {
  store.set('widgets', widgets)
}
