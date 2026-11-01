// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Two languages: the source texts are Turkish and double as the keys, English comes from ./en. A text with no entry
// stays as written, so a missing translation shows Turkish instead of an empty label.
// The language is fixed for the life of a process (changing it restarts the app), so t() can be used in module-level
// constants too. Renderers learn it from the preload script, the main process from electron/lang.ts.
import en from './en.json'

export type Lang = 'tr' | 'en'
export type LangSetting = 'auto' | Lang

/** 'auto' follows the language of Windows: Turkish for Turkish systems, English for everything else. */
export function resolveLang(pref: string | undefined, system: string | undefined): Lang {
  if (pref === 'tr' || pref === 'en') return pref
  return (system ?? '').toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

let current: Lang = (() => {
  const injected = (globalThis as { api?: { lang?: string } }).api?.lang
  if (injected === 'tr' || injected === 'en') return injected
  return resolveLang('auto', Intl.DateTimeFormat().resolvedOptions().locale)
})()

// the page language drives CSS text-transform (Turkish dotted İ) and spell checking
const mark = () => { const doc = (globalThis as { document?: { documentElement: { lang: string } } }).document; if (doc) doc.documentElement.lang = current }
mark()

export function setLang(lang: Lang) { current = lang; mark() }
export function getLang(): Lang { return current }
/** The locale for dates, numbers and sorting. */
export function locale(): string { return current === 'tr' ? 'tr-TR' : 'en-US' }

export function t(text: string, vars?: Record<string, string | number>): string {
  // "Kapat||güç": the part after || only tells two meanings of the same Turkish word apart; it is never shown
  let out = current === 'en' ? (en as Record<string, string>)[text] ?? text.split('||')[0] : text.split('||')[0]
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
  return out
}
