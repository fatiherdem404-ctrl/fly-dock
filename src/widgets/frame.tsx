// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { ReactNode, useEffect, useRef, useState } from 'react'
import type { WidgetType } from '@/shared/types'
import { widgetBase, widgetScale, widgetStyle, WidgetOptions } from '@/shared/widgets'
import ClockWidget from './ClockWidget'
import AnalogWidget from './AnalogWidget'
import CalendarWidget from './CalendarWidget'
import WeatherWidget from './WeatherWidget'
import SystemWidget from './SystemWidget'
import MediaWidget from './MediaWidget'
import BatteryWidget from './BatteryWidget'
import NoteWidget from './NoteWidget'

export interface WidgetBodyProps {
  options: WidgetOptions
  /** Saves one option of the widget (a note's text, the calendar's view…); absent in previews. */
  onOption?: (key: string, value: string | number | boolean) => void
}

export function WidgetBody({ type, options, onOption }: WidgetBodyProps & { type: WidgetType }): ReactNode {
  switch (type) {
    case 'clock': return <ClockWidget options={options} />
    case 'analog': return <AnalogWidget options={options} />
    case 'calendar': return <CalendarWidget options={options} onOption={onOption} />
    case 'weather': return <WeatherWidget options={options} />
    case 'system': return <SystemWidget />
    case 'media': return <MediaWidget />
    case 'battery': return <BatteryWidget />
    case 'note': return <NoteWidget options={options} onOption={onOption} />
  }
}

/**
 * One widget as it appears on the desktop: a themed card (glass, solid, accent or no card at all) of a fixed design
 * size, scaled by the widget's own scale. The same component draws the real widget windows and every preview.
 */
export function WidgetFrame({ type, options, onOption, fixedScale }: WidgetBodyProps & { type: WidgetType; fixedScale?: number }) {
  const base = widgetBase(type, options)
  const k = fixedScale ?? widgetScale(options)
  return (
    <div className={`widget widget--${widgetStyle(options)} widget--${type}`} style={{ width: base.width * k, height: base.height * k }}>
      <div className="widget__inner" style={{ width: base.width, height: base.height, zoom: k }}>
        <WidgetBody type={type} options={options} onOption={onOption} />
      </div>
    </div>
  )
}

/** A widget shrunk to fit a card. It draws at its design size and is scaled down to the width it is given. */
export function WidgetPreview({ type, options }: { type: WidgetType; options: WidgetOptions }) {
  const box = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(200)
  const base = widgetBase(type, { ...options, scale: 1 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  const k = Math.min(1, (width - 24) / base.width, 200 / base.height)
  return (
    <span ref={box} className="wgt-stage">
      <span className="wgt-stage__inner" style={{ width: base.width * k, height: base.height * k }}>
        <WidgetFrame type={type} options={{ ...options, scale: 1 }} fixedScale={k} />
      </span>
    </span>
  )
}
