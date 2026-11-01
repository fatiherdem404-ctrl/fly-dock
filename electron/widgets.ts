// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Desktop widgets: each instance is its own small frameless window; data providers live here in main.
import { BrowserWindow, screen } from 'electron'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { getWidgets, setWidgets } from './store'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import { broadcast } from './ipc'
import { currentSnapshot } from './items'
import type { InvokeMap, WidgetInstance, WidgetType } from '../src/shared/types'
import { DEFAULT_WIDGET_OPTIONS, widgetWindowSize } from '../src/shared/widgets'

import { t } from '../src/i18n'
const windows = new Map<string, BrowserWindow>()

function createWindow(widget: WidgetInstance) {
  const size = widgetWindowSize(widget.type, widget.options)
  const win = new BrowserWindow({
    ...size,
    x: Math.round(widget.x) - OFFSCREEN,
    y: Math.round(widget.y),
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    // a note has to take the keyboard; every other widget never takes the focus
    focusable: widget.type === 'note',
    alwaysOnTop: false,
    webPreferences: baseWebPreferences(),
  })
  win.setMenuBarVisibility(false)
  loadRoute(win, `/widget/${widget.id}`)
  win.once('ready-to-show', () => win.showInactive())
  // Saved on release only: 'moved' fires once the drag ends on Windows.
  win.on('moved', () => {
    const [x, y] = win.getPosition()
    setWidgets(getWidgets().map((w) => (w.id === widget.id ? { ...w, x, y } : w)))
  })
  win.on('closed', () => windows.delete(widget.id))
  windows.set(widget.id, win)
}

export function initWidgets() {
  for (const widget of getWidgets()) createWindow(widget)
}

function publish(list: WidgetInstance[]): WidgetInstance[] {
  setWidgets(list)
  broadcast('widgets:changed', list)
  return list
}

export function addWidget(type: WidgetType): WidgetInstance[] {
  const area = screen.getPrimaryDisplay().workArea
  const existing = getWidgets()
  const widget: WidgetInstance = {
    id: crypto.randomUUID(),
    type,
    x: area.x + area.width - widgetWindowSize(type, DEFAULT_WIDGET_OPTIONS[type]).width - 24,
    y: area.y + 24 + existing.length * 28,
    options: { ...DEFAULT_WIDGET_OPTIONS[type] },
  }
  createWindow(widget)
  return publish([...existing, widget])
}

export function removeWidget(id: string): WidgetInstance[] {
  windows.get(id)?.destroy()
  windows.delete(id)
  return publish(getWidgets().filter((w) => w.id !== id))
}

export function updateWidget(id: string, options: WidgetInstance['options']): WidgetInstance[] {
  const next = getWidgets().map((w) => (w.id === id ? { ...w, options: { ...w.options, ...options } } : w))
  const changed = next.find((w) => w.id === id)
  const win = windows.get(id)
  // a new scale or view changes the window's size; it grows from its top-left corner
  if (changed && win && !win.isDestroyed()) {
    const size = widgetWindowSize(changed.type, changed.options)
    const [width, height] = win.getSize()
    if (width !== size.width || height !== size.height) win.setSize(size.width, size.height)
  }
  return publish(next)
}

export function moveWidget(id: string, x: number, y: number) {
  windows.get(id)?.setPosition(Math.round(x), Math.round(y))
  setWidgets(getWidgets().map((w) => (w.id === id ? { ...w, x, y } : w)))
}

export function disposeWidgets() {
  for (const win of windows.values()) win.destroy()
  windows.clear()
}

// ---- data providers ----

let lastCpu = os.cpus().map((c) => ({ ...c.times }))

export function systemStats(): InvokeMap['widgets:system']['result'] {
  const now = os.cpus().map((c) => ({ ...c.times }))
  let idle = 0
  let total = 0
  now.forEach((t, i) => {
    const prev = lastCpu[i]
    if (!prev) return
    const dIdle = t.idle - prev.idle
    const dTotal = (Object.keys(t) as (keyof typeof t)[]).reduce((sum, k) => sum + (t[k] - prev[k]), 0)
    idle += dIdle
    total += dTotal
  })
  lastCpu = now
  const cpu = total > 0 ? Math.round((1 - idle / total) * 100) : 0
  const ram = Math.round((1 - os.freemem() / os.totalmem()) * 100)
  let disk = 0
  const root = path.parse(process.env.SystemDrive ? `${process.env.SystemDrive}\\` : 'C:\\').root
  try {
    const s = fs.statfsSync(root)
    disk = Math.round((1 - s.bavail / s.blocks) * 100)
  } catch {
    /* disk stats unavailable */
  }
  return { cpu, ram, disk, diskLabel: root.replace('\\', '') }
}

let weatherCache: { city: string; at: number; value: InvokeMap['widgets:weather']['result'] } | null = null

/** Open-Meteo: free, no API key. City is geocoded first, then current conditions are fetched. */
export async function weatherFor(city: string): Promise<InvokeMap['widgets:weather']['result']> {
  if (weatherCache && weatherCache.city === city && Date.now() - weatherCache.at < 10 * 60_000) return weatherCache.value
  try {
    const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)).json() as any
    const place = geo?.results?.[0]
    if (!place) return { ok: false, message: 'city not found' }
    const wx = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m`)).json() as any
    const cur = wx?.current
    if (!cur) return { ok: false, message: 'no data' }
    const value = { ok: true as const, city: place.name as string, temp: Math.round(cur.temperature_2m), code: cur.weather_code as number, wind: Math.round(cur.wind_speed_10m) }
    weatherCache = { city, at: Date.now(), value }
    return value
  } catch {
    return weatherCache?.value ?? { ok: false, message: 'offline' }
  }
}

const PLAYERS: [RegExp, string][] = [
  [/spotify\.exe$/i, 'Spotify'],
  [/vlc\.exe$/i, 'VLC'],
  [/musicbee\.exe$/i, t('MusicBee')],
  [/wmplayer\.exe$/i, t('Windows Media Player')],
  [/foobar2000\.exe$/i, 'foobar2000'],
  [/aimp\.exe$/i, 'AIMP'],
]

/** Best-effort now-playing from player window titles (system media transport needs a WinRT projection we do not ship). */
export function nowPlaying(): InvokeMap['widgets:now-playing']['result'] {
  for (const w of currentSnapshot().windows) {
    for (const [pattern, app] of PLAYERS) {
      if (!pattern.test(w.exePath)) continue
      const title = w.title.replace(/ - VLC media player$/i, '').trim()
      if (!title || /^(spotify( free| premium)?|vlc media player)$/i.test(title)) return { app, title: '' }
      return { app, title }
    }
  }
  return null
}
