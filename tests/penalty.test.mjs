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
// the far-hoop basketball: the pull sets power and (through its direction) the height of the arc
await build({ entryPoints: ['src/toys/shot.ts'], bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'shot.mjs'), logLevel: 'silent' })
const shot = await import(pathToFileURL(join(dir, 'shot.mjs')).href)
const flat = shot.launchShot({ x: -150, y: 20 })
const steep = shot.launchShot({ x: -40, y: 150 })
assert.ok(flat.vx > 0 && flat.vy < 0, 'pulling back and down sends the ball forward and up')
assert.ok(steep.height > flat.height, 'a steeper pull is a higher arc')
assert.ok(shot.launchShot({ x: 1, y: 1 }).power === 0, 'a tiny pull is no shot')
const lob = shot.launchShot({ x: -100, y: 140 })
const dots = shot.shotPath(300, 560, lob.vx, lob.vy, 2000, 600, 24)
assert.ok(dots.length > 3 && dots.every(([, y]) => y < 600), 'the dotted line stops at the floor')
const spot = shot.pickSpot(1200, 'right')
assert.ok(spot > 100 && spot < 800, 'the waiting spot is on the far side from a right-hand hoop')
console.log('penalty: all checks passed')
