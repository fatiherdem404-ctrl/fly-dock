// Pong: a full-screen match against the computer is decided.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'mini-test-'))
const load = async (name) => {
  const out = join(dir, name + '.mjs')
  await build({ entryPoints: [`src/toys/${name}.ts`], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent' })
  return import(pathToFileURL(out).href)
}
const { Pong } = await load('pong')

const events = []
const env = { flash: (t) => events.push(['flash', t]), tone() {}, finish: (s) => events.push(['finish', s]), win: () => events.push(['win']) }

// pong: a match ends when somebody reaches seven, and only a win is counted
const pong = new Pong(env)
pong.step(0.016, { x: 600, y: 300 }, false, 1200, 760, 700)
pong.down()
for (let i = 0; i < 60 * 240 && !events.some((e) => e[0] === 'win' || (e[0] === 'flash' && e[1] === 'KAYBETTİN')); i++) pong.step(1 / 60, { x: 600, y: 80 }, false, 1200, 760, 700)
assert.ok(events.some((e) => (e[0] === 'flash' && (e[1] === 'KAZANDIN!' || e[1] === 'KAYBETTİN'))), 'a pong match is decided')

console.log('minigames: all checks passed')
