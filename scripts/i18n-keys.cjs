// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Lists every text passed to t() / tl(), and (with --check) fails when one has no English entry or an entry is unused.
//   node scripts/i18n-keys.cjs [--check] [--missing] [--json out.json]
const fs = require('fs'), path = require('path'), ts = require('typescript')
const keys = new Map()
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['scenes', 'libs', 'i18n'].includes(e.name)) walk(p) } else if (/\.(ts|tsx)$/.test(e.name) && !/generated|\.d\.ts$/.test(e.name)) scan(p) } }
function scan(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tl') && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0])))
      keys.set(n.arguments[0].text, [...(keys.get(n.arguments[0].text) ?? []), path.basename(file)])
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
for (const d of ['src', 'electron']) walk(d)
const have = new Set(Object.keys(JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'))))
const missing = [...keys.keys()].filter((k) => !have.has(k))
const unused = [...have].filter((k) => !keys.has(k))
const argv = process.argv.slice(2)
if (argv.includes('--json')) fs.writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(argv.includes('--missing') ? missing : [...keys.keys()], null, 0))
console.log(`texts: ${keys.size}  translated: ${keys.size - missing.length}  missing: ${missing.length}  unused entries: ${unused.length}`)
if (argv.includes('--check') && missing.length) { missing.slice(0, 30).forEach((k) => console.log('  missing:', k)); process.exit(1) }
