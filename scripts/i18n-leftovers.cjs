// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// After scripts/i18n-sweep.sh: lists words on the English pages that only occur in the Turkish source texts, which
// means a text that was never put through t().  node scripts/i18n-leftovers.cjs
const fs = require('fs')
const en = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'))
const words = (s) => s.toLowerCase().match(/[a-zçğıöşüâîû]{3,}/g) ?? []
const trWords = new Set(), enWords = new Set()
for (const [k, v] of Object.entries(en)) { words(k.split('||')[0]).forEach((w) => trWords.add(w)); words(v).forEach((w) => enWords.add(w)) }
const turkishOnly = new Set([...trWords].filter((w) => !enWords.has(w)))
const dir = (process.env.TEMP || '/tmp') + '/i18n-sweep'
const found = new Map()
for (const f of fs.readdirSync(dir).filter((n) => /^p\d+\.txt$/.test(n))) {
  for (const line of fs.readFileSync(dir + '/' + f, 'utf8').split('\n')) {
    for (const w of words(line)) if (turkishOnly.has(w)) found.set(w, (found.get(w) ?? new Set()).add(f))
  }
}
for (const [w, pages] of [...found].sort()) console.log(w.padEnd(20), [...pages].join(' '))
console.log(found.size, 'words')
