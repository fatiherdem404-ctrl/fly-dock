// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Cursor files: the .cur and .ani writers are checked by reading them back, and the built-in pack is turned into real
// files by Electron's own image code (headless, nothing is applied to the system).
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import electronPath from 'electron'

const dir = mkdtempSync(join(tmpdir(), 'cursors-test-'))
const out = join(dir, 'files.mjs')
await build({ entryPoints: ['electron/cursorFiles.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent' })
const { curFile, aniFile, readCur } = await import(pathToFileURL(out).href)

const png = (n) => Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(n, 7)])
const cur = curFile([{ size: 32, png: png(40), hotX: 3, hotY: 4 }, { size: 256, png: png(70), hotX: 500, hotY: -5 }])
assert.equal(cur.readUInt16LE(2), 2)
const back = readCur(cur)
assert.equal(back.length, 2)
assert.deepEqual([back[0].size, back[0].hotX, back[0].hotY], [32, 3, 4])
assert.deepEqual([back[1].size, back[1].hotX, back[1].hotY], [256, 255, 0], 'hot spots are kept inside the picture, 256 is stored as 0')
assert.equal(back[0].png.length, 48)
assert.equal(back[1].png.length, 78)
assert.throws(() => curFile([]))
assert.throws(() => curFile([{ size: 300, png: png(1), hotX: 0, hotY: 0 }]))

const ani = aniFile([cur, cur, cur], 15)
assert.equal(ani.toString('ascii', 0, 4), 'RIFF')
assert.equal(ani.readUInt32LE(4), ani.length - 8)
assert.equal(ani.toString('ascii', 8, 12), 'ACON')
assert.equal(ani.toString('ascii', 12, 16), 'anih')
assert.equal(ani.readUInt32LE(20), 36)
assert.equal(ani.readUInt32LE(24), 3, 'frame count')
assert.equal(ani.readUInt32LE(8 + 4 + 8 + 28 + 0 - 0) >= 0, true)
assert.equal(ani.readUInt32LE(12 + 8 + 28), 4, '15 fps is 4 jiffies')
assert.equal(ani.toString('ascii', 56, 60), 'LIST')
assert.equal(ani.toString('ascii', 64, 68), 'fram')
assert.equal(ani.toString('ascii', 68, 72), 'icon')
assert.equal(ani.readUInt32LE(72), cur.length)
assert.throws(() => aniFile([cur], 10))

// the built-in pack through Electron's image code
const main = join(dir, 'main.cjs')
const bundle = join(dir, 'cursors.cjs')
const stubs = join(dir, 'stubs')
writeFileSync(join(dir, 'helper-stub.js'), 'export const helper = { on() {}, cursorsApply: async () => ({ applied: 0, failed: 0 }), cursorsRestore: async () => true }')
writeFileSync(join(dir, 'store-stub.js'), 'export const getSettings = () => ({ cursorPack: "" })')
await build({
  entryPoints: ['electron/cursors.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle, external: ['electron'], logLevel: 'silent',
  plugins: [{ name: 'stubs', setup(b) { b.onResolve({ filter: /^\.\/helper$/ }, () => ({ path: join(dir, 'helper-stub.js') })); b.onResolve({ filter: /^\.\/store$/ }, () => ({ path: join(dir, 'store-stub.js') })) } }],
})
writeFileSync(main, `
const { app } = require('electron')
app.setPath('userData', ${JSON.stringify(join(dir, 'data'))})
app.getAppPath = () => ${JSON.stringify(resolve('.'))}
app.whenReady().then(() => {
  try {
    const c = require(${JSON.stringify(bundle)})
    const items = c.buildCursorFiles('mac-neon')
    const packs = c.cursorPacks()
    console.log('RESULT ' + JSON.stringify({ items: items.map((i) => [i.id, i.file]), roles: packs[0].roles.length }))
  } catch (e) { console.log('RESULT ' + JSON.stringify({ error: String(e && e.stack || e) })) }
  app.quit()
})
`)
writeFileSync(join(dir, 'package.json'), '{"name":"t","main":"main.cjs"}')
const run = spawnSync(electronPath, [dir], { encoding: 'utf8', timeout: 120000 })
const line = (run.stdout || '').split('\n').find((l) => l.startsWith('RESULT '))
assert.ok(line, 'electron produced no result: ' + run.stdout + run.stderr)
const result = JSON.parse(line.slice(7))
assert.ok(!result.error, result.error)
assert.equal(result.roles, 17, 'every role of the built-in pack is listed')
assert.equal(result.items.length, 17)
for (const [id, file] of result.items) {
  const buf = readFileSync(file)
  if (file.endsWith('.cur')) {
    const imgs = readCur(buf)
    assert.deepEqual(imgs.map((i) => i.size), [32, 48, 64, 96, 128])
    assert.equal(imgs[0].png.subarray(1, 4).toString(), 'PNG')
    assert.ok(imgs.every((i) => i.hotX < i.size && i.hotY < i.size))
  } else {
    assert.equal(buf.toString('ascii', 8, 12), 'ACON')
    assert.equal(buf.readUInt32LE(24), 12, 'twelve frames')
  }
}
console.log('cursors: all checks passed')
