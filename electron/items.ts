// Dock item logic: adding, removing, launching, and matching items to open windows.
import { shell, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { getItems, getSettings, setItems } from './store'
import { helper, HelperWindow, WindowsSnapshot } from './helper'
import { broadcast } from './ipc'
import type { DockItem, RunningState } from '../src/shared/types'

let snapshot: WindowsSnapshot = { windows: [], fullscreen: false, foreground: 0 }
const linkTargets = new Map<string, string>()

const RUNNING_PREFIX = 'run:'

/** Pinned items plus, when enabled, one temporary icon per running program that is not pinned. */
export function visibleItems(): DockItem[] {
  const pinned = getItems()
  if (!getSettings().showRunningApps) return pinned
  const owned = new Set(pinned.map((i) => exeOf(i)).filter((e): e is string => !!e))
  const seen = new Map<string, HelperWindow>()
  for (const w of snapshot.windows) {
    const key = w.exePath.toLowerCase()
    if (!owned.has(key) && !seen.has(key)) seen.set(key, w)
  }
  if (seen.size === 0) return pinned
  const temps: DockItem[] = [...seen.values()].map((w) => ({
    id: RUNNING_PREFIX + w.exePath.toLowerCase(),
    type: 'app',
    targetPath: w.exePath,
    label: path.win32.basename(w.exePath, '.exe'),
  }))
  const trashAt = pinned.findIndex((i) => i.type === 'trash')
  const head = trashAt >= 0 ? pinned.slice(0, trashAt) : pinned
  const tail = trashAt >= 0 ? pinned.slice(trashAt) : []
  return [...head, { id: 'running-separator', type: 'separator' }, ...temps, ...tail]
}

export const isRunningItem = (id: string) => id.startsWith(RUNNING_PREFIX)

let lastVisible = ''
export function setSnapshot(next: WindowsSnapshot) {
  snapshot = next
  const signature = visibleItems().map((i) => i.id).join('|')
  if (signature !== lastVisible) {
    lastVisible = signature
    broadcast('items:changed', visibleItems())
  }
  broadcast('windows:changed', runningState())
}

export function currentSnapshot() {
  return snapshot
}

/** Executable behind an item; shortcuts are resolved once through the helper. */
function exeOf(item: DockItem): string | null {
  if (item.type !== 'app' || !item.targetPath) return null
  const target = item.targetPath
  if (!target.toLowerCase().endsWith('.lnk')) return target.toLowerCase()
  const cached = linkTargets.get(target)
  if (cached !== undefined) return cached || null
  linkTargets.set(target, '')
  helper
    .resolveLink(target)
    .then((info) => {
      linkTargets.set(target, info?.target.toLowerCase() ?? '')
      broadcast('windows:changed', runningState())
    })
    .catch(() => {})
  return null
}

export function windowsOf(item: DockItem): HelperWindow[] {
  const exe = exeOf(item)
  if (!exe) return []
  return snapshot.windows.filter((w) => w.exePath.toLowerCase() === exe)
}

export function runningState(): RunningState {
  const state: RunningState = {}
  for (const item of visibleItems()) {
    const wins = windowsOf(item)
    if (wins.length) state[item.id] = { count: wins.length, minimized: wins.every((w) => w.minimized) }
  }
  return state
}

let onChanged: (() => void) | null = null
export function onItemsChanged(fn: () => void) {
  onChanged = fn
}

export function broadcastItems() {
  onChanged?.()
  broadcast('items:changed', visibleItems())
  broadcast('windows:changed', runningState())
}

function commit(items: DockItem[]): DockItem[] {
  setItems(items)
  broadcastItems()
  return items
}

function itemFromPath(p: string): DockItem | null {
  let stat: fs.Stats
  try {
    stat = fs.statSync(p)
  } catch {
    return null
  }
  const ext = path.extname(p).toLowerCase()
  const label = path.basename(p, ext)
  const id = crypto.randomUUID()
  if (stat.isDirectory()) return { id, type: 'folder', targetPath: p, label: path.basename(p) || p }
  if (ext === '.exe' || ext === '.lnk') return { id, type: 'app', targetPath: p, label }
  return { id, type: 'file', targetPath: p, label: path.basename(p) }
}

export function addPaths(paths: string[], index: number): DockItem[] {
  const items = [...getItems()]
  const trashAt = items.findIndex((i) => i.type === 'trash')
  const limit = trashAt >= 0 ? trashAt : items.length
  let at = Math.min(Math.max(index, 0), limit)
  for (const p of paths) {
    const item = itemFromPath(p)
    if (!item) continue
    if (items.some((i) => i.targetPath?.toLowerCase() === p.toLowerCase())) continue
    items.splice(at++, 0, item)
  }
  return commit(items)
}

export function addSeparator(): DockItem[] {
  const items = [...getItems()]
  const trashAt = items.findIndex((i) => i.type === 'trash')
  items.splice(trashAt >= 0 ? trashAt : items.length, 0, { id: crypto.randomUUID(), type: 'separator' })
  return commit(items)
}

export function removeItem(id: string): DockItem[] {
  return commit(getItems().filter((i) => i.id !== id || i.type === 'trash'))
}

export function updateItem(id: string, patch: Partial<DockItem>): DockItem[] {
  return commit(getItems().map((i) => (i.id === id ? { ...i, ...patch } : i)))
}

export function replaceItems(next: DockItem[]): DockItem[] {
  const known = new Map(getItems().map((i) => [i.id, i]))
  // The renderer may only reorder or drop known items; anything unknown is ignored.
  const cleaned = next.filter((i) => known.has(i.id)).map((i) => known.get(i.id)!)
  return commit(cleaned)
}

/** Adds a built-in item (gear menu, power menu) once; asking again returns the dock unchanged. */
export function addSpecial(type: 'wheel' | 'power', label: string): DockItem[] {
  const items = getItems()
  if (items.some((i) => i.type === type)) return items
  const trashAt = items.findIndex((i) => i.type === 'trash')
  const next = [...items]
  next.splice(trashAt >= 0 ? trashAt : next.length, 0, { id: crypto.randomUUID(), type, label })
  return commit(next)
}

export function addStartButton(): DockItem[] {
  const items = getItems()
  if (items.some((i) => i.type === 'start')) return items
  return commit([{ id: crypto.randomUUID(), type: 'start', label: 'Başlat' }, ...items])
}

export function createGroup(): DockItem[] {
  const items = [...getItems()]
  const trashAt = items.findIndex((i) => i.type === 'trash')
  items.splice(trashAt >= 0 ? trashAt : items.length, 0, { id: crypto.randomUUID(), type: 'group', label: 'Grup', children: [] })
  return commit(items)
}

export function addToGroup(id: string, paths: string[]): DockItem[] {
  return commit(
    getItems().map((i) => {
      if (i.id !== id || i.type !== 'group') return i
      const have = new Set((i.children ?? []).map((p) => p.toLowerCase()))
      return { ...i, children: [...(i.children ?? []), ...paths.filter((p) => !have.has(p.toLowerCase()))] }
    }),
  )
}

export function removeFromGroup(id: string, target: string): DockItem[] {
  return commit(getItems().map((i) => (i.id === id && i.type === 'group' ? { ...i, children: (i.children ?? []).filter((p) => p !== target) } : i)))
}

/** A file inside a group was renamed on disk: the group follows it. */
export function replaceInGroup(id: string, from: string, to: string): DockItem[] {
  return commit(getItems().map((i) => (i.id === id && i.type === 'group' ? { ...i, children: (i.children ?? []).map((p) => (p === from ? to : p)) } : i)))
}

export function openRecycleBin() {
  spawn('explorer.exe', ['shell:RecycleBinFolder'], { detached: true, stdio: 'ignore' }).unref()
}

export async function activateItem(id: string, onStack: (item: DockItem) => void) {
  const item = visibleItems().find((i) => i.id === id)
  const special = ['trash', 'group', 'start', 'wheel', 'power']
  if (!item?.targetPath && !special.includes(item?.type ?? '')) return
  switch (item!.type) {
    case 'trash':
      return openRecycleBin()
    case 'start':
      return void (await helper.startMenu().catch(() => {}))
    case 'stack':
    case 'group':
    case 'wheel':
    case 'power':
      return onStack(item!)
    case 'app': {
      const wins = windowsOf(item!)
      if (wins.length === 0) {
        const err = await shell.openPath(item!.targetPath!)
        if (err) console.error(`launch failed for ${item!.targetPath}: ${err}`)
        return
      }
      const foreground = wins.find((w) => w.hwnd === snapshot.foreground)
      if (foreground) return void (await helper.minimize(foreground.hwnd))
      const target = wins.find((w) => !w.minimized) ?? wins[0]
      return void (await helper.activate(target.hwnd))
    }
    default: {
      const err = await shell.openPath(item!.targetPath!)
      if (err) console.error(`open failed for ${item!.targetPath}: ${err}`)
    }
  }
}

/** Registers or removes the Windows start-up entry. Only meaningful for an installed build. */
export function launchAtLogin(enabled: boolean) {
  if (!app.isPackaged) return // a dev run would register electron.exe itself
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

export function loginEnabled(): boolean {
  return app.isPackaged && app.getLoginItemSettings().openAtLogin
}
