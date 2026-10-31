// Checks the dock maths: falloff shape, spring behaviour (no overshoot, frame-rate independence), row anchoring.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'physics-test-'))
const outfile = join(dir, 'physics.mjs')
await build({ entryPoints: ['src/physics.ts'], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' })
const { falloff, SPRINGS, stepSpring, isSettled, targetSizes, layoutRow } = await import(pathToFileURL(outfile).href)

// falloff: 1 at the centre, 0 at and beyond the radius, monotonic in between
assert.equal(falloff(0, 100), 1)
assert.equal(falloff(100, 100), 0)
assert.equal(falloff(250, 100), 0)
let prev = 1
for (let d = 1; d < 100; d++) {
  const f = falloff(d, 100)
  assert.ok(f <= prev, 'falloff must not increase with distance')
  prev = f
}

// simulate a spring until it settles; returns trajectory
function simulate(params, fps, from = 48, to = 84) {
  let x = from
  let v = 0
  const dt = 1 / fps
  const path = [x]
  for (let frame = 0; frame < fps * 3; frame++) {
    ;[x, v] = stepSpring(x, v, to, dt, params)
    path.push(x)
    if (isSettled(x, v, to)) break
  }
  return { path, frames: path.length }
}

for (const curve of ['spring', 'ease', 'linear']) {
  for (const fps of [30, 60, 144]) {
    const { path, frames } = simulate(SPRINGS[curve], fps)
    assert.ok(Math.max(...path) <= 84.05, `${curve}@${fps}: critically damped spring must not overshoot (peak ${Math.max(...path)})`)
    for (let i = 1; i < path.length; i++) assert.ok(path[i] >= path[i - 1] - 1e-9, `${curve}@${fps}: growth must be monotonic`)
    assert.ok(frames / fps < (curve === 'ease' ? 0.9 : 0.6), `${curve}@${fps}: settles quickly (took ${((frames / fps) * 1000).toFixed(0)} ms)`)
  }
}

// the bouncy curve is allowed to overshoot, but only a little and it must still settle
const bounce = simulate(SPRINGS.bounce, 60)
assert.ok(Math.max(...bounce.path) < 84 * 1.12 && bounce.frames < 180, 'bounce stays bounded and settles')

// frame-rate independence: same curve at 30 and 120 fps agrees after 100 ms
const at = (fps) => {
  let x = 48
  let v = 0
  for (let i = 0; i < Math.round(fps * 0.1); i++) [x, v] = stepSpring(x, v, 84, 1 / fps, SPRINGS.spring)
  return x
}
assert.ok(Math.abs(at(30) - at(120)) < 0.5, 'animation must look the same at 30 and 120 fps')

// targets: biggest under the pointer, resting size far away, separators untouched
const restWidth = [48, 48, 17, 48, 48]
const restLeft = restWidth.map((_, i) => restWidth.slice(0, i).reduce((a, b) => a + b + 8, 0))
const common = { restLeft, restWidth, separator: [false, false, true, false, false], iconSize: 48, magnifiedSize: 84, radiusIcons: 2, gap: 8 }
const centre = restLeft[1] + 24
const t = targetSizes({ ...common, pointer: centre })
assert.equal(Math.round(t[1]), 84)
assert.ok(t[0] > 48 && t[0] < 84 && t[3] > 48, 'neighbours grow')
assert.equal(t[2], 17, 'separator keeps its width')
assert.deepEqual(targetSizes({ ...common, pointer: null }), [48, 48, 17, 48, 48])

// layout: at rest the row sits at restStart; magnified, the point under the pointer stays put
const restRow = layoutRow({ sizes: [48, 48, 17, 48, 48], restLeft, restWidth, gap: 8, restStart: 100, anchor: centre })
assert.ok(Math.abs(restRow.start - 100) < 1e-9, 'unmagnified row stays where it is')
const grown = layoutRow({ sizes: t, restLeft, restWidth, gap: 8, restStart: 100, anchor: centre })
const slot = 1
const underPointer = grown.start + grown.positions[slot] + 0.5 * t[slot]
assert.ok(Math.abs(underPointer - (100 + centre)) < 1e-6, 'icon under the pointer stays under the pointer')
assert.ok(grown.length > restRow.length, 'row widens when magnified')

// the row must glide while the pointer crosses icons AND the gaps between them (it used to jump by a gap width)
{
  const widths = [48, 48, 17, 48, 48]
  const lefts = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b + 8, 0))
  const length = lefts[4] + 48
  let previous = null
  let worst = 0
  for (let a = 0; a <= length; a += 0.25) {
    const sizes = targetSizes({ restLeft: lefts, restWidth: widths, separator: [false, false, true, false, false], pointer: a, iconSize: 48, magnifiedSize: 84, radiusIcons: 2, gap: 8 })
    const { start } = layoutRow({ sizes, restLeft: lefts, restWidth: widths, gap: 8, restStart: 0, anchor: a })
    if (previous !== null) worst = Math.max(worst, Math.abs(start - previous))
    previous = start
  }
  assert.ok(worst < 1.5, `row start moves at most 1.5 px per 0.25 px of pointer travel (worst jump ${worst.toFixed(2)} px)`)
}

