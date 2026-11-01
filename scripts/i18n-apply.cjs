// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Codemod that wraps the texts found by i18n-extract.cjs in t(...) and adds the import. Prints what it skipped.
//   node scripts/i18n-apply.cjs            (ONLY=settings/nav.ts limits it to one file)
process.argv.push('--write')
const fs = require('fs')
const path = require('path')
const { edits } = require('./i18n-extract.cjs')

const SKIP_FILES = /CalendarWidget|ClockWidget|PowerView/
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
const report = { skipped: [], done: 0, files: 0 }

for (const [file, list] of edits) {
  if (process.env.ONLY && !file.split(path.sep).join('/').endsWith(process.env.ONLY)) continue
  if (SKIP_FILES.test(file)) { report.skipped.push(`${file}: file skipped (manual)`); continue }
  let src = fs.readFileSync(file, 'utf8')
  const imp = src.match(/^import \{([^}]*)\} from '[^']*i18n'/m)
  // a local called t would shadow the import: those files get the same function under another name
  let fn = 't'
  if (imp) fn = /\bt as tl\b/.test(imp[1]) ? 'tl' : /\bt\b/.test(imp[1]) ? 't' : 't'
  else if (/(\(|,|\s)t(\)|,|\s*=>|\s*:)|\b(const|let|var)\s+t\b|\(\s*t\s*\)/.test(src.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''"))) fn = 'tl'
  const kept = []
  for (const e of [...list].sort((a, b) => a.start - b.start)) {
    if (e.kind === 'jsx' && /&\w+;/.test(e.orig)) { report.skipped.push(`${file}: entity in "${e.text}"`); continue }
    kept.push(e)
  }
  // drop an outer edit that contains another one (a template with a text inside); those are done by hand
  const final = kept.filter((e) => !(e.kind === 'tpl' && kept.some((o) => o !== e && o.start >= e.start && o.end <= e.end)))
  for (const e of kept) if (!final.includes(e)) report.skipped.push(`${file}: nested template "${e.text}"`)
  for (const e of [...final].sort((a, b) => b.start - a.start)) {
    let rep
    if (e.kind === 'str') rep = e.inJsxAttr ? `{${fn}(${q(e.text)})}` : `${fn}(${q(e.text)})`
    else if (e.kind === 'jsx') rep = `{${fn}(${q(e.text)})}`
    else rep = `${fn}(${q(e.text)}, { ${e.names.map((n, i) => (n === e.exprs[i] ? n : `${n}: ${e.exprs[i]}`)).join(', ')} })`
    src = src.slice(0, e.start) + rep + src.slice(e.end)
    report.done++
  }
  if (!imp && final.length) {
    // import after the last top-level import
    const rel = path.relative(path.dirname(file), 'src/i18n').split(path.sep).join('/')
    const spec = rel.startsWith('.') ? rel : './' + rel
    const spec2 = fn === 't' ? 't' : 't as tl'
    const imports = [...src.matchAll(/^import[^;]*?from\s+['"][^'"]+['"]\s*;?[ \t]*$/gm)]
    const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0
    const line = `\nimport { ${spec2} } from '${spec}'`
    src = at ? src.slice(0, at) + line + src.slice(at) : `import { ${spec2} } from '${spec}'\n` + src
  } else if (imp && !/\bt\b/.test(imp[1]) && final.length) {
    src = src.replace(imp[0], imp[0].replace(imp[1], ' t,' + imp[1]))
  }
  fs.writeFileSync(file, src)
  report.files++
}
console.log(JSON.stringify({ done: report.done, files: report.files, skipped: report.skipped.length }))
fs.writeFileSync(process.env.TEMP + '/i18n-skipped.txt', report.skipped.join('\n'))
