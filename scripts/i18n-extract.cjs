// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Finds the user-facing Turkish texts in the source (JSX text, labelled attributes, object fields, plain sentences) and
// either lists them (default), or with --write wraps them in t(...). Used once to move the app onto src/i18n; kept so
// new texts can be checked:  node scripts/i18n-extract.cjs [--write] [--json out.json]
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOTS = ['src', 'electron']
const SKIP_DIR = new Set(['scenes', 'libs', 'i18n', 'assets'])
const SKIP_FILE = /generated|\.d\.ts$|sceneTemplates|elevated|\.test\.|shared[\\/]types/
const TR = /[çğıöşüÇĞİÖŞÜ]/
// attribute / property names that carry text for people
const TEXT_KEYS = new Set(['label', 'title', 'hint', 'tab', 'placeholder', 'text', 'desc', 'description', 'sub', 'subtitle', 'blurb', 'message', 'confirmLabel', 'cancelLabel', 'tooltip', 'alt', 'aria-label', 'caption', 'name', 'unit', 'summary', 'note', 'empty', 'error', 'detail', 'heading', 'body', 'badge', 'tag', 'tagline', 'action', 'okLabel', 'buttonLabel', 'emptyText', 'off', 'on', 'short', 'long', 'tip'])
const COMMON = new Set(['Dock', 'Tweaks', 'Widget', 'Pong', 'OK', 'px', 'ms', 'x', 'Fly Dock'])

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, out) }
    else if (/\.(ts|tsx)$/.test(e.name) && !SKIP_FILE.test(e.name)) out.push(p)
  }
  return out
}

function propName(n) {
  if (ts.isIdentifier(n) || ts.isStringLiteral(n)) return n.text
  return null
}

/** Is this node a place where a string is read by people (not compared, not a type, not an id)? */
function context(node) {
  const p = node.parent
  if (!p) return null
  if (ts.isTaggedTemplateExpression(p)) return null
  if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isCaseClause(p) || ts.isEnumMember(p) || ts.isExternalModuleReference(p)) return null
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return null
  if (ts.isPropertyAssignment(p) && p.initializer === node) { const k = propName(p.name); return k && TEXT_KEYS.has(k) ? 'prop:' + k : 'prop?:' + k }
  if (ts.isJsxAttribute(p)) { const k = p.name.getText(); return TEXT_KEYS.has(k) ? 'attr:' + k : null }
  if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent)) { const k = p.parent.name.getText(); return TEXT_KEYS.has(k) ? 'attr:' + k : null }
  if (ts.isJsxExpression(p)) return 'jsx-expr'
  if (ts.isArrayLiteralExpression(p)) return 'array'
  if (ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || ts.isParenthesizedExpression(p)) return 'expr'
  if (ts.isCallExpression(p)) {
    const callee = p.expression.getText()
    if (/^(invoke|on|emit|handle|send|useRemote|useEvent|console\.\w+|require|fetch|Symbol|String|Number|window\.api\.\w+|ipcMain\.\w+|ipcRenderer\.\w+|webContents\.send|setSetting|Object\.\w+|JSON\.\w+|Icon|path\.\w+|fs\.\w+|new URL|querySelector\w*|getElementById|localStorage\.\w+|addEventListener|removeEventListener|createElement|setAttribute|getAttribute|includes|startsWith|endsWith|split|join|replace|test|match|indexOf)$/.test(callee)) return null
    if (/^(label|flash|askConfirm|dialog\.\w+|notify|toast|alert|setMessage|setNote|setError)$/.test(callee)) return 'call:' + callee
    return 'call?:' + callee
  }
  if (ts.isReturnStatement(p) || ts.isVariableDeclaration(p) || ts.isArrowFunction(p)) return 'value'
  return 'other'
}

