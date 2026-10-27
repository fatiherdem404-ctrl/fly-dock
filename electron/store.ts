import Store from 'electron-store'
import {
  DEFAULT_SETTINGS, SCHEMA_VERSION,
  DockItem, DockSettings, Persisted, WidgetInstance,
} from '../src/shared/types'

const defaults: Persisted = {
  schemaVersion: SCHEMA_VERSION,
  items: [{ id: 'trash', type: 'trash' }],
  settings: DEFAULT_SETTINGS,
  widgets: [],
}

export const store = new Store<Persisted>({ defaults })

/** Upgrades whatever an older build wrote. Each step only knows about the version before it. */
function migrate() {
  const version = (store.get('schemaVersion') as number | undefined) ?? 1
  if (version < 2) {
    const old = store.get('items') as (DockItem & { order?: number })[]
    const sorted = [...old].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    store.set('items', sorted.map(({ order: _order, ...rest }) => rest as DockItem))
    store.set('widgets', [])
  }
  if (version < 3) {
    // The flat translucent surface cannot blur anything on a transparent window; acrylic is the real glass.
    const settings = store.get('settings')
    if (settings.material === 'none') store.set('settings', { ...settings, material: 'acrylic' })
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
