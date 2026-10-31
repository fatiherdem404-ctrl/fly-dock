// The gear ("çark") menu: a fixed catalogue of Windows control panels, settings pages and admin tools.
// Only entries from this list can run, and the renderer only ever sends an entry id, never a command line.
import { dialog, shell } from 'electron'
import crypto from 'node:crypto'
import path from 'node:path'
import { pickTexture } from './textures'
import { spawn } from 'node:child_process'
import { store } from './store'
import type { WheelEntry } from '../src/shared/types'

type Launch =
  | { kind: 'control'; file: string }
  | { kind: 'uri'; uri: string }
  | { kind: 'msc'; file: string }
  | { kind: 'exe'; file: string }

interface CatalogEntry extends WheelEntry {
  launch: Launch
}

const entry = (id: string, name: string, category: string, icon: string, launch: Launch): CatalogEntry => ({ id, name, category, icon, launch })

export const CATALOG: CatalogEntry[] = [
  entry('apps', 'Programlar ve Özellikler', 'Sistem', 'apps', { kind: 'control', file: 'appwiz.cpl' }),
  entry('system', 'Sistem özellikleri', 'Sistem', 'chip', { kind: 'control', file: 'sysdm.cpl' }),
  entry('power', 'Güç seçenekleri', 'Sistem', 'battery', { kind: 'control', file: 'powercfg.cpl' }),
  entry('datetime', 'Tarih ve saat', 'Sistem', 'clock', { kind: 'control', file: 'timedate.cpl' }),
  entry('mouse', 'Fare', 'Sistem', 'cursor', { kind: 'control', file: 'main.cpl' }),
  entry('controlpanel', 'Denetim Masası', 'Sistem', 'settings', { kind: 'exe', file: 'control.exe' }),
  entry('sound', 'Ses', 'Donanım', 'sound', { kind: 'control', file: 'mmsys.cpl' }),
  entry('display', 'Ekran', 'Donanım', 'monitor', { kind: 'uri', uri: 'ms-settings:display' }),
  entry('bluetooth', 'Bluetooth', 'Donanım', 'bluetooth', { kind: 'uri', uri: 'ms-settings:bluetooth' }),
  entry('devices', 'Aygıt Yöneticisi', 'Donanım', 'chip', { kind: 'msc', file: 'devmgmt.msc' }),
  entry('network', 'Ağ bağlantıları', 'Ağ', 'network', { kind: 'control', file: 'ncpa.cpl' }),
  entry('wifi', 'Wi-Fi', 'Ağ', 'wifi', { kind: 'uri', uri: 'ms-settings:network-wifi' }),
  entry('apps-settings', 'Uygulamalar (Ayarlar)', 'Ayarlar', 'apps', { kind: 'uri', uri: 'ms-settings:appsfeatures' }),
  entry('personalize', 'Kişiselleştirme', 'Ayarlar', 'theme', { kind: 'uri', uri: 'ms-settings:personalization' }),
  entry('startup', 'Başlangıç uygulamaları', 'Ayarlar', 'play', { kind: 'uri', uri: 'ms-settings:startupapps' }),
  entry('storage', 'Depolama', 'Ayarlar', 'disk', { kind: 'uri', uri: 'ms-settings:storagesense' }),
  entry('taskmgr', 'Görev Yöneticisi', 'Araçlar', 'chip', { kind: 'exe', file: 'taskmgr.exe' }),
  entry('disks', 'Disk Yönetimi', 'Araçlar', 'disk', { kind: 'msc', file: 'diskmgmt.msc' }),
  entry('services', 'Hizmetler', 'Araçlar', 'tools', { kind: 'msc', file: 'services.msc' }),
  entry('events', 'Olay Görüntüleyici', 'Araçlar', 'list', { kind: 'msc', file: 'eventvwr.msc' }),
  entry('computer', 'Bilgisayar Yönetimi', 'Araçlar', 'tools', { kind: 'msc', file: 'compmgmt.msc' }),
]

const DEFAULT_HIDDEN = ['computer', 'events', 'storage']

interface CustomEntry {
  id: string
  name: string
  path: string
}

export interface WheelState {
  hidden: string[]
  order: string[]
  custom: CustomEntry[]
  icons: Record<string, string>
}

const ICON_FILE = /^[0-9a-f]{16}.(png|jpg|webp)$/