function looksHuman(text, ctx) {
  const t = text.trim()
  if (/^prop\?:/.test(ctx || '')) return false
  if (/^call\?:/.test(ctx || '') && !/^call\?:(e|entry|add|game|folderPlace|special|act|dial|c\.fillText|shellPlace|panelGame)$/.test(ctx)) return false
  if (ctx === 'other' && !TR.test(t)) return false
  // markup, CSS and registry names that merely look like words
  if (/^(hud |wg-|st-|fill=|stroke=|\{weight\}|not (applied|reverted))/.test(t) || /^[A-Z][a-z]+([A-Z][A-Za-z]*)+$/.test(t) || /^(HKCU|HKLM)/.test(t)) return false
  if (ctx === 'array' && !TR.test(t) && !/\s/.test(t)) return false
  if (t.length < 2) return false
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]{2}/.test(t)) return false
  if (/^(https?:|\/|\.|#|[A-Za-z0-9_.-]+\.(png|svg|json|js|ts|css|exe|cur|ani|jpg|mp4|webm|ico))/.test(t)) return false
  if (/^[a-z][a-z0-9]*([-_:.][a-z0-9]+)+$/.test(t)) return false // kebab / ids
  if (/^[a-z]+[A-Z][A-Za-z]*$/.test(t)) return false // camelCase ids
  if (/^(rgba?|hsla?|linear-gradient|radial-gradient|translate|scale|M\d|calc|var\()/.test(t)) return false
  if (/^[a-z0-9]+$/.test(t) && !TR.test(t) && ctx !== 'attr:label' && !/^prop:/.test(ctx || '')) return false // lone lowercase words are ids
  if (COMMON.has(t)) return false
  if (TR.test(t)) return true
  if (/\s/.test(t) && /^[A-ZÇĞİÖŞÜa-z]/.test(t)) return true
  return /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(t) || /^(attr|prop|call):/.test(ctx || '')
}

const files = ROOTS.flatMap((r) => walk(r, []))
const found = []
const edits = new Map()

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const add = (node, text, kind, ctx) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
    found.push({ file, line, text, kind, ctx })
  }
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const ctx = context(node)
      if (ctx && looksHuman(node.text, ctx)) {
        add(node, node.text, 'str', ctx)
        edits.set(file, [...(edits.get(file) ?? []), { start: node.getStart(), end: node.getEnd(), kind: 'str', text: node.text, inJsxAttr: ts.isJsxAttribute(node.parent) }])
      }
    } else if (ts.isTemplateExpression(node)) {
      const ctx = context(node)
      const head = node.head.text + node.templateSpans.map((s) => s.literal.text).join(' ')
      if (ctx && looksHuman(head, ctx) && (TR.test(head) || /\s/.test(head))) {
        let i = 0
        const names = []
        const body = node.head.text + node.templateSpans.map((s) => {
          const e = s.expression
          let nm = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : 'v' + i
          if (names.includes(nm)) nm = nm + (i + 1)
          names.push(nm)
          i++
          return '{' + nm + '}' + s.literal.text
        }).join('')
        add(node, body, 'tpl', ctx)
        edits.set(file, [...(edits.get(file) ?? []), { start: node.getStart(), end: node.getEnd(), kind: 'tpl', text: body, names, exprs: node.templateSpans.map((s) => s.expression.getText()) }])
      }
    } else if (ts.isJsxText(node)) {
      const raw = node.text
      const t = raw.replace(/\s+/g, ' ').trim()
      if (t && /[A-Za-zÇĞİÖŞÜçğıöşü]{2}/.test(t) && !/^[{}()\[\]·|/–—:;,.!?+*=<>-]+$/.test(t)) {
        add(node, t, 'jsx', 'jsx-text')
        const lead = raw.match(/^\s*/)[0].length
        const trail = raw.match(/\s*$/)[0].length
        edits.set(file, [...(edits.get(file) ?? []), { start: node.getStart() + lead, end: node.getEnd() - trail, kind: 'jsx', text: t, orig: raw.slice(lead, raw.length - trail) }])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const argv = process.argv.slice(2)
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(found, null, 1))
if (!argv.includes('--write')) {
  const byCtx = {}
  for (const f of found) byCtx[f.ctx] = (byCtx[f.ctx] ?? 0) + 1
  console.log('texts:', found.length, 'unique:', new Set(found.map((f) => f.text)).size, 'files:', new Set(found.map((f) => f.file)).size)
  console.log(Object.entries(byCtx).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join('\n'))
  process.exit(0)
}
module.exports = { edits, found }
