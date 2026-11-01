// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { invoke, useRemote } from '@/api'
import { DockSettings } from '@/shared/types'
import { Card, Pages, Row, Switch, Update } from '../ui'
import { PackCards } from './PackCards'
import { PackBuilder } from './PackBuilder'
import { ThemeBuilder } from './ThemeBuilder'

export function ThemeTab({ s, set, kind }: { s: DockSettings; set: Update; kind: 'theme' | 'icons' }) {
  const [packs, setPacks] = useRemote('packs:list', [], 'themes:changed')
  const refresh = () => invoke('packs:list').then(setPacks)
  return kind === 'theme' ? (
    <Pages id="themes">
      <Card icon="theme" tab="Temalar" title="Temalar" hint="Karta bir kez tıkla: renkler, cam, yazı tipi, raf ve arka plan o temaya geçer. Resimde temanın masaüstünde nasıl duracağını görürsün.">
        <Row icon="desk" label="Tema seçince rafını da uygula" hint="Kapalıyken yalnızca renkler değişir, rafın olduğu gibi kalır"><Switch label="Temanın rafını uygula" value={s.themeDesk} onChange={(themeDesk) => set({ themeDesk })} /></Row>
        <PackCards packs={packs ?? []} activeId={s.theme} onUse={(theme) => set({ theme })} type="theme" onChanged={refresh} />
      </Card>
      <ThemeBuilder tab="Tema oluştur" packs={packs ?? []} onMade={(theme) => { refresh(); set({ theme }) }} />
    </Pages>
  ) : (
    <Pages id="icons">
      <Card icon="pack" tab="Paketler" title="Simge paketleri" hint="Programların simgelerini toplu değiştirir. Karta tıklayınca dock’taki simgeler o paketten gelir.">
        <PackCards packs={packs ?? []} activeId={s.iconPack} onUse={(iconPack) => set({ iconPack })} type="icons" onChanged={refresh} />
      </Card>
      <PackBuilder tab="Paket oluştur" onMade={(iconPack) => { refresh(); set({ iconPack }) }} />
    </Pages>
  )
}
