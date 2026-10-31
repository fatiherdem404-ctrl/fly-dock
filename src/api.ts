import { useEffect, useState } from 'react'
import type { EventChannel, EventMap, InvokeChannel, InvokeMap, ThemeDef } from '@/shared/types'

export function invoke<C extends InvokeChannel>(channel: C, ...args: InvokeMap[C]['args']): Promise<InvokeMap[C]['result']> {
  return window.api.invoke(channel, ...args)
}

export function useEvent<C extends EventChannel>(channel: C, cb: (payload: EventMap[C]) => void) {
  useEffect(() => window.api.on(channel, cb))
}

/** Loads a value once and keeps it fresh whenever the given event fires. */
export function useRemote<C extends InvokeChannel, E extends EventChannel>(
  channel: C,
  args: InvokeMap[C]['args'],
  event?: E,
  fromEvent?: (payload: EventMap[E]) => InvokeMap[C]['result'],
) {
  const [value, setValue] = useState<InvokeMap[C]['result'] | undefined>(undefined)
  const key = JSON.stringify(args)
  useEffect(() => {
    let live = true
    invoke(channel, ...args).then((v) => live && setValue(v))
    const off = event
      ? window.api.on(event, (payload) => {
          if (fromEvent) setValue(fromEvent(payload))
          else invoke(channel, ...args).then((v) => live && setValue(v))
        })
      : undefined
    return () => {
      live = false
      off?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, key, event])
  return [value, setValue] as const
}

const VAR_NAMES: Record<keyof ThemeDef['vars'], string> = {
  surface: '--surface',
  surfaceBorder: '--surface-border',
  surfaceBlur: '--surface-blur',
  radius: '--radius',
  shadow: '--shadow',
  indicator: '--indicator',
  tooltipBg: '--tooltip-bg',
  tooltipText: '--tooltip-text',
  accent: '--accent',
  panelBg: '--panel-bg',
  panelText: '--panel-text',
  panelMuted: '--panel-muted',
  fontFamily: '--font',
}

/** The theme's variables as an inline style, to paint one preview with a theme without applying it. */
export function themeStyle(vars: ThemeDef['vars']): React.CSSProperties {
  const out: Record<string, string> = {}
  for (const [key, cssName] of Object.entries(VAR_NAMES)) {
    const value = vars[key as keyof ThemeDef['vars']]
    out[cssName] = typeof value === 'number' ? `${value}px` : value
  }
  return out as React.CSSProperties
}

export function applyTheme(theme: ThemeDef | null) {
  if (!theme) return
  const root = document.documentElement.style
  for (const [key, cssName] of Object.entries(VAR_NAMES)) {
    const value = theme.vars[key as keyof ThemeDef['vars']]
    root.setProperty(cssName, typeof value === 'number' ? `${value}px` : value)
  }
}

/** Keeps the document styled with the theme chosen in settings, live. */
export function useActiveTheme(themeId: string | undefined) {
  const [tick, setTick] = useState(0)
  useEvent('themes:changed', () => setTick((t) => t + 1))
  useEffect(() => {
    if (!themeId) return
    invoke('themes:get', themeId).then((t) => (t ? applyTheme(t) : invoke('themes:get', 'glass-dark').then(applyTheme)))
  }, [themeId, tick])
}
