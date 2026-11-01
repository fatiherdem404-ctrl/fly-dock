// Types shared by the main process, the preload bridge and every renderer view.

/** Everything the app can play a sound for. Each belongs to one switchable group, see SOUND_GROUPS. */
export type SoundEvent =
  | 'hover' | 'click' | 'launch' | 'drop' | 'remove' | 'dockShow' | 'dockHide'
  | 'windowOpen' | 'windowClose' | 'menuOpen' | 'menuPick'
  | 'trashDrop' | 'trashEmpty'
  | 'confirmOpen' | 'accept' | 'cancel' | 'warn' | 'error'
  | 'toggle' | 'notify'

export type SoundGroup = 'hover' | 'click' | 'launch' | 'dock' | 'windows' | 'menus' | 'trash' | 'dialogs' | 'ui'
export type SoundTheme = 'soft' | 'glass' | 'wood' | 'retro' | 'bubble'

export const SOUND_GROUP_OF: Record<SoundEvent, SoundGroup> = {
  hover: 'hover', click: 'click', launch: 'launch', drop: 'dock', remove: 'dock', dockShow: 'dock', dockHide: 'dock',
  windowOpen: 'windows', windowClose: 'windows', menuOpen: 'menus', menuPick: 'menus',
  trashDrop: 'trash', trashEmpty: 'trash',
  confirmOpen: 'dialogs', accept: 'dialogs', cancel: 'dialogs', warn: 'dialogs', error: 'dialogs',
  toggle: 'ui', notify: 'ui',
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button and a warning sound, for things that cannot be undone. */
  danger?: boolean
  /** Turns the window into a one-line text prompt; the answer carries the text. */
  input?: { value: string }
}

/** Which entry of a dock window was right-clicked. */
export type EntryMenuRequest = { kind: 'stack'; itemId: string; path: string } | { kind: 'wheel'; id: string }

export type DockItemType = 'app' | 'file' | 'folder' | 'stack' | 'group' | 'start' | 'wheel' | 'power' | 'separator' | 'trash'

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

/** A ready-made dock item the user can add from a list (My Computer, Documents, Network…). */
export interface PlaceInfo {
  id: string
  label: string
  added: boolean
}

export interface WheelEntry {
  id: string
  name: string
  category: string
  icon: string
  /** Added by the user: opens this file or folder. */
  path?: string
  /** Picture chosen by the user (a stored image name); replaces the built-in glyph. */
  iconFile?: string
  /** Picture from the active icon pack (data URL), used when the user has not chosen their own. */
  packIcon?: string
}

export type PowerAction = 'lock' | 'sleep' | 'restart' | 'shutdown' | 'logout'

export interface TweakInfo {
  id: string
  name: string
  description: string
  category: string
  risk: 'safe' | 'caution'
  /** What the user has to do before the change is visible. */
  effect: 'none' | 'explorer' | 'signout'
  enabled: boolean
  /** True when this app changed the setting and can put the old value back. */
  changedByUs: boolean
  /** Needs administrator rights: Windows asks for confirmation (UAC) when it is switched. */
  admin: boolean
}

