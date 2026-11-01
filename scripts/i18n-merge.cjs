// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Builds src/i18n/en.json from numbered work files (scripts/i18n/en-NNN.txt, lines "index|english", "=" keeps the Turkish text)
// against a key snapshot:  node scripts/i18n-merge.cjs <snapshot.json>
const fs = require('fs')
const keys = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const out = fs.existsSync('src/i18n/en.json') ? JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8')) : {}
let added = 0
for (const f of process.argv[3] ? [process.argv[3]] : fs.readdirSync('scripts/i18n').filter((n) => /^en-\d+\.txt$/.test(n)).sort()) {
  for (const line of fs.readFileSync('scripts/i18n/' + f, 'utf8').split('\n')) {
    const i = line.indexOf('|')
    if (i < 1) continue
    const idx = Number(line.slice(0, i))
    const key = keys[idx]
    if (key === undefined) { console.warn('no key for', idx); continue }
    const val = line.slice(i + 1).replace(/\n/g, '\n')
    out[key] = val === '=' ? key : val
    added++
  }
}
fs.writeFileSync('src/i18n/en.json', JSON.stringify(out, null, 1) + '\n')
console.log('entries', Object.keys(out).length, 'lines', added)
