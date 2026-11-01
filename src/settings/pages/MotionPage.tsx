// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import Icon from '@/icons'
import { DockSettings, AnimationCurve, HoverAnimation, IndicatorStyle, LaunchAnimation, ShowAnimation, SpeedPreset, WindowAnimation } from '@/shared/types'
import { Card, Cards, Pages, Row, Slider, Segmented, Update } from '../ui'
import { CurvePreview, HoverPreview, IndicatorPreview, LaunchPreview, ShowPreview, WindowAnimPreview } from '../previews'

import { t } from '../../i18n'
// ---- Motion ----

export function MotionTab({ s, set, preview }: { s: DockSettings; set: Update; preview: () => void }) {
  return (
    <Pages id="motion">
      <Card icon="clock" tab={t('Hız')} title={t('Hız')} hint={t('Tüm dock animasyonlarının süresi ve hareketin karakteri')}>
        <Row icon="play" label={t('Hız')}><Segmented<SpeedPreset> value={s.speed} onChange={(speed) => set({ speed })} options={[['fast', t('Hızlı')], ['medium', t('Orta')], ['slow', t('Yavaş')], ['custom', t('Özel')]]} /></Row>
        {s.speed === 'custom' && <Row icon="clock" label={t('Süre')}><Slider value={s.speedMs} min={100} max={1500} step={10} unit=" ms" onChange={(speedMs) => set({ speedMs })} /></Row>}
        <Row icon="motion" label={t('Hareket tipi')} hint={t('Grafik: bir değerin zamanla nasıl değiştiği')} />
        <Cards<AnimationCurve> size="s" value={s.animationCurve} onChange={(animationCurve) => set({ animationCurve })} options={[
          { id: 'spring', label: t('Yay'), hint: t('Sıçramasız, canlı'), preview: <CurvePreview curve="spring" /> },
          { id: 'bounce', label: t('Zıplayan yay'), hint: t('Hedefi aşıp döner'), preview: <CurvePreview curve="bounce" /> },
          { id: 'ease', label: t('Yumuşak'), hint: t('Başı ve sonu yavaş'), preview: <CurvePreview curve="ease" /> },
          { id: 'linear', label: t('Düz'), hint: t('Sabit hızla'), preview: <CurvePreview curve="linear" /> },
        ]} />
      </Card>
      <Card icon="cursor" tab={t('Simge efektleri')} title={t('Fare üzerine gelince')} hint={t('Fare simgelerin üstünden geçerken ne olsun')}>
        <Cards<HoverAnimation> value={s.hoverAnimation} onChange={(hoverAnimation) => set({ hoverAnimation })} options={[
          { id: 'zoom', label: t('Büyüme'), hint: t('Simge büyür'), preview: <HoverPreview kind="zoom" /> },
          { id: 'lift', label: t('Yükselme'), hint: t('Simge raftan kalkar'), preview: <HoverPreview kind="lift" /> },
          { id: 'wave', label: t('Dalga'), hint: t('Büyür ve kalkar'), preview: <HoverPreview kind="wave" /> },
        ]} />
      </Card>
      <Card icon="open" tab={t('Simge efektleri')} title={t('Uygulama başlatma')} hint={t('Bir programı başlatınca simgenin hareketi')}>
        <Cards<LaunchAnimation> size="s" value={s.launchAnimation} onChange={(launchAnimation) => set({ launchAnimation })} options={[
          { id: 'bounce', label: t('Sıçrama'), hint: t('İki kez zıplar'), preview: <LaunchPreview kind="bounce" /> },
          { id: 'hop', label: t('Atlama'), hint: t('Tek zıplama'), preview: <LaunchPreview kind="hop" /> },
          { id: 'pulse', label: t('Işık atımı'), hint: t('Parlar ve büyür'), preview: <LaunchPreview kind="pulse" /> },
          { id: 'none', label: t('Yok'), preview: <LaunchPreview kind="none" /> },
        ]} />
        <div className="st-row-inline"><button className="st-btn" onClick={preview}><Icon name="play" size={14} />{t('Üstteki canlı dock’ta dene')}</button></div>
      </Card>
      <Card icon="check" tab={t('Simge efektleri')} title={t('Çalışan uygulama göstergesi')} hint={t('Açık programın simgesinin altındaki işaret')}>
        <Cards<IndicatorStyle> size="s" value={s.indicatorStyle} onChange={(indicatorStyle) => set({ indicatorStyle })} options={[
          { id: 'dot', label: t('Nokta'), preview: <IndicatorPreview kind="dot" /> },
          { id: 'bar', label: t('Çubuk'), preview: <IndicatorPreview kind="bar" /> },
          { id: 'glow', label: t('Işıltı'), preview: <IndicatorPreview kind="glow" /> },
          { id: 'ring', label: t('Halka'), preview: <IndicatorPreview kind="ring" /> },
        ]} />
      </Card>
      <Card icon="dock" tab={t('Dock ve pencereler')} title={t('Dock giriş ve çıkışı')} hint={t('Otomatik gizleme açıkken dock’un ekrana gelişi')}>
        <Cards<ShowAnimation> size="s" value={s.showAnimation} onChange={(showAnimation) => set({ showAnimation })} options={[
          { id: 'slide', label: t('Kayma'), preview: <ShowPreview kind="slide" /> },
          { id: 'fade', label: t('Solma'), preview: <ShowPreview kind="fade" /> },
          { id: 'scale', label: t('Ölçek'), preview: <ShowPreview kind="scale" /> },
        ]} />
      </Card>
      <Card icon="window" tab={t('Dock ve pencereler')} title={t('Dock pencereleri')} hint={t('Klasör, grup ve kontrol paneli penceresinin açılış ve kapanış efekti')}>
        <Cards<WindowAnimation> size="s" value={s.windowAnimation} onChange={(windowAnimation) => set({ windowAnimation })} options={[
          { id: 'genie', label: t('Cin'), hint: t('Simgeden akarak açılır, geri çekilir'), preview: <WindowAnimPreview kind="genie" /> },
          { id: 'scale', label: t('Büyüme'), preview: <WindowAnimPreview kind="scale" /> },
          { id: 'fade', label: t('Solma'), preview: <WindowAnimPreview kind="fade" /> },
          { id: 'slide', label: t('Kayma'), preview: <WindowAnimPreview kind="slide" /> },
        ]} />
      </Card>
    </Pages>
  )
}