// ---- window geometry: nothing may stick out of the window, for any settings and any pointer position ----
const layoutOut = join(dir, 'layout.mjs')
await build({ entryPoints: ['src/layout.ts'], bundle: true, platform: 'node', format: 'esm', outfile: layoutOut, logLevel: 'silent' })
const typesOut = join(dir, 'types.mjs')
await build({ entryPoints: ['src/shared/types.ts'], bundle: true, platform: 'node', format: 'esm', outfile: typesOut, logLevel: 'silent' })
const { dockGeometry, fitToScreen, padsFor } = await import(pathToFileURL(layoutOut).href)
const { DEFAULT_SETTINGS } = await import(pathToFileURL(typesOut).href)

let seed = 7
const rand = (lo, hi) => {
  seed = (seed * 16807) % 2147483647
  return lo + ((seed / 2147483647) * (hi - lo))
}
const kinds = ['app', 'app', 'separator', 'app', 'app', 'folder', 'app', 'trash']
for (let n = 0; n < 200; n++) {
  const s = {
    ...DEFAULT_SETTINGS,
    position: ['bottom', 'top', 'left', 'right'][n % 4],
    iconSize: Math.round(rand(24, 96)),
    maxScale: rand(1, 3),
    magnificationRadius: rand(0.5, 5),
    iconSpacing: Math.round(rand(0, 32)),
    falloff: ['cosine', 'gaussian', 'linear', 'sharp'][n % 4],
    hoverAnimation: ['zoom', 'lift', 'wave'][n % 3],
    animationCurve: ['spring', 'bounce', 'ease'][n % 3],
    deskPadTop: Math.round(rand(0, 48)), deskPadBottom: Math.round(rand(0, 48)), deskPadLeft: Math.round(rand(0, 48)), deskPadRight: Math.round(rand(0, 48)),
    deskDepth: Math.round(rand(0, 60)),
    labelMode: ['hover', 'always', 'never'][n % 3],
    labelSize: Math.round(rand(9, 20)),
  }
  const types = kinds.slice(0, 3 + (n % 6))
  const g = dockGeometry(s, types, false, 30)
  const pads = padsFor(s)
  // pointer anywhere, sizes possibly stale from another pointer: the widest the row can be is restLength + widening
  assert.ok(g.overshoot >= 0 && g.main >= g.restLength + 2 * Math.max(pads.mainStart, pads.mainEnd), 'window is at least as long as the row with its paddings')
  const icon = s.iconSize
  assert.ok(g.cross >= Math.min(g.maxThickness, icon) + pads.crossEdge, 'window is at least as thick as the desk at rest')
  assert.ok(g.cross >= g.baseOffset + pads.crossEdge + g.maxIcon + g.liftMax + pads.crossFar, 'the biggest, lifted icon fits across the window')
  // fitting to a screen edge: the result always fits, unless the icons are already at their smallest
  const available = Math.round(rand(300, 1200))
  const fitted = fitToScreen(s, types, false, 30, available)
  const fits = dockGeometry(fitted, types, false, 30).main <= available
  assert.ok(fits || fitted.iconSize <= 16, `dock is eased until it fits (available ${available}, icon ${fitted.iconSize})`)
}

console.log('physics: all checks passed')
