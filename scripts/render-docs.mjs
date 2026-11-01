// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Renders README.md, README.tr.md and .github/FUNDING.yml from docs/templates/*.tpl + src/config/brand.config.json.
// `--check` only compares and exits 1 when a generated file is out of date.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const brand = JSON.parse(readFileSync('src/config/brand.config.json', 'utf-8'))
const outputs = [
  ['docs/templates/README.md.tpl', 'README.md'],
  ['docs/templates/README.tr.md.tpl', 'README.tr.md'],
  ['docs/templates/FUNDING.yml.tpl', '.github/FUNDING.yml'],
]

const lookup = (path) => path.split('.').reduce((v, k) => v?.[k], brand)
function render(template) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const value = lookup(key)
    if (value === undefined) throw new Error(`brand.config.json has no "${key}"`)
    return String(value)
  })
}

const check = process.argv.includes('--check')
let stale = 0
for (const [tpl, out] of outputs) {
  const text = render(readFileSync(tpl, 'utf-8'))
  const current = existsSync(out) ? readFileSync(out, 'utf-8') : null
  if (current === text) continue
  if (check) { console.error(`${out} is out of date — run npm run brand:render`); stale++ }
  else { writeFileSync(out, text); console.log(`wrote ${out}`) }
}
if (stale) process.exit(1)
