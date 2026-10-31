// WI Tweaks: a small, reversible set of Windows settings, described as data.
// Every tweak is a registry value (or key) under HKCU, so nothing needs administrator rights. Before a tweak is
// applied the previous state is saved, and reverting restores exactly that state. Commands are fixed argument lists
// for reg.exe; nothing the user types ever reaches a command line.
import { execFile } from 'node:child_process'
import os from 'node:os'
import type { TweakInfo, TweakLogEntry } from '../src/shared/types'

export type TweakSpec =
  | { kind: 'value'; key: string; name: string; type: 'REG_DWORD' | 'REG_SZ'; on: string; off: string }
  | { kind: 'key'; key: string }

export interface TweakDef {
  id: string
  name: string
  description: string
  category: string
  risk: 'safe' | 'caution'
  /** Lowest Windows build the tweak applies to (22000 = Windows 11). */
  minBuild?: number
  /** What the user has to do for the change to be visible. */
  effect: 'none' | 'explorer' | 'signout'
  spec: TweakSpec
}

const ADV = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'

export const TWEAKS: TweakDef[] = [
  { id: 'file-extensions', name: 'Dosya uzantılarını göster', description: 'Gezgin, dosya adlarının sonundaki .exe, .txt gibi uzantıları gösterir.', category: 'Gezgin', risk: 'safe', effect: 'explorer', spec: { kind: 'value', key: ADV, name: 'HideFileExt', type: 'REG_DWORD', on: '0', off: '1' } },
  { id: 'hidden-files', name: 'Gizli dosyaları göster', description: 'Gizli işaretli dosya ve klasörler Gezgin\'de görünür.', category: 'Gezgin', risk: 'safe', effect: 'explorer', spec: { kind: 'value', key: ADV, name: 'Hidden', type: 'REG_DWORD', on: '1', off: '2' } },
  { id: 'classic-context-menu', name: 'Klasik sağ tık menüsü', description: 'Windows 11\'de "Daha fazla seçenek" adımı olmadan tam menüyü açar.', category: 'Gezgin', risk: 'safe', minBuild: 22000, effect: 'explorer', spec: { kind: 'key', key: 'HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' } },
  { id: 'taskbar-left', name: 'Görev çubuğunu sola hizala', description: 'Windows 11 görev çubuğu simgeleri ortada değil solda durur.', category: 'Gezgin', risk: 'safe', minBuild: 22000, effect: 'explorer', spec: { kind: 'value', key: ADV, name: 'TaskbarAl', type: 'REG_DWORD', on: '0', off: '1' } },
  { id: 'game-mode', name: 'Oyun Modu açık', description: 'Windows oyun çalışırken arka plan işlerini kısar.', category: 'Performans', risk: 'safe', effect: 'none', spec: { kind: 'value', key: 'HKCU\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', type: 'REG_DWORD', on: '1', off: '0' } },
  { id: 'no-window-animations', name: 'Pencere küçültme animasyonunu kapat', description: 'Pencereler küçülürken ve büyürken animasyon oynatılmaz; sistem biraz daha hızlı hissedilir.', category: 'Performans', risk: 'safe', effect: 'signout', spec: { kind: 'value', key: 'HKCU\\Control Panel\\Desktop\\WindowMetrics', name: 'MinAnimate', type: 'REG_SZ', on: '0', off: '1' } },
  { id: 'no-startup-delay', name: 'Başlangıç gecikmesini kaldır', description: 'Windows açılışta başlangıç programlarını bekletmeden başlatır.', category: 'Başlangıç', risk: 'safe', effect: 'signout', spec: { kind: 'value', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize', name: 'StartupDelayInMSec', type: 'REG_DWORD', on: '0', off: '10000' } },
]

// ---- registry access ----

export interface RegValue {
  type: string
  data: string
}

export interface Registry {
  query(key: string, name: string): Promise<RegValue | null>
  keyExists(key: string): Promise<boolean>
  write(key: string, name: string, type: string, data: string): Promise<void>
  createKey(key: string): Promise<void>
  deleteValue(key: string, name: string): Promise<void>
  deleteKey(key: string): Promise<void>
}

function reg(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true }, (error, stdout) => {
      resolve({ code: error ? 1 : 0, out: String(stdout) })
    })
  })
}

const ensureHkcu = (key: string) => {
  if (!/^HKCU\\/i.test(key)) throw new Error('tweaks may only touch HKCU')
}

