// Icon resolution for dock items: custom file > active icon pack > shell icon of the target.
import fs from 'node:fs'
import { shellIcon, fileIcon } from './iconService'
import { packIconFor } from './packs'
import { getSettings } from './store'
import type { DockItem } from '../src/shared/types'

// The Windows four-pane logo, drawn as a vector so it stays sharp at any size.
const START_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc2ff"/><stop offset="1" stop-color="#0a64d8"/></linearGradient></defs><path fill="url(#g)" d="M6 11.5 27 8.6v21.1H6zM30 8.2 58 4v25.7H30zM6 33.2h21v21.1L6 51.4zM30 33.2h28V60l-28-4.2z"/></svg>',
  )

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
  if (item.type === 'start') return START_ICON
  if (item.type === 'group') return shellIcon(process.env.SystemRoot ?? 'C:/Windows')
  if (item.targetPath) return shellIcon(item.targetPath)
  return null
}
