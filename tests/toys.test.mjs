// Checks the toy physics: balls bounce, rest and never tunnel; kicks, throws and solid movers; scoring.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'toys-test-'))
const load = async (entry, name) => {
  const outfile = join(dir, name)
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' })
  return import(pathToFileURL(outfile).href)
}
const ball = await load('src/toys/ball.ts', 'ball.mjs')

const world = { width: 1000, floor: 800, gravity: 1800, restitution: 0.7, rolling: 1.5 }

// a dropped ball never goes below the floor and ends at rest on it
{
  const b = ball.makeBall(500, 100, 20)
  for (let i = 0; i < 60 * 12; i++) {
    ball.stepBall(b, 1 / 60, world)
    assert.ok(b.y <= world.floor - b.r + 0.001, 'never below the floor')
  }
  assert.ok(Math.abs(b.y - (world.floor - b.r)) < 0.5, 'rests on the floor')
  assert.equal(b.vy, 0)
}

// walls keep the ball inside and a fast ball cannot tunnel through a thin wall segment
{
  const b = ball.makeBall(100, 700, 15)
  b.vx = 2800
  const wall = { ax: 500, ay: 400, bx: 500, by: 800, restitution: 0.5 }
  for (let i = 0; i < 120; i++) {
    ball.stepBall(b, 1 / 60, world, [wall])
    assert.ok(b.x >= b.r - 0.01 && b.x <= world.width - b.r + 0.01, 'inside the walls')
    assert.ok(b.x < 500, 'did not pass through the wall')
  }
}

// rolling friction slows a ball on the floor
{
  const b = ball.makeBall(100, world.floor - 20, 20)
  b.vx = 400
  for (let i = 0; i < 60 * 8; i++) ball.stepBall(b, 1 / 60, world)
  assert.ok(Math.abs(b.vx) < 5, 'rolls to a stop')
}

// kicks: a fast pointer pushes the ball away, a slow or resting one does nothing
{
  const b = ball.makeBall(200, 200, 20)
  assert.equal(ball.kickBall(b, 190, 200, 20, 0), false, 'slow pointer does not kick')
  assert.equal(b.vx, 0)
  assert.equal(ball.kickBall(b, 175, 200, 900, 0), true, 'fast pointer kicks')
  assert.ok(b.vx > 800, `ball flies away (${b.vx})`)
  const far = ball.makeBall(500, 500, 20)
  assert.equal(ball.kickBall(far, 100, 100, 2000, 0), false, 'misses when away')
}

// a moving solid (racket head, boot toe): a falling ball bounces off a resting one, a swung one sends it flying, a miss does nothing
{
  const b = ball.makeBall(300, 200, 15)
  b.vy = 600
  assert.equal(ball.bounceOffMover(b, 300, 232, 26, 0, 0, 0.9), true, 'a falling ball meets the racket head')
  assert.ok(b.vy < -400, `it bounces up (${b.vy})`)
  assert.ok(b.y <= 232 - 26 - 15 + 0.01, 'and is pushed out of the head')
  const hit = ball.makeBall(300, 200, 15)
  assert.equal(ball.bounceOffMover(hit, 270, 200, 26, 1500, 0, 0.8), true)
  assert.ok(hit.vx > 1500, `a swung head launches the ball (${hit.vx})`)
  const miss = ball.makeBall(600, 200, 15)
  assert.equal(ball.bounceOffMover(miss, 270, 200, 26, 1500, 0, 0.8), false)
  const away = ball.makeBall(300, 200, 15)
  away.vx = 900
  ball.bounceOffMover(away, 270, 200, 26, 0, 0, 0.8)
  assert.ok(away.vx >= 900, 'a ball already leaving is not pulled back')
}

// throws take the speed of the last moments
{
  const v = ball.throwVelocity([[0, 0, 0], [10, 0, 50], [60, -30, 100], [160, -90, 150]])
  assert.ok(v.vx > 1000 && v.vy < 0, `throw direction (${v.vx}, ${v.vy})`)
  assert.deepEqual(ball.throwVelocity([[0, 0, 0]]), { vx: 0, vy: 0 })
}

// scoring: through the rim from above counts, from below or beside does not
{
  const b = ball.makeBall(500, 301, 20)
  b.vy = 300
  assert.equal(ball.scoredThroughRim(299, b, 300, 450, 550), true)
  assert.equal(ball.scoredThroughRim(299, { ...b, x: 700 }, 300, 450, 550), false, 'outside the rim')
  assert.equal(ball.scoredThroughRim(299, { ...b, vy: -200 }, 300, 450, 550), false, 'moving up')
  assert.equal(ball.inGoal(ball.makeBall(30, 760, 20), 'left', 1000, 60, 800, 150), true)
  assert.equal(ball.inGoal(ball.makeBall(30, 500, 20), 'left', 1000, 60, 800, 150), false, 'above the bar')
  assert.equal(ball.inGoal(ball.makeBall(980, 760, 20), 'right', 1000, 60, 800, 150), true)
}

console.log('toys: all checks passed')