export const realRegistry: Registry = {
  async query(key, name) {
    ensureHkcu(key)
    const { code, out } = await reg(['query', key, '/v', name])
    if (code !== 0) return null
    const match = out.split(/\r?\n/).map((l) => l.match(/^\s+(.+?)\s{2,}(REG_\w+)\s*(.*)$/)).find((m) => m && m[1].toLowerCase() === name.toLowerCase())
    if (!match) return null
    // dwords print as 0x1; normalise to decimal so they compare with the spec
    const data = match[2] === 'REG_DWORD' ? String(parseInt(match[3], 16)) : match[3]
    return { type: match[2], data }
  },
  async keyExists(key) {
    ensureHkcu(key)
    return (await reg(['query', key])).code === 0
  },
  async write(key, name, type, data) {
    ensureHkcu(key)
    const { code } = await reg(['add', key, '/v', name, '/t', type, '/d', data, '/f'])
    if (code !== 0) throw new Error(`could not write ${name}`)
  },
  async createKey(key) {
    ensureHkcu(key)
    // an empty default value is what makes the key a real "override"
    const { code } = await reg(['add', key, '/ve', '/d', '', '/f'])
    if (code !== 0) throw new Error('could not create key')
  },
  async deleteValue(key, name) {
    ensureHkcu(key)
    await reg(['delete', key, '/v', name, '/f'])
  },
  async deleteKey(key) {
    ensureHkcu(key)
    await reg(['delete', key, '/f'])
  },
}

// ---- engine ----

interface Backup {
  /** Whether the value/key existed before the tweak was applied, and what it held. */
  existed: boolean
  type?: string
  data?: string
}

export interface TweakStore {
  get(): { applied: Record<string, Backup>; log: TweakLogEntry[] }
  set(state: { applied: Record<string, Backup>; log: TweakLogEntry[] }): void
}

export function createTweakEngine(deps: { registry: Registry; tweaks: TweakDef[]; store: TweakStore; build?: number; now?: () => number }) {
  const { registry, tweaks, store } = deps
  const build = deps.build ?? Number(os.release().split('.')[2])
  const now = deps.now ?? Date.now

  const supported = (t: TweakDef) => !t.minBuild || build >= t.minBuild

  async function isOn(t: TweakDef): Promise<boolean> {
    try {
      if (t.spec.kind === 'key') return await registry.keyExists(t.spec.key)
      const value = await registry.query(t.spec.key, t.spec.name)
      return value?.data === t.spec.on
    } catch {
      return false // a tweak that points outside HKCU is never reported as on
    }
  }

  function log(id: string, action: TweakLogEntry['action']) {
    const state = store.get()
    store.set({ ...state, log: [...state.log, { at: now(), id, action }].slice(-200) })
  }

  async function list(): Promise<TweakInfo[]> {
    const state = store.get()
    const rows: TweakInfo[] = []
    for (const t of tweaks.filter(supported)) {
      rows.push({ id: t.id, name: t.name, description: t.description, category: t.category, risk: t.risk, effect: t.effect, enabled: await isOn(t), changedByUs: t.id in state.applied })
    }
    return rows
  }

  async function turnOn(t: TweakDef) {
    const state = store.get()
    let backup: Backup
    if (t.spec.kind === 'key') {
      if (await registry.keyExists(t.spec.key)) return // already on: nothing of ours to undo later
      backup = { existed: false }
      await registry.createKey(t.spec.key)
    } else {
      const before = await registry.query(t.spec.key, t.spec.name)
      backup = before ? { existed: true, type: before.type, data: before.data } : { existed: false }
      await registry.write(t.spec.key, t.spec.name, t.spec.type, t.spec.on)
    }
    // keep the very first backup: applying twice must never overwrite the original state
    store.set({ ...state, applied: { ...state.applied, [t.id]: state.applied[t.id] ?? backup } })
    log(t.id, 'apply')
  }

  async function turnOff(t: TweakDef) {
    const state = store.get()
    const backup = state.applied[t.id]
    if (t.spec.kind === 'key') {
      await registry.deleteKey(t.spec.key)
    } else if (backup?.existed && backup.type && backup.data !== undefined) {
      await registry.write(t.spec.key, t.spec.name, backup.type, backup.data)
    } else if (backup && !backup.existed) {
      await registry.deleteValue(t.spec.key, t.spec.name)
    } else {
      await registry.write(t.spec.key, t.spec.name, t.spec.type, t.spec.off) // not changed by us: switch to the documented "off" value
    }
    const { [t.id]: _gone, ...rest } = state.applied
    store.set({ ...state, applied: rest })
    log(t.id, 'revert')
  }

  async function set(id: string, enabled: boolean): Promise<{ ok: boolean; message: string }> {
    const t = tweaks.find((x) => x.id === id)
    if (!t || !supported(t)) return { ok: false, message: 'unknown or unsupported tweak' }
    try {
      if (enabled) await turnOn(t)
      else await turnOff(t)
      return { ok: true, message: t.effect }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  }

  async function revertAll(): Promise<number> {
    let count = 0
    for (const id of Object.keys(store.get().applied)) {
      const t = tweaks.find((x) => x.id === id)
      if (t && (await set(id, false)).ok) count++
    }
    return count
  }

  return { list, set, revertAll, log: () => store.get().log }
}
