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

// a theme can carry its shelf; only known settings with the right kind of value are kept
const withDesk = (desk, extra = []) => writeZip([file('pack.json', { type: 'theme', id: 'shelf-theme', name: 'Shelf' }), file('theme.json', { vars: {}, desk }), ...extra])
installPack(withDesk({ deskStyle: 'wood', deskDepth: 26, deskOpacity: 0.9, shelfGrows: false, notAShelfKey: 'dropped' }))
const shelf = getTheme('shelf-theme').desk
assert.equal(shelf.deskStyle, 'wood')
assert.equal(shelf.deskDepth, 26)
assert.equal(shelf.shelfGrows, false)
assert.equal('notAShelfKey' in shelf, false, 'unknown keys never reach the settings')
assert.equal(listInstalled('theme').find((p) => p.id === 'shelf-theme').hasDesk, true)
assert.equal(listInstalled('theme').find((p) => p.id === 'test-theme').hasDesk, false)
throws(withDesk({ deskStyle: 'not-a-style' }), /unknown shelf style/)
throws(withDesk({ deskDepth: 'deep' }), /wrong kind/)
throws(withDesk({ deskDepth: 99999 }), /out of range/)
throws(withDesk({ deskColor: 'url(http://evil)' }), /colour/)
throws(withDesk({}, [file('desk-texture.png', 'MZ this is not a picture')]), /not a valid picture/)

// a theme can carry a live wallpaper or a picture / video file; anything else is refused
const withWall = (wallpaper, extra = []) => writeZip([file('pack.json', { type: 'theme', id: 'wall-theme', name: 'Wall' }), file('theme.json', { vars: {}, wallpaper }), ...extra])
installPack(withWall({ live: 'stars' }))
assert.equal(getTheme('wall-theme').wallpaper.live, 'stars')
assert.equal(listInstalled('theme').find((p) => p.id === 'wall-theme').hasWallpaper, true)
throws(withWall({ live: 'not-a-scene' }), /unknown live wallpaper/)
throws(withWall({}, [file('wallpaper.mp4', 'this is not a video at all')]), /not a valid picture or video/)
throws(withWall({}, [file('wallpaper.webm', 'nope')]), /not a valid picture or video/)
const fakeMp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])
installPack(withWall({}, [{ name: 'wallpaper.mp4', data: fakeMp4 }]))
assert.ok(listInstalled('theme').find((p) => p.id === 'wall-theme').hasWallpaper, 'a theme with a video file counts as having a wallpaper')

console.log('packs: all checks passed')
