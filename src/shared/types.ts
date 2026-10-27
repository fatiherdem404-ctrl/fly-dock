// Types shared by the main process, the preload bridge and every renderer view.

export type DockItemType = 'app' | 'file' | 'folder' | 'stack' | 'separator' | 'trash'

export interface DockItem {
  id: string
  type: DockItemType
  /** Absolute path of the program, file, folder or shortcut this icon opens. */
  targetPath?: string
  /** Manual icon override (.ico/.png/.svg). Wins over icon packs and the shell icon. */
  customIconPath?: string
  label?: string
  /** Global shortcut (Electron accelerator syntax) that launches or focuses this item. */
  hotkey?: string
}

export type DockPosition = 'bottom' | 'top' | 'left' | 'right'
export type AnimationCurve = 'linear' | 'spring' | 'bounce' | 'ease'
export type DockMaterial = 'none' | 'acrylic' | 'mica'

export interface DockSettings {
  position: DockPosition
  iconSize: number
  magnifiedSize: number
  /** How many neighbouring icons feel the magnification. */
  magnificationRadius: number
  magnification: boolean
  autoHide: boolean
  autoHideDelayMs: number
  hideInFullscreen: boolean
  /** 'primary', 'all', or the id of one display. */
  monitor: 'primary' | 'all' | number
  material: DockMaterial
  theme: string
  iconPack: string
  animationCurve: AnimationCurve
  showRunningIndicators: boolean
  showTrash: boolean
  launchAtLogin: boolean
  toggleHotkey: string
}

export type WidgetType = 'clock' | 'weather' | 'system' | 'media' | 'calendar'

export interface WidgetInstance {
  id: string
  type: WidgetType
  x: number
  y: number
  /** Display the widget sits on; undefined = primary. */
  displayId?: number
  options: Record<string, string | number | boolean>
}

export interface ThemeVars {
  surface: string
  surfaceBorder: string
  surfaceBlur: number
  radius: number
  shadow: string
  indicator: string
  tooltipBg: string
  tooltipText: string
  accent: string
  panelBg: string
  panelText: string
  panelMuted: string
  fontFamily: string
}

export interface ThemeDef {
  id: string
  name: string
  author?: string
  version?: string
  vars: ThemeVars
}

export interface PackInfo {
  id: string
  type: 'theme' | 'icons'
  name: string
  author?: string
  version?: string
  builtin?: boolean
}

/** Open windows per dock item id (matched by executable). */
export type RunningState = Record<string, { count: number; minimized: boolean }>

export interface StackEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface Persisted {
  schemaVersion: number
  items: DockItem[]
  settings: DockSettings
  widgets: WidgetInstance[]
}

export const SCHEMA_VERSION = 2

export const DEFAULT_SETTINGS: DockSettings = {
  position: 'bottom',
  iconSize: 48,
  magnifiedSize: 84,
  magnificationRadius: 2,
  magnification: true,
  autoHide: false,
  autoHideDelayMs: 600,
  hideInFullscreen: true,
  monitor: 'primary',
  material: 'none',
  theme: 'glass-dark',
  iconPack: '',
  animationCurve: 'spring',
  showRunningIndicators: true,
  showTrash: true,
  launchAtLogin: false,
  toggleHotkey: 'Control+Alt+D',
}

// ---- IPC contract: one table drives the preload bridge, the main-process handlers and the renderer calls ----

export interface InvokeMap {
  'items:get': { args: []; result: DockItem[] }
  'items:set': { args: [items: DockItem[]]; result: DockItem[] }
  'items:add-paths': { args: [paths: string[], index: number]; result: DockItem[] }
  'items:remove': { args: [id: string]; result: DockItem[] }
  'items:update': { args: [id: string, patch: Partial<Pick<DockItem, 'label' | 'hotkey' | 'customIconPath'>>]; result: DockItem[] }
  'items:activate': { args: [id: string]; result: void }
  'items:icon': { args: [id: string]; result: string | null }
  'icon:path': { args: [path: string]; result: string | null }
  'settings:get': { args: []; result: DockSettings }
  'settings:update': { args: [partial: Partial<DockSettings>]; result: DockSettings }
  'displays:list': { args: []; result: { id: number; label: string; primary: boolean }[] }
  'windows:get': { args: []; result: RunningState }
  'trash:get': { args: []; result: { items: number } }
  'trash:drop': { args: [paths: string[]]; result: void }
  'menu:show': { args: [payload: { kind: 'empty' | 'icon'; itemId?: string }]; result: void }
  'dock:layout': { args: [layout: { main: number; cross: number; shelfMain: number; shelfCross: number }]; result: void }
  'dock:state': { args: []; result: { hidden: boolean } }
  'stack:list': { args: [id: string]; result: StackEntry[] }
  'stack:open': { args: [path: string]; result: void }
  'stack:show': { args: [id: string, anchor: { x: number; y: number }]; result: void }
  'themes:list': { args: []; result: PackInfo[] }
  'themes:get': { args: [id: string]; result: ThemeDef | null }
  'packs:list': { args: []; result: PackInfo[] }
  'packs:import': { args: []; result: { ok: boolean; message: string; pack?: PackInfo } }
  'packs:export': { args: [id: string]; result: { ok: boolean; message: string } }
  'packs:remove': { args: [id: string]; result: PackInfo[] }
  'widgets:list': { args: []; result: WidgetInstance[] }
  'widgets:add': { args: [type: WidgetType]; result: WidgetInstance[] }
  'widgets:remove': { args: [id: string]; result: WidgetInstance[] }
  'widgets:update': { args: [id: string, options: Record<string, string | number | boolean>]; result: WidgetInstance[] }
  'widgets:move': { args: [id: string, x: number, y: number]; result: void }
  'widgets:system': { args: []; result: { cpu: number; ram: number; disk: number; diskLabel: string } }
  'widgets:weather': { args: [city: string]; result: { ok: true; city: string; temp: number; code: number; wind: number } | { ok: false; message: string } }
  'widgets:media': { args: [key: 'playpause' | 'next' | 'prev']; result: void }
  'widgets:now-playing': { args: []; result: { app: string; title: string } | null }
  'app:open-settings': { args: []; result: void }
  'app:open-external': { args: [target: 'support' | 'repo' | 'issues']; result: void }
  'app:info': { args: []; result: { name: string; version: string; tagline: string; kofiUrl: string } }
  'app:quit': { args: []; result: void }
}

export interface EventMap {
  'items:changed': DockItem[]
  'settings:changed': DockSettings
  'windows:changed': RunningState
  'trash:changed': { items: number }
  'dock:hidden': { hidden: boolean }
  'widgets:changed': WidgetInstance[]
  'themes:changed': null
  'ui:open-settings': null
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap
