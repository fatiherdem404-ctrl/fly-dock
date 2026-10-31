// Right-click menus for the entries inside the dock's own windows (folder, group and gear windows), modelled on the
// Windows context menu: open, show location, rename, copy path, delete. Every action runs here in the main process
// on a path or id that the window itself listed.
import { clipboard, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { popupMenu, MenuSpec } from './contextMenu'
import { askConfirm, askInput } from './confirm'
import { closeStack, readEntries, focusStack } from './stackWindow'
import { getItems } from './store'
import { addPaths, removeFromGroup, replaceInGroup } from './items'
import { broadcast } from './ipc'
import { showIconPicker } from './iconPicker'
import { runWheelEntry, wheelEntries, setWheelState, removeWheelEntry, renameWheelEntry } from './wheel'
import type { EntryMenuRequest } from '../src/shared/types'

const FORBIDDEN = /[\\/:*?"<>|]/

function fileProblem(name: string, dir: string, old: string): string | null {
  if (!name.trim()) return 'Ad boş olamaz.'
  if (FORBIDDEN.test(name)) return 'Ad şu karakterleri içeremez: \\ / : * ? " < > |'
  if (name !== old && fs.existsSync(path.join(dir, name))) return 'Bu adda bir öğe zaten var.'
  return null
}

async function rename(itemId: string, target: string) {
  const dir = path.dirname(target)
  const old = path.basename(target)
  let value = old
  for (;;) {
    const answer = await askInput({ title: 'Yeniden adlandır', message: 'Yeni adı yaz.', confirmLabel: 'Adlandır', cancelLabel: 'Vazgeç', value })
    if (answer === null) return
    value = answer.trim()
    if (value === old) return
    const problem = fileProblem(value, dir, old)
    if (!problem) break
    const retry = await askConfirm({ title: 'Bu ad olmaz', message: problem, confirmLabel: 'Tekrar dene', cancelLabel: 'Vazgeç' })
    if (!retry) return
  }
  const next = path.join(dir, value)
  try {
    fs.renameSync(target, next)
  } catch (err) {
    await askConfirm({ title: 'Adlandırılamadı', message: (err as Error).message, confirmLabel: 'Tamam', cancelLabel: 'Kapat' })
    return
  }
  if (getItems().find((i) => i.id === itemId)?.type === 'group') replaceInGroup(itemId, target, next)
  broadcast('stack:changed', null)
  focusStack()
}

async function remove(itemId: string, target: string) {
  const name = path.basename(target)
  const yes = await askConfirm({ title: `"${name}" silinsin mi?`, message: 'Geri dönüşüm kutusuna taşınır; oradan geri alabilirsin.', confirmLabel: 'Sil', danger: true })
  if (!yes) return
  try {
    await shell.trashItem(target)
  } catch (err) {
    await askConfirm({ title: 'Silinemedi', message: (err as Error).message, confirmLabel: 'Tamam', cancelLabel: 'Kapat' })
    return
  }
  if (getItems().find((i) => i.id === itemId)?.type === 'group') removeFromGroup(itemId, target)
  broadcast('stack:changed', null)
  focusStack()
}

export function showEntryMenu(request: EntryMenuRequest) {
  const specs: MenuSpec[] = []
  const add = (label: string, icon: string, action: () => void, extra: Partial<MenuSpec> = {}) => specs.push({ label, icon, action, ...extra })
  const separator = () => specs.push({ separator: true })

  if (request.kind === 'stack') {
    // only paths the window really lists can be acted on
    const item = getItems().find((i) => i.id === request.itemId)
    const target = item && readEntries(item).find((e) => e.path === request.path)?.path
    if (!item || !target) return
    const inGroup = item.type === 'group'
    add('Aç', 'open', () => {
      closeStack()
      shell.openPath(target)
    })
    add('Konumunu aç', 'location', () => shell.showItemInFolder(target))
    add("Dock'a ekle", 'pin', () => addPaths([target], getItems().length), { disabled: getItems().some((i) => i.targetPath?.toLowerCase() === target.toLowerCase()) })
    separator()
    add('Yolu kopyala', 'copy', () => clipboard.writeText(target))
    add('Yeniden adlandır', 'edit', () => void rename(item.id, target))
    if (inGroup) add('Gruptan çıkar', 'minus', () => (removeFromGroup(item.id, target), broadcast('stack:changed', null)))
    separator()
    add('Sil', 'trash', () => void remove(item.id, target), { danger: true })
  } else {
    const entry = wheelEntries().entries.find((e) => e.id === request.id)
    if (!entry) return
    add('Aç', 'open', () => {
      closeStack()
      void runWheelEntry(entry.id)
    })
    if (entry.path) add('Konumunu aç', 'location', () => shell.showItemInFolder(entry.path!))
    separator()
    add('Simge değiştir…', 'image', () => showIconPicker(`wheel:${entry.id}`))
    if (entry.path) {
      add('Yeniden adlandır', 'edit', async () => {
        const name = await askInput({ title: 'Yeniden adlandır', message: 'Menüde görünecek adı yaz.', confirmLabel: 'Adlandır', value: entry.name })
        if (name?.trim() && renameWheelEntry(entry.id, name.trim())) broadcast('stack:changed', null)
      })
    }
    separator()
    if (entry.path) {
      add('Menüden kaldır', 'trash', () => {
        removeWheelEntry(entry.id)
        broadcast('stack:changed', null)
      }, { danger: true })
    } else {
      add('Menüde gizle', 'eyeOff', () => {
        const state = wheelEntries()
        setWheelState({ hidden: [...state.hidden, entry.id], order: state.entries.map((e) => e.id) })
        broadcast('stack:changed', null)
      })
    }
  }
  popupMenu(specs)
}
