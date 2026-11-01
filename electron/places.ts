// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Ready-made dock items, like RocketDock's "add item" list: the usual places of the PC and the dock's own menus.
// Every place is a normal dock item (so it can be renamed, re-iconed and removed); this file only knows how to make one.
import { app } from 'electron'
import crypto from 'node:crypto'
import { getItems } from './store'
import { addItem } from './items'
import { iconForItem } from './icons'
import type { DockItem, PlaceInfo } from '../src/shared/types'

import { t } from '../src/i18n'
interface Place {
  id: string
  label: string
  make: () => Omit<DockItem, 'id'>
  /** True when the dock already has this place (some can only be there once). */
  has: (item: DockItem) => boolean
}

const shellPlace = (id: string, label: string, target: string): Place => ({
  id, label,
  make: () => ({ type: 'file', targetPath: target, label }),
  has: (i) => i.targetPath?.toLowerCase() === target.toLowerCase(),
})
const folderPlace = (id: string, label: string, name: Parameters<typeof app.getPath>[0]): Place => ({
  id, label,
  make: () => ({ type: 'folder', targetPath: app.getPath(name), label }),
  has: (i) => i.targetPath?.toLowerCase() === app.getPath(name).toLowerCase(),
})
const special = (id: string, label: string, type: DockItem['type']): Place => ({ id, label, make: () => ({ type, label }), has: (i) => i.type === type })

const PLACES: Place[] = [
  shellPlace('computer', t('Bilgisayarım'), 'shell:MyComputerFolder'),
  shellPlace('profile', t('Kullanıcı klasörüm'), 'shell:Profile'),
  folderPlace('documents', t('Belgelerim'), 'documents'),
  folderPlace('desktop', t('Masaüstü'), 'desktop'),
  folderPlace('downloads', t('İndirilenler'), 'downloads'),
  folderPlace('pictures', t('Resimler'), 'pictures'),
  folderPlace('music', t('Müzik'), 'music'),
  folderPlace('videos', t('Videolar'), 'videos'),
  shellPlace('network', t('Ağ'), 'shell:NetworkPlacesFolder'),
  special('controlpanel', t('Kontrol paneli'), 'wheel'),
  special('trash', t('Geri Dönüşüm Kutusu'), 'trash'),
  special('power', t('Güç menüsü'), 'power'),
  special('start', t('Başlat düğmesi'), 'start'),
]

export function listPlaces(): PlaceInfo[] {
  const items = getItems()
  return PLACES.map((p) => ({ id: p.id, label: p.label, added: items.some(p.has) }))
}

export function addPlace(id: string): DockItem[] {
  const place = PLACES.find((p) => p.id === id)
  if (!place) return getItems()
  if (getItems().some(place.has)) return getItems()
  return addItem({ id: crypto.randomUUID(), ...place.make() })
}

export function placeIcon(id: string): Promise<string | null> {
  const place = PLACES.find((p) => p.id === id)
  return place ? iconForItem({ id: `place-${id}`, ...place.make() }) : Promise.resolve(null)
}