export interface TweakLogEntry {
  at: number
  id: string
  action: 'apply' | 'revert'
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
export type HoverAnimation = 'zoom' | 'lift' | 'wave'
export type LaunchAnimation = 'bounce' | 'hop' | 'pulse' | 'none'
export type IndicatorStyle = 'dot' | 'bar' | 'glow' | 'ring'
export type ShowAnimation = 'slide' | 'fade' | 'scale'
export type WindowAnimation = 'genie' | 'scale' | 'fade' | 'slide'
export type SpeedPreset = 'fast' | 'medium' | 'slow' | 'custom'
export type FalloffCurve = 'cosine' | 'gaussian' | 'linear' | 'sharp'
export type SeparatorStyle = 'auto' | 'line' | 'groove' | 'dots' | 'glow' | 'none'
export type LabelMode = 'hover' | 'always' | 'never'
/** How a folder or group window lists its content, like the view menu of a Windows folder. */
export type StackView = 'xl' | 'large' | 'medium' | 'small' | 'list' | 'details'
export type StackSort = 'name' | 'date' | 'size' | 'type'
/** Where a dock window opens: above its icon, centred on the dock, in the middle of the screen, or at the pointer. */
export type StackPlacement = 'icon' | 'dock' | 'center' | 'cursor'
export type StackSize = 'small' | 'medium' | 'full' | 'custom'
/** Where the dock sits relative to other windows: always on top, as a normal window, or below all of them. */
export type DockLayer = 'above' | 'normal' | 'below'
export type DeskStyle = 'none' | 'glass' | 'azure' | 'macos' | 'glass3d' | 'wood' | 'birch' | 'walnut' | 'metal' | 'marble' | 'blackmarble' | 'concrete' | 'neon' | 'crystal' | 'matte' | 'mirror' | 'wall' | 'custom'

export const DESK_STYLES: DeskStyle[] = ['none', 'glass', 'azure', 'macos', 'glass3d', 'wood', 'birch', 'walnut', 'metal', 'neon', 'marble', 'blackmarble', 'concrete', 'crystal', 'matte', 'mirror', 'wall', 'custom']
export type TextureMode = 'tile' | 'fit'

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
  /** Corner radii of the desk as seen on screen (px); big values give the pill shape. */
  deskRadTL: number
  deskRadTR: number
  deskRadBL: number
  deskRadBR: number
  /** Moving one radius slider moves all four. */
  deskRadLinked: boolean
  /** Thickness of the desk's front face on the screen-edge side, the "lip" a 3D shelf stands on (px). */
  deskEdge: number
  /** Size of the desk pattern as a percentage of its designed size (also the size of the custom texture's tile). */
  deskTexScale: number
  /** Stored name of the user's own texture image ('' = none), used by the 'custom' desk style. */
  deskTexFile: string
  deskTexMode: TextureMode
  deskTexX: number
  deskTexY: number
  deskTexRotate: number
  /** Space between the icons and the desk edges, per screen side (px). */
  deskPadTop: number
  deskPadBottom: number
  deskPadLeft: number
  deskPadRight: number
  /** Moving one padding slider moves all four. */
  deskPadLinked: boolean
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
  stackPlacement: StackPlacement
  stackView: StackView
  stackSort: StackSort
  stackDesc: boolean
  separatorStyle: SeparatorStyle
  /** Bar thickness in px; 0 = the look's own. */
  sepThickness: number
  /** Bar length as a percentage of the icon size. */
  sepHeight: number
  /** Bar colour; empty = automatic for the desk and theme. */
  sepColor: string
  sepRadius: number
  /** Border on the left / right of the bar (px; 0 = none) and its colour (empty = automatic). */
  sepBorderL: number
  sepBorderR: number
  sepBorderLColor: string
  sepBorderRColor: string
  // labels
  labelMode: LabelMode
  // sounds
  soundEnabled: boolean
  soundVolume: number
  soundTheme: SoundTheme
  soundGroups: SoundGroup[]
  labelSize: number
  labelFont: string
  // behaviour
  layer: DockLayer
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
  /** Choosing a theme also applies the shelf that comes with it. */
  themeDesk: boolean
  // wallpapers
  wallpaperMode: WallpaperMode
  /** 'live:<id>' for a built-in scene, otherwise the path of a picture or video. */
  wallpaperSingle: string
  wallpaperFolder: string
  wallpaperMinutes: number
  wallpaperShuffle: boolean
  wallpaperFit: WallpaperFit
  wallpaperPauseFullscreen: boolean
  wallpaperPauseBattery: boolean
  /** Folders whose pictures show up in the icon picker. */
  iconFolders: string[]
  // desktop toys
  toyPet: boolean
  toyPetKind: 'cat' | 'dog' | 'rabbit'
  toyPetName: string
  /** The pet runs to the pointer when it is near the floor. */
  toyPetChase: boolean
  toyPetSize: number
  toyBasket: boolean
  toyFootball: boolean
  toyTennis: boolean
  toySound: boolean
  /** Where the toys sit among other windows: always on top, like a window, or under everything. */
  toyLayer: DockLayer
  /** What the toys stand on: the top of the dock or the bottom edge of the screen. */
  toyFloor: 'dock' | 'screen'
  toyHoopSide: 'left' | 'right'
  /** The cat gets a ball of yarn, the dog a stick to fetch. */
  toyPetPlay: boolean
}

