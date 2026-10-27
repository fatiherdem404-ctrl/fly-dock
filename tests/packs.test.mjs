// Validates the pack importer against hostile and valid archives. Run with `npm test`.
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'packs-test-'))
const stub = join(dir, 'electron-stub.js')
writeFileSync(stub, `export const app = { getPath: () => ${JSON.stringify(dir)} }; export const dialog = {}`)

async function bundle(entry, name, alias) {
  const outfile = join(dir, name)
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, alias, logLevel: 'silent' })
  return import(pathToFileURL(outfile).href)
}

const { validatePackArchive, installPack, getTheme, listInstalled, packIconFor } = await bundle('electron/packs.ts', 'packs.mjs', { electron: stub })
const { writeZip } = await bundle('electron/zip.ts', 'zip.mjs', {})

const file = (name, text) => ({ name, data: Buffer.from(typeof text === 'string' ? text : JSON.stringify(text)) })
const theme = (vars = {}, manifest = {}) =>
  writeZip([file('pack.json', { type: 'theme', id: 'test-theme', name: 'Test', ...manifest }), file('theme.json', { vars })])
const throws = (buf, pattern) => assert.throws(() => validatePackArchive(buf), pattern)

// a valid theme installs and reads back
installPack(theme({ accent: '#ff0000', radius: 12 }))
assert.equal(getTheme('test-theme').vars.accent, '#ff0000')
assert.equal(listInstalled('theme').length, 1)

// a valid icon pack resolves icons by program name
installPack(
  writeZip([
    file('pack.json', { type: 'icons', id: 'test-icons', name: 'Icons' }),
    file('icons.json', { map: { chrome: 'icons/chrome.png' } }),
    file('icons/chrome.png', 'png-bytes'),
  ]),
)
const app = (p) => ({ id: 'x', type: 'app', targetPath: p })
assert.match(packIconFor('test-icons', app(String.raw`C:\Apps\Chrome.exe`), false), /chrome\.png$/)
assert.equal(packIconFor('test-icons', app(String.raw`C:\Apps\other.exe`), false), null)

// hostile input is rejected
throws(theme({ accent: 'url(http://evil)' }), /unsafe/)
throws(theme({ shadow: 'red; } body { display:none' }), /unsafe/)
throws(theme({ radius: 9000 }), /number/)
throws(theme({}, { id: '../escape' }), /id/)
throws(writeZip([file('pack.json', { type: 'theme', id: 'aa', name: 'x' }), file('../evil.json', '{}')]), /not allowed/)
throws(writeZip([file('pack.json', { type: 'theme', id: 'aa', name: 'x' }), file('theme.json', { vars: {} }), file('run.exe', 'MZ')]), /not allowed/)
throws(writeZip([file('pack.json', { type: 'icons', id: 'aa', name: 'x' }), file('icons.json', { map: { a: 'missing.png' } })]), /not in the pack/)
throws(Buffer.from('not a zip at all, definitely'), /not a zip/)

console.log('packs: all checks passed')
