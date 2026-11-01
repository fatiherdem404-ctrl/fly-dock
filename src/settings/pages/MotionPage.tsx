// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import Icon from '@/icons'
import { DockSettings, AnimationCurve, HoverAnimation, IndicatorStyle, LaunchAnimation, ShowAnimation, SpeedPreset, WindowAnimation } from '@/shared/types'
import { Card, Cards, Pages, Row, Slider, Segmented, Update } from '../ui'
import { CurvePreview, HoverPreview, IndicatorPreview, LaunchPreview, ShowPreview, WindowAnimPreview } from '../previews'

// ---- Motion ----

export function MotionTab({ s, set, preview }: { s: DockSettings; set: Update; preview: () => void }) {
  return (
    <Pages id="motion">
      <Card icon="clock" tab="Hız" title="Hız" hint="Tüm dock animasyonlarının süresi ve hareketin karakteri">
        <Row icon="play" label="Hız"><Segmented<SpeedPreset> value={s.speed} onChange={(speed) => set({ speed })} options={[['fast', 'Hızlı'], ['medium', 'Orta'], ['slow', 'Yavaş'], ['custom', 'Özel']]} /></Row>
        {s.speed === 'custom' && <Row icon="clock" label="Süre"><Slider value={s.speedMs} min={100} max={1500} step={10} unit=" ms" onChange={(speedMs) => set({ speedMs })} /></Row>}
        <Row icon="motion" label="Hareket tipi" hint="Grafik: bir değerin zamanla nasıl değiştiği" />
        <Cards<AnimationCurve> size="s" value={s.animationCurve} onChange={(animationCurve) => set({ animationCurve })} options={[
          { id: 'spring', label: 'Yay', hint: 'Sıçramasız, canlı', preview: <CurvePreview curve="spring" /> },
          { id: 'bounce', label: 'Zıplayan yay', hint: 'Hedefi aşıp döner', preview: <CurvePreview curve="bounce" /> },
          { id: 'ease', label: 'Yumuşak', hint: 'Başı ve sonu yavaş', preview: <CurvePreview curve="ease" /> },
          { id: 'linear', label: 'Düz', hint: 'Sabit hızla', preview: <CurvePreview curve="linear" /> },
        ]} />
      </Card>
      <Card icon="cursor" tab="Simge efektleri" title="Fare üzerine gelince" hint="Fare simgelerin üstünden geçerken ne olsun">
        <Cards<HoverAnimation> value={s.hoverAnimation} onChange={(hoverAnimation) => set({ hoverAnimation })} options={[
          { id: 'zoom', label: 'Büyüme', hint: 'Simge büyür', preview: <HoverPreview kind="zoom" /> },
          { id: 'lift', label: 'Yükselme', hint: 'Simge raftan kalkar', preview: <HoverPreview kind="lift" /> },
          { id: 'wave', label: 'Dalga', hint: 'Büyür ve kalkar', preview: <HoverPreview kind="wave" /> },
        ]} />
      </Card>
      <Card icon="open" tab="Simge efektleri" title="Uygulama başlatma" hint="Bir programı başlatınca simgenin hareketi">
        <Cards<LaunchAnimation> size="s" value={s.launchAnimation} onChange={(launchAnimation) => set({ launchAnimation })} options={[
          { id: 'bounce', label: 'Sıçrama', hint: 'İki kez zıplar', preview: <LaunchPreview kind="bounce" /> },
          { id: 'hop', label: 'Atlama', hint: 'Tek zıplama', preview: <LaunchPreview kind="hop" /> },
          { id: 'pulse', label: 'Işık atımı', hint: 'Parlar ve büyür', preview: <LaunchPreview kind="pulse" /> },
          { id: 'none', label: 'Yok', preview: <LaunchPreview kind="none" /> },
        ]} />
        <div className="st-row-inline"><button className="st-btn" onClick={preview}><Icon name="play" size={14} />Üstteki canlı dock’ta dene</button></div>
      </Card>
      <Card icon="check" tab="Simge efektleri" title="Çalışan uygulama göstergesi" hint="Açık programın simgesinin altındaki işaret">
        <Cards<IndicatorStyle> size="s" value={s.indicatorStyle} onChange={(indicatorStyle) => set({ indicatorStyle })} options={[
          { id: 'dot', label: 'Nokta', preview: <IndicatorPreview kind="dot" /> },
          { id: 'bar', label: 'Çubuk', preview: <IndicatorPreview kind="bar" /> },
          { id: 'glow', label: 'Işıltı', preview: <IndicatorPreview kind="glow" /> },
          { id: 'ring', label: 'Halka', preview: <IndicatorPreview kind="ring" /> },
        ]} />
      </Card>
      <Card icon="dock" tab="Dock ve pencereler" title="Dock giriş ve çıkışı" hint="Otomatik gizleme açıkken dock’un ekrana gelişi">
        <Cards<ShowAnimation> size="s" value={s.showAnimation} onChange={(showAnimation) => set({ showAnimation })} options={[
          { id: 'slide', label: 'Kayma', preview: <ShowPreview kind="slide" /> },
          { id: 'fade', label: 'Solma', preview: <ShowPreview kind="fade" /> },
          { id: 'scale', label: 'Ölçek', preview: <ShowPreview kind="scale" /> },
        ]} />
      </Card>
      <Card icon="window" tab="Dock ve pencereler" title="Dock pencereleri" hint="Klasör, grup ve kontrol paneli penceresinin açılış ve kapanış efekti">
        <Cards<WindowAnimation> size="s" value={s.windowAnimation} onChange={(windowAnimation) => set({ windowAnimation })} options={[
          { id: 'genie', label: 'Cin', hint: 'Simgeden akarak açılır, geri çekilir', preview: <WindowAnimPreview kind="genie" /> },
          { id: 'scale', label: 'Büyüme', preview: <WindowAnimPreview kind="scale" /> },
          { id: 'fade', label: 'Solma', preview: <WindowAnimPreview kind="fade" /> },
          { id: 'slide', label: 'Kayma', preview: <WindowAnimPreview kind="slide" /> },
        ]} />
      </Card>
    </Pages>
  )
}