export const DEFAULT_TOY_SCORES: ToyScores = { basket: 0, basketBest: 0, football: 0, footballBest: 0, tennisBest: 0 }

/** Best results of the toy games, kept between runs. */
export interface ToyScores {
  /** Baskets made, all time. */
  basket: number
  /** Most baskets in one 60-second round. */
  basketBest: number
  /** Goals scored, all time. */
  football: number
  /** Most goals in one 60-second round. */
  footballBest: number
  /** Longest tennis rally. */
  tennisBest: number
}

export type WidgetType = 'clock' | 'analog' | 'calendar' | 'weather' | 'system' | 'media' | 'battery' | 'note'

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

/** The shelf settings a theme can carry, so choosing a theme can give the dock its matching shelf. */
export const DESK_KEYS = [
  'deskStyle', 'deskColor', 'deskOpacity', 'deskDepth', 'deskEdge', 'shelfGrows',
  'deskRadTL', 'deskRadTR', 'deskRadBL', 'deskRadBR', 'deskRadLinked',
  'deskPadTop', 'deskPadBottom', 'deskPadLeft', 'deskPadRight', 'deskPadLinked',
  'deskTexScale', 'deskTexMode', 'deskTexX', 'deskTexY', 'deskTexRotate',
] as const
export type DeskKey = (typeof DESK_KEYS)[number]
export type ThemeDesk = Partial<Pick<DockSettings, DeskKey>>

export type LiveWallpaperId = 'aurora' | 'flow' | 'stars' | 'waves' | 'bubbles'
/** The scenes the app draws itself; no file needed. [id, name, one line about it] */
export const LIVE_WALLPAPERS: [LiveWallpaperId, string, string][] = [
  ['aurora', 'Aurora', 'Yavaşça süzülen renkli ışık bulutları'],
  ['flow', 'Akış', 'Yumuşak, sürekli değişen renk geçişi'],
  ['stars', 'Yıldızlı gece', 'Parlayan yıldızlar ve ara sıra kayan bir yıldız'],
  ['waves', 'Dalgalar', 'Katman katman, usulca sallanan dalgalar'],
  ['bubbles', 'Baloncuklar', 'Yukarı süzülen saydam baloncuklar'],
]

export type WallpaperMode = 'off' | 'theme' | 'single' | 'folder'
export type WallpaperFit = 'fill' | 'fit' | 'stretch' | 'center' | 'tile'

/** What the wallpaper windows show. Pictures and videos come through the private flymedia: protocol. */
export interface WallpaperSource {
  kind: 'image' | 'video' | 'live'
  url?: string
  live?: string
}

export interface WallpaperInfo {
  source: WallpaperSource | null
  fit: WallpaperFit
  paused: boolean
  /** The windows really sit on the desktop layer. */
  attached: boolean
  message: string
  folderCount: number
}

export interface ThemeDef {
  id: string
  name: string
  author?: string
  version?: string
  vars: ThemeVars
  /** Shelf that comes with the theme (optional). */
  desk?: ThemeDesk
  /** Live scene that comes with the theme (a picture or video travels as a file inside the pack). */
  wallpaper?: { live?: LiveWallpaperId }
}

/** One thing an icon pack can replace; `path` is the program it belongs to. */
export interface PackBuilderKey {
  key: string
  label: string
  /** Dock item whose current icon is shown for this key. */
  itemId?: string
  /** Gear-menu entry whose current icon is shown for this key. */
  wheelId?: string
}

export interface LibraryIcon {
  path: string
  name: string
  source: string
}

export interface PackInfo {
  id: string
  type: 'theme' | 'icons'
  name: string
  author?: string
  version?: string
  builtin?: boolean
  /** The theme also carries a shelf. */
  hasDesk?: boolean
  hasWallpaper?: boolean
}

/** Open windows per dock item id (matched by executable). */
export type RunningState = Record<string, { count: number; minimized: boolean }>

export interface StackEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: number
  ext: string
}

