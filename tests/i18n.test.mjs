// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Languages: every text passed to t() has an English entry, no entry is empty or unused, and an English text keeps the
// same {placeholders} as the Turkish one it translates.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'))
const check = spawnSync(process.execPath, ['scripts/i18n-keys.cjs', '--check'], { encoding: 'utf8' })
assert.equal(check.status, 0, 'texts without an English entry:\n' + check.stdout)
assert.match(check.stdout, /unused entries: 0/, 'en.json has entries nothing uses:\n' + check.stdout)

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
for (const [tr, text] of Object.entries(en)) {
  assert.ok(text.trim().length > 0, `empty English text for "${tr}"`)
  assert.equal(holes(text), holes(tr), `placeholders differ: "${tr}" -> "${text}"`)
}

// the language helpers
const { build } = await import('esbuild')
const out = (await build({ entryPoints: ['src/i18n/index.ts'], bundle: true, format: 'esm', write: false, loader: { '.json': 'json' }, platform: 'node' })).outputFiles[0].text
const mod = await import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'))
assert.equal(mod.resolveLang('auto', 'tr-TR'), 'tr')
assert.equal(mod.resolveLang('auto', 'en-US'), 'en')
assert.equal(mod.resolveLang('auto', 'de-DE'), 'en')
assert.equal(mod.resolveLang('tr', 'en-US'), 'tr')
assert.equal(mod.resolveLang('en', 'tr-TR'), 'en')
mod.setLang('en')
assert.equal(mod.t('Ayarlar'), 'Settings')
assert.equal(mod.t('Kapat||güç'), 'Shut down')
assert.equal(mod.t('{n} simge eşleşti.', { n: 3 }), '3 icons matched.')
assert.equal(mod.t('bu metin sözlükte yok'), 'bu metin sözlükte yok')
mod.setLang('tr')
assert.equal(mod.t('Kapat||güç'), 'Kapat')
assert.equal(mod.t('{n} simge eşleşti.', { n: 3 }), '3 simge eşleşti.')
console.log('i18n tests passed')