export function wheelState(): WheelState {
  const saved = store.get('wheel') as Partial<WheelState> | undefined
  const custom = saved?.custom ?? []
  const all = [...CATALOG.map((e) => e.id), ...custom.map((c) => c.id)]
  const order = [...(saved?.order ?? []).filter((id) => all.includes(id)), ...all.filter((id) => !(saved?.order ?? []).includes(id))]
  return { hidden: saved?.hidden ?? DEFAULT_HIDDEN, order, custom, icons: saved?.icons ?? {} }
}

/** Order and visibility from the settings page; the entries themselves (custom ones, icons) change through their own calls. */
export function setWheelState(next: { hidden: string[]; order: string[] }): WheelState {
  const current = wheelState()
  const known = new Set(current.order)
  const state: WheelState = {
    ...current,
    hidden: next.hidden.filter((id) => known.has(id)),
    order: [...next.order.filter((id) => known.has(id)), ...current.order.filter((id) => !next.order.includes(id))],
  }
  store.set('wheel', state)
  return state
}

/** Every entry in the user's order, with a flag for the ones they switched off. */
export function wheelEntries(): { entries: WheelEntry[]; hidden: string[] } {
  const { hidden, order, custom, icons } = wheelState()
  const byId = new Map<string, WheelEntry>(CATALOG.map(({ launch: _launch, ...view }) => [view.id, view]))
  for (const c of custom) byId.set(c.id, { id: c.id, name: c.name, category: 'Eklediklerim', icon: 'folder', path: c.path })
  const entries = order.map((id) => byId.get(id)).filter((e): e is WheelEntry => !!e).map((e) => (icons[e.id] ? { ...e, iconFile: icons[e.id] } : e))
  return { entries, hidden }
}

/** Adds a file, program or folder the user picks in the system dialog. Only paths chosen there are ever stored. */
export async function addWheelEntry(kind: 'file' | 'folder'): Promise<boolean> {
  const result = await dialog.showOpenDialog({ properties: [kind === 'folder' ? 'openDirectory' : 'openFile'] })
  if (result.canceled || !result.filePaths[0]) return false
  const target = result.filePaths[0]
  const state = wheelState()
  const entry: CustomEntry = { id: `c-${crypto.randomBytes(5).toString('hex')}`, name: path.basename(target, path.extname(target)) || target, path: target }
  store.set('wheel', { ...state, custom: [...state.custom, entry], order: [...state.order, entry.id] })
  return true
}

export function removeWheelEntry(id: string) {
  const state = wheelState()
  if (!state.custom.some((c) => c.id === id)) return
  const { [id]: _gone, ...icons } = state.icons
  store.set('wheel', { ...state, custom: state.custom.filter((c) => c.id !== id), order: state.order.filter((o) => o !== id), hidden: state.hidden.filter((h) => h !== id), icons })
}

/** Gives an entry its own picture (picked in a dialog when `file` is a name, cleared when null). */
export async function setWheelIcon(id: string, clear: boolean): Promise<{ ok: boolean; message: string }> {
  const state = wheelState()
  if (!state.order.includes(id)) return { ok: false, message: 'unknown entry' }
  if (clear) {
    const { [id]: _gone, ...icons } = state.icons
    store.set('wheel', { ...state, icons })
    return { ok: true, message: 'cleared' }
  }
  const picked = await pickTexture()
  if (!picked.ok || !picked.file || !ICON_FILE.test(picked.file)) return { ok: false, message: picked.message }
  store.set('wheel', { ...state, icons: { ...state.icons, [id]: picked.file } })
  return { ok: true, message: picked.file }
}

function spawnDetached(file: string, args: string[]) {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: false })
  child.on('error', () => {
    /* a tool that is not installed simply does not open */
  })
  child.unref()
}

/** Runs a catalogue entry by id. Unknown ids do nothing. */
export async function runWheelEntry(id: string): Promise<boolean> {
  const own = wheelState().custom.find((c) => c.id === id)
  if (own) return (await shell.openPath(own.path)) === ''
  const found = CATALOG.find((e) => e.id === id)
  if (!found) return false
  const { launch } = found
  switch (launch.kind) {
    case 'control':
      spawnDetached('control.exe', [launch.file])
      return true
    case 'msc':
      spawnDetached('mmc.exe', [launch.file])
      return true
    case 'exe':
      spawnDetached(launch.file, [])
      return true
    case 'uri':
      if (!launch.uri.startsWith('ms-settings:')) return false
      await shell.openExternal(launch.uri)
      return true
  }
}