/** Where the settings window was last, so it opens in the same place and size. */
export interface SettingsWindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface Persisted {
  schemaVersion: number
  items: DockItem[]
  settings: DockSettings
  widgets: WidgetInstance[]
  settingsWindow?: SettingsWindowState
  wheel?: { hidden: string[]; order: string[]; custom?: { id: string; name: string; path: string }[]; icons?: Record<string, string> }
  toyScores?: ToyScores
  tweaks?: { applied: Record<string, { existed: boolean; type?: string; data?: string }>; log: TweakLogEntry[] }
}

export const SCHEMA_VERSION = 8

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
  deskStyle: 'macos',
  deskColor: '',
  deskOpacity: 1,
  deskDepth: 0,
  shelfGrows: true,
  deskRadTL: 24,
  deskRadTR: 24,
  deskRadBL: 24,
  deskRadBR: 24,
  deskRadLinked: false,
  deskEdge: 0,
  deskTexScale: 100,
  deskTexFile: '',
  deskTexMode: 'tile',
  deskTexX: 0,
  deskTexY: 0,
  deskTexRotate: 0,
  deskPadTop: 10,
  deskPadBottom: 10,
  deskPadLeft: 16,
  deskPadRight: 16,
  deskPadLinked: false,
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
  stackPlacement: 'icon',
  stackView: 'medium',
  stackSort: 'name',
  stackDesc: false,
  separatorStyle: 'auto',
  sepThickness: 0,
  sepHeight: 70,
  sepColor: '',
  sepRadius: 2,
  sepBorderL: 0,
  sepBorderR: 0,
  sepBorderLColor: '',
  sepBorderRColor: '',
  labelMode: 'hover',
  soundEnabled: true,
  soundVolume: 40,
  soundTheme: 'soft',
  soundGroups: ['click', 'launch', 'dock', 'windows', 'menus', 'trash', 'dialogs', 'ui'],
  labelSize: 12,
  labelFont: '',
  layer: 'above',
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
  iconPack: 'fly-win11',
  themeDesk: true,
  wallpaperMode: 'off',
  wallpaperSingle: '',
  wallpaperFolder: '',
  wallpaperMinutes: 10,
  wallpaperShuffle: true,
  wallpaperFit: 'fill',
  wallpaperPauseFullscreen: true,
  wallpaperPauseBattery: true,
  iconFolders: [],
  toyPet: false,
  toyPetKind: 'cat',
  toyPetName: 'Pamuk',
  toyPetChase: true,
  toyPetSize: 72,
  toyBasket: false,
  toyFootball: false,
  toyTennis: false,
  toySound: true,
  toyLayer: 'above',
  toyFloor: 'dock',
  toyHoopSide: 'right',
  toyPetPlay: true,
}

// ---- IPC contract: one table drives the preload bridge, the main-process handlers and the renderer calls ----

