// Checks the toy physics (balls bounce, rest, never tunnel; kicks and throws; scoring) and the pet's rules.
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
const pet = await load('src/toys/pet.ts', 'pet.mjs')

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

// the pet: stays on the floor and inside the screen, falls when dropped, chases the pointer, wakes up
{
  let seed = 12345
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const ctx = { width: 1000, floor: 800, pointer: null, chase: false, size: 64, rand, kind: 'cat', home: 0 }
  const p = pet.makePet(500, 800)
  const seen = new Set()
  for (let i = 0; i < 60 * 120; i++) {
    pet.stepPet(p, 1 / 60, ctx)
    seen.add(p.state)
    assert.ok(p.x >= 32 && p.x <= 968, 'inside the screen')
    assert.equal(p.y, 800, 'feet on the floor')
  }
  for (const s of ['walk', 'sit', 'sleep', 'idle']) assert.ok(seen.has(s), `the pet ${s}s sometimes`)

  pet.pickUp(p)
  p.x = 300
  p.y = 200
  pet.drop(p, 0, 0)
  for (let i = 0; i < 60 * 3; i++) pet.stepPet(p, 1 / 60, ctx)
  assert.equal(p.y, 800, 'lands on the floor after being dropped')
  assert.notEqual(p.state, 'fall')

  const q = pet.makePet(100, 800)
  const chase = { ...ctx, chase: true, pointer: { x: 700, y: 780 } }
  for (let i = 0; i < 60 * 6; i++) pet.stepPet(q, 1 / 60, chase)
  assert.ok(Math.abs(q.x - 700) < 120, `the pet came to the pointer (${q.x})`)

  const s = pet.makePet(500, 800)
  s.state = 'sleep'
  s.timer = 10
  pet.stepPet(s, 1 / 60, { ...ctx, pointer: { x: 520, y: 790 } })
  assert.notEqual(s.state, 'sleep', 'a close pointer wakes the pet')
}
// the dog fetches a thrown stick: runs to it, picks it up, brings it home and puts it down
{
  const ctx = { width: 1000, floor: 800, pointer: null, chase: false, size: 64, rand: () => 0.5, kind: 'dog', home: 300 }
  const d = pet.makePet(100, 800)
  d.state = 'sit'
  d.timer = 99
  const events = []
  for (let i = 0; i < 60 * 40; i++) {
    const free = !events.includes('pickup') || events.includes('drop')
    const stickX = events.includes('pickup') ? d.x : 800
    const e = pet.stepPet(d, 1 / 60, { ...ctx, stick: { x: stickX, free: !events.includes('pickup') } })
    if (e) events.push(e)
    if (events.includes('drop')) break
  }
  assert.deepEqual(events, ['pickup', 'drop'], `pickup then drop (${events})`)
  assert.ok(Math.abs(d.x - 300) < 90, `brought it back home (${d.x})`)
  assert.equal(d.fetch, 'none')
  // right after, it does not run off again for the same stick
  for (let i = 0; i < 60 * 2; i++) assert.equal(pet.stepPet(d, 1 / 60, { ...ctx, stick: { x: d.x + 200, free: true } }), null)
  assert.notEqual(d.fetch, 'go', 'it rests before the next throw')
  // a stick the user holds is not chased
  const e = pet.makePet(100, 800)
  e.state = 'sit'
  e.timer = 99
  for (let i = 0; i < 60 * 5; i++) pet.stepPet(e, 1 / 60, { ...ctx, stick: { x: 800, free: false } })
  assert.equal(e.fetch, 'none')
}

// the cat runs to a ball of yarn and bats it, then loses interest for a while
{
  const ctx = { width: 1000, floor: 800, pointer: null, chase: false, size: 64, rand: () => 0.5, kind: 'cat', home: 0 }
  const c = pet.makePet(100, 800)
  c.state = 'sit'
  c.timer = 99
  let swats = 0
  let played = false
  for (let i = 0; i < 60 * 14; i++) {
    if (pet.stepPet(c, 1 / 60, { ...ctx, yarn: { x: 600, rolling: false } }) === 'swat') swats++
    if (c.state === 'play') played = true
  }
  assert.ok(played && swats >= 3, `the cat played (swats: ${swats})`)
  assert.ok(Math.abs(c.x - 600) < 80, `it stayed at the yarn (${c.x})`)
  assert.ok(c.cool > 0 || c.state === 'sit', 'then it rests')
  // a sleeping cat ignores a yarn that lies still, but wakes for one that rolls
  const s = pet.makePet(100, 800)
  s.state = 'sleep'
  s.timer = 99
  for (let i = 0; i < 60; i++) pet.stepPet(s, 1 / 60, { ...ctx, yarn: { x: 600, rolling: false } })
  assert.equal(s.state, 'sleep')
  for (let i = 0; i < 30; i++) pet.stepPet(s, 1 / 60, { ...ctx, yarn: { x: 600, rolling: true } })
  assert.equal(s.state, 'run', 'a rolling yarn wakes it')
}
console.log('toys: all checks passed')
