// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Interface sounds, synthesised on the fly (no audio files to ship or license). Every window that wants sounds
// calls initSound() once; playSound() then follows the user's settings: master switch, volume, theme and groups.
import { SOUND_GROUP_OF, SoundEvent, SoundTheme, DockSettings } from '@/shared/types'
import { invoke } from '@/api'

import { t } from './i18n'
interface Voice {
  wave: OscillatorType
  /** Multiplies every frequency. */
  pitch: number
  /** Multiplies every duration. */
  len: number
  /** Loudness of the filtered-noise parts (swooshes, crumples). */
  air: number
  /** Adds a bell-like overtone to each tone. */
  bell: number
}

export const SOUND_THEMES: Record<SoundTheme, Voice & { label: string }> = {
  soft: { label: t('Yumuşak'), wave: 'sine', pitch: 1, len: 1, air: 1, bell: 0 },
  glass: { label: t('Cam'), wave: 'sine', pitch: 1.5, len: 1.4, air: 0.5, bell: 0.45 },
  wood: { label: t('Ahşap'), wave: 'triangle', pitch: 0.65, len: 0.55, air: 0.7, bell: 0 },
  retro: { label: t('Retro'), wave: 'square', pitch: 1.1, len: 0.7, air: 0.2, bell: 0 },
  bubble: { label: t('Baloncuk'), wave: 'sine', pitch: 1.25, len: 0.9, air: 0.4, bell: 0.15 },
}

let settings: DockSettings | null = null
let ctx: AudioContext | null = null
let started = false
const lastAt = new Map<SoundEvent, number>()

export function initSound() {
  if (started) return
  started = true
  invoke('settings:get').then((s) => (settings = s))
  window.api.on('settings:changed', (s) => (settings = s))
}

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface Tone { f: number; to?: number; dur: number; at?: number; vol?: number; wave?: OscillatorType }
interface Air { dur: number; from: number; to: number; at?: number; vol?: number; q?: number; type?: BiquadFilterType }

