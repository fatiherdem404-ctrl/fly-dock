// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// One-off codemod that wraps the texts found by i18n-extract.cjs in t(...) and adds the import. Prints what it skipped.
process.argv.push('--write')
const fs = require('fs')
const path = require('path')
const { edits } = require('./i18n-extract.cjs')

const SKIP_FILES = /CalendarWidget|ClockWidget|PowerView/
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
const report = { skipped: [], shadow: [], done: 0, files: 0 }

for (const [file, list] of edits) {
  if (SKIP_FILES.test(file)) { report.skipped.push(`${file}: file skipped (manual)`); continue }
  let src = fs.readFileSync(file, 'utf8')
  if (/\bimport\b[^;\n]*\bt\b[^;\n]*from\s+['"][^'"]*i18n/.test(src)) continue
  // a local called t would shadow the import
  if (/(\(|,|\s)t(\)|,|\s*=>|\s*:)|\b(const|let|var)\s+t\b|\(\s*t\s*\)/.test(src.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''"))) { report.shadow.push(file); continue }
  const kept = []
  const sorted = [...list].sort((a, b) => a.start - b.start)
  for (const e of sorted) {
    if (e.kind === 'jsx' && /&\w+;/.test(e.orig)) { report.skipped.push(`${file}: entity in "${e.text}"`); continue }
    kept.push(e)
  }
  // drop an outer edit that contains another one (a template with a text inside); those are done by hand
  const final = kept.filter((e) => !(e.kind === 'tpl' && kept.some((o) => o !== e && o.start >= e.start && o.end <= e.end)))
  for (const e of kept) if (!final.includes(e)) report.skipped.push(`${file}: nested template "${e.text}"`)
  for (const e of [...final].sort((a, b) => b.start - a.start)) {
    let rep
    if (e.kind === 'str') rep = e.inJsxAttr ? `{t(${q(e.text)})}` : `t(${q(e.text)})`
    else if (e.kind === 'jsx') rep = `{t(${q(e.text)})}`
    else rep = `t(${q(e.text)}, { ${e.names.map((n, i) => (n === e.exprs[i] ? n : `${n}: ${e.exprs[i]}`)).join(', ')} })`
    src = src.slice(0, e.start) + rep + src.slice(e.end)
    report.done++
  }
  // import after the last top-level import
  const rel = path.relative(path.dirname(file), 'src/i18n').replace(/\\/g, '/')
  const spec = rel.startsWith('.') ? rel : './' + rel
  const imports = [...src.matchAll(/^import[^;]*?from\s+['"][^'"]+['"]\s*;?[ \t]*$/gm)]
  const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0
  const line = `\nimport { t } from '${spec}'`
  src = at ? src.slice(0, at) + line + src.slice(at) : `import { t } from '${spec}'\n` + src
  fs.writeFileSync(file, src)
  report.files++
}
console.log(JSON.stringify({ done: report.done, files: report.files, shadow: report.shadow, skipped: report.skipped.length }))
fs.writeFileSync(process.env.TEMP + '/i18n-skipped.txt', report.skipped.join('\n'))
