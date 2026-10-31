// What the desktop widgets are: their types, looks and sizes. Shared by the main process (which sizes the windows)
// and the pages (which draw the widgets and their previews), so both always agree.
import type { WidgetInstance, WidgetType } from './types'

export const WIDGET_TYPES: WidgetType[] = ['clock', 'analog', 'calendar', 'weather', 'system', 'media', 'battery', 'note']

/** How a widget is painted. All of them use the active theme's colours. */
export type WidgetStyle = 'glass' | 'solid' | 'accent' | 'minimal'
export const WIDGET_STYLES: WidgetStyle[] = ['glass', 'solid', 'accent', 'minimal']

export type WidgetOptions = WidgetInstance['options']

export const DEFAULT_WIDGET_OPTIONS: Record<WidgetType, WidgetOptions> = {
  clock: { seconds: false, hour12: false, date: true, style: 'glass', scale: 1 },
  analog: { seconds: true, numbers: 'quarters', smooth: true, style: 'glass', scale: 1 },
  calendar: { view: 'month', weekNumbers: false, style: 'glass', scale: 1 },
  weather: { city: 'Istanbul', style: 'glass', scale: 1 },
  system: { style: 'glass', scale: 1 },
  media: { style: 'glass', scale: 1 },
  battery: { style: 'glass', scale: 1 },
  note: { text: '', style: 'glass', scale: 1 },
}

/** The widget's size at 100% (without the margin that holds its shadow). */
export function widgetBase(type: WidgetType, options: WidgetOptions = {}): { width: number; height: number } {
  switch (type) {
    case 'clock': return { width: 264, height: options.date === false ? 96 : 128 }
    case 'analog': return { width: 200, height: 200 }
    case 'calendar': return options.view === 'day' ? { width: 176, height: 176 } : { width: 284, height: options.weekNumbers ? 316 : 308 }
    case 'weather': return { width: 264, height: 132 }
    case 'system': return { width: 264, height: 132 }
    case 'media': return { width: 296, height: 132 }
    case 'battery': return { width: 200, height: 132 }
    case 'note': return { width: 236, height: 220 }
  }
}

export const widgetScale = (options: WidgetOptions): number => {
  const s = Number(options.scale ?? 1)
  return Number.isFinite(s) ? Math.min(Math.max(s, 0.6), 2) : 1
}

export const widgetStyle = (options: WidgetOptions): WidgetStyle => {
  const s = options.style
  return WIDGET_STYLES.includes(s as WidgetStyle) ? (s as WidgetStyle) : 'glass'
}

/** The window around a widget: its size times the scale, plus room all around for the shadow. */
export const WIDGET_MARGIN = 6
export function widgetWindowSize(type: WidgetType, options: WidgetOptions): { width: number; height: number } {
  const base = widgetBase(type, options)
  const k = widgetScale(options)
  return { width: Math.round(base.width * k) + WIDGET_MARGIN * 2, height: Math.round(base.height * k) + WIDGET_MARGIN * 2 }
}