/** The recipes: each event is a few tones and/or filtered-noise sweeps. */
const RECIPES: Record<SoundEvent, { tones?: Tone[]; air?: Air[] }> = {
  hover: { tones: [{ f: 1500, dur: 0.025, vol: 0.12 }] },
  click: { tones: [{ f: 760, to: 520, dur: 0.06, vol: 0.5 }] },
  launch: { tones: [{ f: 420, to: 880, dur: 0.16, vol: 0.5 }, { f: 630, to: 1260, dur: 0.18, at: 0.07, vol: 0.35 }] },
  drop: { tones: [{ f: 340, to: 190, dur: 0.11, vol: 0.6 }], air: [{ dur: 0.05, from: 900, to: 400, vol: 0.25, type: 'lowpass' }] },
  remove: { air: [{ dur: 0.28, from: 3600, to: 700, vol: 0.5, q: 0.8, type: 'bandpass' }], tones: [{ f: 520, to: 160, dur: 0.18, vol: 0.2 }] },
  dockShow: { tones: [{ f: 520, to: 820, dur: 0.12, vol: 0.4 }] },
  dockHide: { tones: [{ f: 820, to: 520, dur: 0.12, vol: 0.4 }] },
  // the genie: a rising, then falling, air sweep with a low tone riding under it
  windowOpen: { air: [{ dur: 0.38, from: 300, to: 2800, vol: 0.55, q: 1.4, type: 'bandpass' }], tones: [{ f: 200, to: 720, dur: 0.32, vol: 0.22 }] },
  windowClose: { air: [{ dur: 0.3, from: 2600, to: 260, vol: 0.5, q: 1.4, type: 'bandpass' }], tones: [{ f: 640, to: 180, dur: 0.26, vol: 0.22 }] },
  menuOpen: { tones: [{ f: 880, dur: 0.05, vol: 0.35 }, { f: 1180, dur: 0.06, at: 0.04, vol: 0.3 }] },
  menuPick: { tones: [{ f: 980, to: 700, dur: 0.05, vol: 0.4 }] },
  trashDrop: { air: [{ dur: 0.1, from: 2000, to: 500, vol: 0.45, type: 'bandpass' }], tones: [{ f: 300, to: 150, dur: 0.12, vol: 0.5 }] },
  // crumpling paper: several quick noise bursts, then a soft chime
  trashEmpty: {
    air: [0, 0.07, 0.13, 0.22, 0.29, 0.38].map((at, i): Air => ({ dur: 0.07, from: 2600 + i * 300, to: 900, at, vol: 0.5 - i * 0.04, q: 0.6, type: 'highpass' })),
    tones: [{ f: 880, dur: 0.35, at: 0.44, vol: 0.3 }, { f: 1320, dur: 0.45, at: 0.5, vol: 0.2 }],
  },
  confirmOpen: { tones: [{ f: 520, dur: 0.09, vol: 0.4 }, { f: 780, dur: 0.12, at: 0.08, vol: 0.4 }] },
  accept: { tones: [{ f: 660, dur: 0.09, vol: 0.45 }, { f: 990, dur: 0.16, at: 0.08, vol: 0.45 }] },
  cancel: { tones: [{ f: 520, to: 360, dur: 0.12, vol: 0.4 }] },
  warn: { tones: [{ f: 440, dur: 0.12, vol: 0.45, wave: 'triangle' }, { f: 330, dur: 0.18, at: 0.12, vol: 0.45, wave: 'triangle' }] },
  error: { tones: [{ f: 200, dur: 0.1, vol: 0.5, wave: 'square' }, { f: 200, dur: 0.14, at: 0.14, vol: 0.5, wave: 'square' }] },
  toggle: { tones: [{ f: 1050, to: 1250, dur: 0.035, vol: 0.3 }] },
  notify: { tones: [{ f: 880, dur: 0.3, vol: 0.4 }, { f: 1320, dur: 0.4, at: 0.1, vol: 0.28 }] },
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function render(c: AudioContext, event: SoundEvent, voice: Voice, volume: number) {
  const out = c.createGain()
  out.gain.value = volume
  out.connect(c.destination)
  const now = c.currentTime + 0.005
  const recipe = RECIPES[event]
  for (const t of recipe.tones ?? []) {
    const dur = t.dur * voice.len
    const start = now + (t.at ?? 0) * voice.len
    const partials: [number, number][] = [[1, 1]]
    if (voice.bell > 0) partials.push([2.76, voice.bell], [5.4, voice.bell * 0.4])
    for (const [mul, level] of partials) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = mul === 1 ? (t.wave ?? voice.wave) : 'sine'
      osc.frequency.setValueAtTime(t.f * voice.pitch * mul, start)
      if (t.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, t.to * voice.pitch * mul), start + dur)
      const peak = (t.vol ?? 0.4) * level * (voice.wave === 'square' ? 0.45 : 1)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.012, dur / 3))
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(gain).connect(out)
      osc.start(start)
      osc.stop(start + dur + 0.03)
    }
  }
  for (const a of recipe.air ?? []) {
    const dur = a.dur * voice.len
    const start = now + (a.at ?? 0) * voice.len
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur + 0.05)
    const filter = c.createBiquadFilter()
    filter.type = a.type ?? 'bandpass'
    filter.Q.value = a.q ?? 1
    filter.frequency.setValueAtTime(a.from, start)
    filter.frequency.exponentialRampToValueAtTime(a.to, start + dur)
    const gain = c.createGain()
    const peak = (a.vol ?? 0.4) * voice.air
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + dur * 0.25)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(filter).connect(gain).connect(out)
    src.start(start)
    src.stop(start + dur + 0.05)
  }
}

/** Plays an event if sounds are on and its group is enabled. */
export function playSound(event: SoundEvent) {
  const s = settings
  if (!s || !s.soundEnabled || s.soundVolume <= 0) return
  if (!s.soundGroups.includes(SOUND_GROUP_OF[event])) return
  const nowMs = performance.now()
  if (nowMs - (lastAt.get(event) ?? -1000) < (event === 'hover' ? 70 : 35)) return
  lastAt.set(event, nowMs)
  const c = context()
  if (!c) return
  render(c, event, SOUND_THEMES[s.soundTheme] ?? SOUND_THEMES.soft, (s.soundVolume / 100) * 0.6)
}

/** Test button in the settings: plays with explicit settings so a change is heard whatever the switches say. */
export function previewSound(event: SoundEvent, theme: SoundTheme, volume: number) {
  const c = context()
  if (c) render(c, event, SOUND_THEMES[theme], (volume / 100) * 0.6)
}
