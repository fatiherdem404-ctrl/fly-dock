// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
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
import { helper } from './helper'
import { runWheelEntry, wheelEntries, setWheelState, removeWheelEntry, renameWheelEntry } from './wheel'
import type { EntryMenuRequest } from '../src/shared/types'

import { t } from '../src/i18n'
const FORBIDDEN = /[\\/:*?"<>|]/

function fileProblem(name: string, dir: string, old: string): string | null {
  if (!name.trim()) return t('Ad boş olamaz.')
  if (FORBIDDEN.test(name)) return t('Ad şu karakterleri içeremez: \\ / : * ? " < > |')
  if (name !== old && fs.existsSync(path.join(dir, name))) return t('Bu adda bir öğe zaten var.')
  return null
}

async function rename(itemId: string, target: string) {
  const dir = path.dirname(target)
  const old = path.basename(target)
  let value = old
  for (;;) {
    const answer = await askInput({ title: t('Yeniden adlandır'), message: t('Yeni adı yaz.'), confirmLabel: t('Adlandır'), cancelLabel: t('Vazgeç'), value })
    if (answer === null) return
    value = answer.trim()
    if (value === old) return
    const problem = fileProblem(value, dir, old)
    if (!problem) break
    const retry = await askConfirm({ title: t('Bu ad olmaz'), message: problem, confirmLabel: t('Tekrar dene'), cancelLabel: t('Vazgeç') })
    if (!retry) return
  }
  const next = path.join(dir, value)
  try {
    fs.renameSync(target, next)
  } catch (err) {
    await askConfirm({ title: t('Adlandırılamadı'), message: (err as Error).message, confirmLabel: t('Tamam'), cancelLabel: t('Kapat') })
    return
  }
  if (getItems().find((i) => i.id === itemId)?.type === 'group') replaceInGroup(itemId, target, next)
  broadcast('stack:changed', null)
  focusStack()
}

async function remove(itemId: string, target: string) {
  const name = path.basename(target)
  const yes = await askConfirm({ title: t('"{name}" silinsin mi?', { name }), message: t('Geri dönüşüm kutusuna taşınır; oradan geri alabilirsin.'), confirmLabel: t('Sil'), danger: true })
  if (!yes) return
  try {
    await shell.trashItem(target)
  } catch (err) {
    await askConfirm({ title: t('Silinemedi'), message: (err as Error).message, confirmLabel: t('Tamam'), cancelLabel: t('Kapat') })
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
    add(t('Aç'), 'open', () => {
      closeStack()
      shell.openPath(target)
    })
    add(t('Konumunu aç'), 'location', () => shell.showItemInFolder(target))
    add(t('Dock\'a ekle'), 'pin', () => addPaths([target], getItems().length), { disabled: getItems().some((i) => i.targetPath?.toLowerCase() === target.toLowerCase()) })
    separator()
    add(t('Yolu kopyala'), 'copy', () => clipboard.writeText(target))
    add(t('Yeniden adlandır'), 'edit', () => void rename(item.id, target))
    add(t('Özellikler'), 'list', () => void helper.properties(target).catch(() => {}))
    if (inGroup) add(t('Gruptan çıkar'), 'minus', () => (removeFromGroup(item.id, target), broadcast('stack:changed', null)))
    separator()
    add(t('Sil'), 'trash', () => void remove(item.id, target), { danger: true })
  } else {
    const entry = wheelEntries().entries.find((e) => e.id === request.id)
    if (!entry) return
    add(t('Aç'), 'open', () => {
      closeStack()
      void runWheelEntry(entry.id)
    })
    if (entry.path) add(t('Konumunu aç'), 'location', () => shell.showItemInFolder(entry.path!))
    if (entry.path) add(t('Özellikler'), 'list', () => void helper.properties(entry.path!).catch(() => {}))
    separator()
    add(t('Simge değiştir…'), 'image', () => showIconPicker(`wheel:${entry.id}`))
    if (entry.path) {
      add(t('Yeniden adlandır'), 'edit', async () => {
        const name = await askInput({ title: t('Yeniden adlandır'), message: t('Menüde görünecek adı yaz.'), confirmLabel: t('Adlandır'), value: entry.name })
        if (name?.trim() && renameWheelEntry(entry.id, name.trim())) broadcast('stack:changed', null)
      })
    }
    separator()
    if (entry.path) {
      add(t('Menüden kaldır'), 'trash', () => {
        removeWheelEntry(entry.id)
        broadcast('stack:changed', null)
      }, { danger: true })
    } else {
      add(t('Menüde gizle'), 'eyeOff', () => {
        const state = wheelEntries()
        setWheelState({ hidden: [...state.hidden, entry.id], order: state.entries.map((e) => e.id) })
        broadcast('stack:changed', null)
      })
    }
  }
  popupMenu(specs)
}
