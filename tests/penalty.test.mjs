// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
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

// the shot is predicted to cross the goal line, and the curl bends it sideways
const W = 1200, floor = 700
for (const pitch of ['horizontal', 'vertical']) {
  const g = pen.geo(W, floor, pitch)
  const l = pen.launch(pitch === 'horizontal' ? { x: -170, y: 0 } : { x: 0, y: 170 })
  const straight = pen.predict(g, g.spot.x, g.spot.y, l.vx, l.vy, 0)
  const curled = pen.predict(g, g.spot.x, g.spot.y, l.vx, l.vy, 1)
  assert.ok(straight && Math.abs(straight.lat - g.center) < 5, pitch + ': a straight shot down the middle crosses the line in the middle')
  assert.ok(curled && Math.abs(curled.lat - straight.lat) > 15, pitch + ': the curl bends the flight')
}

// every shot gets decided exactly once, on both pitches
for (const pitch of ['horizontal', 'vertical']) {
  for (let n = 0; n < 10; n++) {
    const g = pen.geo(W, floor, pitch)
    const p = pen.makePen()
    const bl = ball.makeBall(g.spot.x, g.spot.y, 28)
    const events = []
    const ev = { goal: () => events.push('goal'), save: () => events.push('save'), miss: () => events.push('miss'), conceded() {}, blocked() {} }
    const wide = (n - 5) * 14
    const pull = pitch === 'horizontal' ? pen.launch({ x: -(120 + n * 9), y: wide }) : pen.launch({ x: wide, y: 120 + n * 9 })
    pen.shoot(p, bl, W, floor, pitch, pull.vx, pull.vy)
    for (let i = 0; i < 60 * 12 && p.phase !== 'ready'; i++) pen.step(p, bl, 1 / 60, W, floor, pitch, ev, { x: 300, y: 300 }, false)
    assert.equal(p.phase, 'ready', pitch + ' shot ' + n + ' comes to an end')
    assert.equal(events.length, 1, pitch + ' shot ' + n + ' is decided exactly once (' + events + ')')
  }
}

// the keeper's return shot is decided too
{
  const g = pen.geo(W, floor, 'horizontal')
  const p = pen.makePen()
  const bl = ball.makeBall(g.spot.x, g.spot.y, 28)
  const events = []
  const ev = { goal() {}, save() {}, miss() {}, conceded: () => events.push('conceded'), blocked: () => events.push('blocked') }
  pen.keeperShot(p, W, floor, 'horizontal')
  for (let i = 0; i < 60 * 10 && p.phase !== 'ready'; i++) pen.step(p, bl, 1 / 60, W, floor, 'horizontal', ev, { x: 100, y: g.center }, false)
  assert.equal(p.phase, 'ready', 'the return shot ends')
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
