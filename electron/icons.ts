// Icon resolution for dock items: custom file > active icon pack > shell icon of the target.
import fs from 'node:fs'
import { shellIcon, fileIcon } from './iconService'
import { packIconFor } from './packs'
import { getSettings } from './store'
import type { DockItem } from '../src/shared/types'

let trashFull = false

export function setTrashState(items: number) {
  trashFull = items > 0
}

export function trashHasItems() {
  return trashFull
}

export async function iconForItem(item: DockItem): Promise<string | null> {
  if (item.customIconPath) {
    const custom = fileIcon(item.customIconPath)
    if (custom) return custom
  }
  const packFile = packIconFor(getSettings().iconPack, item, trashFull)
  if (packFile && fs.existsSync(packFile)) {
    const fromPack = fileIcon(packFile)
    if (fromPack) return fromPack
  }
  if (item.type === 'trash') return shellIcon('shell:RecycleBinFolder', 128, trashFull ? 'full' : 'empty')
  if (item.targetPath) return shellIcon(item.targetPath)
  return null
}