export interface InvokeMap {
  'items:get': { args: []; result: DockItem[] }
  'items:set': { args: [items: DockItem[]]; result: DockItem[] }
  'items:add-paths': { args: [paths: string[], index: number]; result: DockItem[] }
  'items:remove': { args: [id: string]; result: DockItem[] }
  'items:update': { args: [id: string, patch: Partial<Pick<DockItem, 'label' | 'hotkey' | 'customIconPath'>>]; result: DockItem[] }
  'items:activate': { args: [id: string]; result: void }
  'places:list': { args: []; result: PlaceInfo[] }
  'places:add': { args: [id: string]; result: DockItem[] }
  'places:icon': { args: [id: string]; result: string | null }
  'items:icon': { args: [id: string]; result: string | null }
  'icon:path': { args: [path: string]; result: string | null }
  'settings:get': { args: []; result: DockSettings }
  'settings:update': { args: [partial: Partial<DockSettings>]; result: DockSettings }
  'displays:list': { args: []; result: { id: number; label: string; primary: boolean }[] }
  'windows:get': { args: []; result: RunningState }
  'trash:get': { args: []; result: { items: number } }
  'trash:drop': { args: [paths: string[]]; result: void }
  'menu:show': { args: [payload: { kind: 'empty' | 'icon'; itemId?: string }]; result: void }
  'dock:layout': { args: [layout: { main: number; cross: number }]; result: void }
  'dock:state': { args: []; result: { hidden: boolean; onTop: boolean } }
  'stack:thumb': { args: [path: string, size: number]; result: string | null }
  'stack:list': { args: [id: string]; result: StackEntry[] }
  'wheel:list': { args: []; result: { entries: WheelEntry[]; hidden: string[] } }
  'wheel:run': { args: [id: string]; result: boolean }
  'wheel:add': { args: [kind: 'file' | 'folder']; result: { entries: WheelEntry[]; hidden: string[] } | null }
  'wheel:remove': { args: [id: string]; result: { entries: WheelEntry[]; hidden: string[] } }
  'wheel:icon': { args: [id: string, file: string | null]; result: { ok: boolean; message: string; data?: { entries: WheelEntry[]; hidden: string[] } } }
  'wheel:set': { args: [state: { hidden: string[]; order: string[] }]; result: { entries: WheelEntry[]; hidden: string[] } }
  'power:run': { args: [action: PowerAction]; result: { ok: boolean; message: string } }
  'power:close': { args: []; result: void }
  'tweaks:list': { args: []; result: TweakInfo[] }
  'tweaks:set': { args: [id: string, enabled: boolean]; result: { ok: boolean; message: string } }
  'tweaks:restore-point': { args: []; result: { ok: boolean; message: string } }
  'tweaks:revert-all': { args: []; result: number }
  'tweaks:log': { args: []; result: TweakLogEntry[] }
  'tweaks:restart-explorer': { args: []; result: void }
  'texture:pick': { args: []; result: { ok: boolean; file?: string; message: string } }
  'texture:get': { args: [file: string]; result: string | null }
  'texture:remove': { args: [file: string]; result: void }
  'stack:close': { args: []; result: void }
  'group:add': { args: [id: string, paths: string[]]; result: DockItem[] }
  'menu:items': { args: []; result: MenuItemView[] }
  'menu:pick': { args: [index: number]; result: void }
  'menu:close': { args: []; result: void }
  'stack:open': { args: [path: string]; result: void }
  'stack:show': { args: [id: string, anchor: { x: number; y: number }]; result: void }
  'builder:keys': { args: []; result: PackBuilderKey[] }
  'builder:folder': { args: [keys: string[]]; result: Record<string, { path: string; preview: string }> }
  'library:list': { args: []; result: { icons: LibraryIcon[]; folders: string[] } }
  'library:thumb': { args: [path: string]; result: string | null }
  'library:pick': { args: []; result: { path: string; preview: string } | null }
  'library:add-folder': { args: []; result: boolean }
  'library:remove-folder': { args: [folder: string]; result: void }
  'iconpick:show': { args: [target: string]; result: void }
  'iconpick:info': { args: [target: string]; result: { name: string; current: string | null; custom: boolean } | null }
  'iconpick:apply': { args: [target: string, file: string | null]; result: { ok: boolean; message: string } }
  'iconpick:close': { args: []; result: void }
  'builder:create': { args: [name: string, author: string, map: Record<string, string>]; result: { ok: boolean; message: string; pack?: PackInfo } }
  'confirm:answer': { args: [id: string, answer: boolean, text?: string]; result: void }
  'entry:menu': { args: [request: EntryMenuRequest]; result: void }
  'wallpaper:info': { args: []; result: WallpaperInfo }
  'wallpaper:next': { args: []; result: void }
  'wallpaper:pick-file': { args: []; result: string | null }
  'wallpaper:pick-folder': { args: []; result: string | null }
  'window:control': { args: [action: 'minimize' | 'maximize' | 'close']; result: void }
  'window:is-maximized': { args: []; result: boolean }
  'panel:capture': { args: [on: boolean]; result: void }
  'toys:capture': { args: [on: boolean]; result: void }
  'toys:scores': { args: [patch?: Partial<ToyScores>]; result: ToyScores }
  'panel:blurred': { args: []; result: boolean }
  'themes:create': { args: [name: string, author: string, vars: ThemeVars, withDesk: boolean, withWallpaper: boolean]; result: { ok: boolean; message: string; pack?: PackInfo } }
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
  'app:info': { args: []; result: { name: string; version: string; tagline: string; kofiUrl: string; loginSupported: boolean; loginEnabled: boolean } }
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
  'icons:changed': null
  'stack:changed': null
  'wallpaper:changed': WallpaperInfo
  'window:maximized': boolean
  'sound:play': SoundEvent
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap
