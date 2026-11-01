// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { DockSettings, StackSize, StackPlacement } from '@/shared/types'
import { Card, Cards, Pages, Row, Slider, Update } from '../ui'
import { PlacementPreview, SizePreview } from '../previews'

import { t } from '../../i18n'
// ---- Dock windows ----

export function WindowsTab({ s, set }: { s: DockSettings; set: Update }) {
  return (
    <Pages id="windows">
      <Card icon="maximize" tab={t('Pencereler')} title={t('Pencere boyutu')} hint={t('Bir klasöre ya da gruba tıklayınca açılan dock penceresinin boyutu. Pencereyi kenarından sürükleyip büyütürsen boyut \'Özel\' olarak hatırlanır.')}>
        <Cards<StackSize> size="s" value={s.stackSize} onChange={(stackSize) => set({ stackSize })} options={[
          { id: 'small', label: t('Küçük'), hint: '360 × 300', preview: <SizePreview size="small" /> },
          { id: 'medium', label: t('Orta'), hint: '520 × 420', preview: <SizePreview size="medium" /> },
          { id: 'full', label: t('Tam ekran'), hint: t('Çalışma alanı'), preview: <SizePreview size="full" /> },
          { id: 'custom', label: t('Özel'), hint: `${s.stackWidth} × ${s.stackHeight}`, preview: <SizePreview size="custom" /> },
        ]} />
        {s.stackSize === 'custom' && (
          <>
            <Row icon="arrowRight" label={t('Genişlik')}><Slider value={s.stackWidth} min={240} max={1600} step={10} unit=" px" onChange={(stackWidth) => set({ stackWidth })} /></Row>
            <Row icon="arrowDown" label={t('Yükseklik')}><Slider value={s.stackHeight} min={200} max={1000} step={10} unit=" px" onChange={(stackHeight) => set({ stackHeight })} /></Row>
          </>
        )}
      </Card>
      <Card icon="location" tab={t('Pencereler')} title={t('Açılış konumu')} hint={t('Klasör, grup ve kontrol paneli penceresi ekranın neresinde açılsın. Açılış efekti her durumda simgenin olduğu yerden başlar.')}>
        <Cards<StackPlacement> size="s" value={s.stackPlacement} onChange={(stackPlacement) => set({ stackPlacement })} options={[
          { id: 'icon', label: t('Simgenin üstünde'), hint: t('Tıkladığın simgeye yaslı'), preview: <PlacementPreview place="icon" /> },
          { id: 'dock', label: t('Dock ortasında'), hint: t('Dock’un kenarına yaslı'), preview: <PlacementPreview place="dock" /> },
          { id: 'center', label: t('Ekranın ortasında'), hint: t('Çalışma alanının ortası'), preview: <PlacementPreview place="center" /> },
          { id: 'cursor', label: t('Fare imlecinde'), hint: t('İmlecin olduğu yer'), preview: <PlacementPreview place="cursor" /> },
        ]} />
      </Card>
      <Card icon="list" tab={t('Pencereler')} title={t('Nasıl çalışır')}>
        <p className="st-prose">{t('Dock’taki bir klasöre sağ tıklayıp')} <b>{t('Yığın olarak göster')}</b> {t('de, ya da')} <b>{t('Yeni grup')}</b> {t('ile bir uygulama grubu oluştur. Tıklayınca pencere simgeden büyüyerek açılır. Başlık çubuğundan sürükleyip taşıyabilir, kenarlarından yeniden boyutlandırabilirsin. İçindeki öğelere sağ tıklayınca Windows’takine benzer bir menü açılır.')} <kbd>{t('Esc')}</kbd> {t('ya da dışarı tıklama kapatır; kapanırken simgesine geri çekilir.')}</p>
      </Card>
    </Pages>
  )
}
