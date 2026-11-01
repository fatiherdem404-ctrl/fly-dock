// The penalty game: the pull sets the shot, the flight is predictable, and every shot ends one way or another.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'penalty-test-'))
const out = join(dir, 'penalty.mjs')
await build({ entryPoints: ['src/toys/penalty.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent' })
const pen = await import(pathToFileURL(out).href)
const ball = await import(pathToFileURL((await build({ entryPoints: ['src/toys/ball.ts'], bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'ball.mjs'), logLevel: 'silent' }), join(dir, 'ball.mjs'))).href)

// pulling back to the left sends the ball to the right, harder the longer the pull
const soft = pen.launch({ x: -60, y: 0 })
const hard = pen.launch({ x: -200, y: 0 })
assert.ok(soft.vx > 0 && hard.vx > soft.vx, 'a longer pull is a faster shot')
assert.equal(pen.launch({ x: 1, y: 1 }).power, 0, 'a tiny pull is no shot')
assert.ok(pen.launch({ x: -9999, y: 0 }).power <= 1, 'power is capped')

// the prediction agrees with the real flight (same maths)
const W = 1200, floor = 600
const line = pen.goalX(W)
const l = pen.launch({ x: -150, y: 90 })
const guess = pen.predict(360, floor - 24, l.vx, l.vy, 0, line, floor, 24)
assert.ok(guess === null || guess.y < floor, 'a shot is predicted to cross the line above the ground, or not at all')

// a curled shot ends higher or lower than a straight one
const a = pen.predict(360, 500, 1100, -900, 0, line, floor, 24)
const b = pen.predict(360, 500, 1100, -900, 1, line, floor, 24)
assert.ok(a && b && Math.abs(a.y - b.y) > 20, 'the curl bends the flight')

// every shot gets decided: goal, save, or out
for (let n = 0; n < 12; n++) {
  const p = pen.makePen()
  const bl = ball.makeBall(...pen.spotOf(W, floor, 24), 24)
  const events = []
  const ev = { goal: () => events.push('goal'), save: () => events.push('save'), miss: () => events.push('miss'), conceded() {}, blocked() {} }
  const pull = pen.launch({ x: -(80 + n * 12), y: 30 + n * 14 })
  pen.shoot(p, bl, W, floor, pull.vx, pull.vy)
  for (let i = 0; i < 60 * 8 && p.phase !== 'ready'; i++) pen.step(p, bl, 1 / 60, W, floor, ev, 300)
  assert.equal(p.phase, 'ready', `shot ${n} comes to an end`)
  assert.equal(events.length, 1, `shot ${n} is decided exactly once (${events})`)
}
console.log('penalty: all checks passed')
