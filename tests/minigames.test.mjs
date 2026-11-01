// The panel games: the dartboard scores like a real one, Pong and bowling keep to their rules.
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
const { scoreAt, Dart } = await load('dart')
const { Pong } = await load('pong')
const { Bowling } = await load('bowling')

const R = 200
assert.deepEqual(scoreAt(0, 0, R).points, 50, 'the middle is the bull')
assert.equal(scoreAt(0, -R * 0.07, R).points, 25, 'the ring round it is 25')
assert.equal(scoreAt(0, -R * 0.8, R).points, 20, 'straight up in the big part is the 20')
assert.equal(scoreAt(0, -R * 0.6, R).points, 60, 'the treble ring counts three times')
assert.equal(scoreAt(0, -R * 0.97, R).points, 40, 'the double ring counts twice')
assert.equal(scoreAt(R * 0.8, 0, R).points, 6, 'the right side is the 6')
assert.equal(scoreAt(-R * 0.8, 0, R).points, 11, 'the left side is the 11')
assert.equal(scoreAt(0, R * 0.8, R).points, 3, 'straight down is the 3')
assert.equal(scoreAt(R * 1.2, 0, R).points, 0, 'off the board scores nothing')

const events = []
const env = { flash: (t) => events.push(['flash', t]), tone() {}, finish: (s) => events.push(['finish', s]), win: () => events.push(['win']) }

// darts: five rounds of three, then it is over and the score is handed in
const dart = new Dart(env)
dart.step(0.016, { x: 500, y: 400 }, false, 1200, 760, 700)
for (let i = 0; i < 15; i++) {
  dart.down(); dart.step(0.5, { x: 500, y: 400 }, true, 1200, 760, 700); dart.up()
  if (i % 3 === 2) for (let k = 0; k < 4; k++) dart.step(0.5, { x: 500, y: 400 }, false, 1200, 760, 700)
}
assert.ok(events.some((e) => e[0] === 'finish'), 'fifteen darts end the game')

// pong: a match ends when somebody reaches seven, and only a win is counted
const pong = new Pong(env)
pong.step(0.016, { x: 600, y: 300 }, false, 1200, 760, 700)
pong.down()
for (let i = 0; i < 60 * 240 && !events.some((e) => e[0] === 'win' || (e[0] === 'flash' && e[1] === 'KAYBETTİN')); i++) pong.step(1 / 60, { x: 600, y: 80 }, false, 1200, 760, 700)
assert.ok(events.some((e) => (e[0] === 'flash' && (e[1] === 'KAZANDIN!' || e[1] === 'KAYBETTİN'))), 'a pong match is decided')

// bowling: a straight, hard throw knocks something down and the frame moves on
const b = new Bowling(env)
b.step(0.016, null, false, 1200, 760, 700)
const area = b.area(1200, 760, 700)
const bx = area.x + area.w / 2, by = area.y + area.h - 56
b.down(bx, by)
b.move(bx, by + 190)
b.up()
let t = 0
for (; t < 60 * 20; t++) b.step(1 / 60, null, false, 1200, 760, 700)
assert.ok(b.hud().score > 0, 'a hard straight throw down the middle knocks pins down')
console.log('minigames: all checks passed')
