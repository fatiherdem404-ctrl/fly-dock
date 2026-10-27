// Types shared by the main process, the preload bridge and every renderer view.

export type DockItemType = 'app' | 'file' | 'folder' | 'stack' | 'group' | 'separator' | 'trash'

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
  /** For a group: the programs and files it holds. */
  children?: string[]
}

export interface MenuItemView {
  label?: string
  icon?: string
  separator?: boolean
  checked?: boolean
  danger?: boolean
  disabled?: boolean
}

export type DockPosition = 'bottom' | 'top' | 'left' | 'right'
export type AnimationCurve = 'linear' | 'spring' | 'bounce' | 'ease'
export type DockMaterial = 'none' | 'acrylic' | 'mica'
export type HoverAnimation = 'zoom' | 'lift' | 'wave'
export type LaunchAnimation = 'bounce' | 'hop' | 'pulse' | 'none'
export type IndicatorStyle = 'dot' | 'bar' | 'glow' | 'ring'
export type ShowAnimation = 'slide' | 'fade' | 'scale'
export type WindowAnimation = 'genie' | 'scale' | 'fade' | 'slide'
export type SpeedPreset = 'fast' | 'medium' | 'slow' | 'custom'
export type FalloffCurve = 'cosine' | 'gaussian' | 'linear' | 'sharp'
export type LabelMode = 'hover' | 'always' | 'never'
export type StackSize = 'small' | 'medium' | 'full' | 'custom'
export type DeskStyle = 'glass' | 'glass3d' | 'wood' | 'metal' | 'marble' | 'neon' | 'crystal' | 'matte' | 'mirror' | 'wall'

export const DESK_STYLES: DeskStyle[] = ['glass', 'glass3d', 'wood', 'metal', 'marble', 'neon', 'crystal', 'matte', 'mirror', 'wall']

export interface DockSettings {
  // placement
  position: DockPosition
  /** Distance from the screen edge in px. */
  edgeOffset: number
  /** Where along the edge the dock sits, 0 (start) to 100 (end); 50 is centred. */
  alignment: number
  /** 'primary', 'all', or the id of one display. */
  monitor: 'primary' | 'all' | number
  // icons and growth
  iconSize: number
  magnification: boolean
  /** Biggest icon size as a multiple of iconSize. */
  maxScale: number
  /** How many neighbouring icons feel the magnification. */
  magnificationRadius: number
  falloff: FalloffCurve
  iconSpacing: number
  // desk (the shelf the icons stand on)
  deskStyle: DeskStyle
  /** CSS colour that tints the desk; empty uses the theme. */
  deskColor: string
  deskOpacity: number
  /** 3D depth of the desk in px (0 = flat). */
  deskDepth: number
  /** Whether the desk gets thicker with the magnified icons. */
  shelfGrows: boolean
  shelfPadding: number
  material: DockMaterial
  // animation
  animationCurve: AnimationCurve
  speed: SpeedPreset
  speedMs: number
  hoverAnimation: HoverAnimation
  launchAnimation: LaunchAnimation
  showAnimation: ShowAnimation
  windowAnimation: WindowAnimation
  indicatorStyle: IndicatorStyle
  // dock windows (stacks and groups)
  stackSize: StackSize
  stackWidth: number
  stackHeight: number
  // labels
  labelMode: LabelMode
  labelSize: number
  labelFont: string
  // behaviour
  autoHide: boolean
  autoHideDelayMs: number
  hideInFullscreen: boolean
  lockItems: boolean
  showRunningIndicators: boolean
  showTrash: boolean
  /** Also show running programs that are not pinned, after a separator. */
  showRunningApps: boolean
  launchAtLogin: boolean
  toggleHotkey: string
  // look
  theme: string
  iconPack: string
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

export const SCHEMA_VERSION = 5

export const DEFAULT_SETTINGS: DockSettings = {
  position: 'bottom',
  edgeOffset: 6,
  alignment: 50,
  monitor: 'primary',
  iconSize: 48,
  magnification: true,
  maxScale: 1.75,
  magnificationRadius: 2,
  falloff: 'cosine',
  iconSpacing: 8,
  deskStyle: 'glass',
  deskColor: '',
  deskOpacity: 1,
  deskDepth: 0,
  shelfGrows: true,
  shelfPadding: 8,
  material: 'none',
  animationCurve: 'spring',
  speed: 'medium',
  speedMs: 350,
  hoverAnimation: 'zoom',
  launchAnimation: 'bounce',
  showAnimation: 'slide',
  windowAnimation: 'genie',
  indicatorStyle: 'dot',
  stackSize: 'medium',
  stackWidth: 520,
  stackHeight: 420,
  labelMode: 'hover',
  labelSize: 12,
  labelFont: '',
  autoHide: false,
  autoHideDelayMs: 600,
  hideInFullscreen: true,
  lockItems: false,
  showRunningIndicators: true,
  showTrash: true,
  showRunningApps: true,
  launchAtLogin: false,
  toggleHotkey: 'Control+Alt+D',
  theme: 'glass-dark',
  iconPack: '',
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
  'stack:close': { args: []; result: void }
  'group:add': { args: [id: string, paths: string[]]; result: DockItem[] }
  'menu:items': { args: []; result: MenuItemView[] }
  'menu:pick': { args: [index: number]; result: void }
  'menu:close': { args: []; result: void }
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
  'app:info': { args: []; result: { name: string; version: string; tagline: string; kofiUrl: string; materialSupported: boolean; loginSupported: boolean; loginEnabled: boolean } }
  'backup:export': { args: []; result: { ok: boolean; message: string } }
  'backup:import': { args: []; result: { ok: boolean; message: string } }
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
