// Runs the tweak engine against a private registry key (HKCU\Software\FlyDockTweakTest) with the real reg.exe:
// apply, revert, restoring a pre-existing value, double apply, key tweaks, and refusal to leave HKCU.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'tweaks-test-'))
const outfile = join(dir, 'tweaks.mjs')
await build({ entryPoints: ['electron/tweaks.ts'], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' })
const { createTweakEngine, realRegistry } = await import(pathToFileURL(outfile).href)

const ROOT = 'HKCU\\Software\\FlyDockTweakTest'
const cleanup = () => { try { execFileSync('reg.exe', ['delete', ROOT, '/f'], { stdio: 'ignore' }) } catch { /* not there */ } }
cleanup()

const tweaks = [
  { id: 'plain', name: 'Plain', description: '', category: 't', risk: 'safe', effect: 'none', spec: { kind: 'value', key: ROOT, name: 'Plain', type: 'REG_DWORD', on: '1', off: '0' } },
  { id: 'kept', name: 'Kept', description: '', category: 't', risk: 'safe', effect: 'none', spec: { kind: 'value', key: ROOT, name: 'Kept', type: 'REG_SZ', on: 'yes', off: 'no' } },
  { id: 'subkey', name: 'Subkey', description: '', category: 't', risk: 'safe', effect: 'none', spec: { kind: 'key', key: `${ROOT}\\Sub` } },
  { id: 'win11', name: 'Win11 only', description: '', category: 't', risk: 'safe', minBuild: 22000, effect: 'none', spec: { kind: 'value', key: ROOT, name: 'W11', type: 'REG_DWORD', on: '1', off: '0' } },
  { id: 'escape', name: 'Escape', description: '', category: 't', risk: 'caution', effect: 'none', spec: { kind: 'value', key: 'HKLM\\Software\\FlyDockTweakTest', name: 'No', type: 'REG_DWORD', on: '1', off: '0' } },
]

let state = { applied: {}, log: [] }
const engine = createTweakEngine({ registry: realRegistry, tweaks, store: { get: () => state, set: (s) => { state = s } }, build: 19045, now: () => 1 })
const info = async (id) => (await engine.list()).find((t) => t.id === id)

try {
  // a value that did not exist: apply creates it, revert removes it again
  assert.equal((await info('plain')).enabled, false)
  assert.equal((await engine.set('plain', true)).ok, true)
  assert.equal((await info('plain')).enabled, true)
  assert.equal((await info('plain')).changedByUs, true)
  assert.equal((await engine.set('plain', false)).ok, true)
  assert.equal(await realRegistry.query(ROOT, 'Plain'), null, 'the value is gone again, not left at 0')
  assert.equal((await info('plain')).changedByUs, false)

  // a value the user already had: reverting puts back exactly what was there
  await realRegistry.write(ROOT, 'Kept', 'REG_SZ', 'my own value')
  await engine.set('kept', true)
  assert.equal((await realRegistry.query(ROOT, 'Kept')).data, 'yes')
  await engine.set('kept', true) // applying twice must not overwrite the first backup
  await engine.set('kept', false)
  assert.equal((await realRegistry.query(ROOT, 'Kept')).data, 'my own value')

  // key tweaks
  assert.equal((await info('subkey')).enabled, false)
  await engine.set('subkey', true)
  assert.equal(await realRegistry.keyExists(`${ROOT}\\Sub`), true)
  await engine.set('subkey', false)
  assert.equal(await realRegistry.keyExists(`${ROOT}\\Sub`), false)

  // unsupported Windows version: hidden from the list and refused
  assert.equal(await info('win11'), undefined)
  assert.equal((await engine.set('win11', true)).ok, false)

  // nothing outside HKCU, and unknown ids do nothing
  assert.equal((await engine.set('escape', true)).ok, false)
  assert.equal((await engine.set('nope', true)).ok, false)

  // revert everything
  await engine.set('plain', true)
  await engine.set('subkey', true)
  assert.equal(await engine.revertAll(), 2)
  assert.equal(Object.keys(state.applied).length, 0)
  assert.ok(state.log.length >= 6, 'every change is logged')
} finally {
  cleanup()
}
// ---- administrator tweaks: state is read, changes go through the elevated helper (faked here) ----
{
  const machine = new Map() // pretend HKLM
  const fake = { ...realRegistry, query: async (key, name) => (machine.has(key + name) ? { type: 'REG_DWORD', data: machine.get(key + name) } : null) }
  const adminTweaks = [
    { id: 'arrow', name: 'Arrow', description: '', category: 't', risk: 'caution', effect: 'explorer', spec: { kind: 'admin', job: 'shortcut-arrow', state: { key: 'HKLM\\X', name: '29', on: 'exists' } } },
    { id: 'hib', name: 'Hib', description: '', category: 't', risk: 'caution', effect: 'none', spec: { kind: 'admin', job: 'hibernate', state: { key: 'HKLM\\P', name: 'HibernateEnabled', on: '0' } } },
  ]
  const calls = []
  let allow = true
  const elevated = async (op, job) => {
    calls.push(`${op}:${job}`)
    if (!allow) return { ok: false, message: 'cancelled' }
    if (job === 'shortcut-arrow') op === 'apply' ? machine.set('HKLM\\X29', 'x') : machine.delete('HKLM\\X29')
    if (job === 'hibernate') machine.set('HKLM\\PHibernateEnabled', op === 'apply' ? '0' : '1')
    return { ok: true, message: 'done' }
  }
  let st = { applied: {}, log: [] }
  const admin = createTweakEngine({ registry: fake, tweaks: adminTweaks, store: { get: () => st, set: (s) => { st = s } }, elevated, build: 19045 })
  const row = async (id) => (await admin.list()).find((x) => x.id === id)

  assert.equal((await row('arrow')).admin, true, 'administrator tweaks are flagged so the UI can say a prompt will appear')
  assert.equal((await admin.set('arrow', true)).ok, true)
  assert.equal((await row('arrow')).enabled, true)
  assert.equal((await admin.set('arrow', false)).ok, true)
  assert.equal((await row('arrow')).enabled, false)

  allow = false // the user dismisses the Windows prompt
  assert.equal((await admin.set('arrow', true)).ok, false)
  assert.equal((await row('arrow')).enabled, false, 'a declined prompt changes nothing')
  assert.equal(Object.keys(st.applied).length, 0)
  allow = true

  machine.set('HKLM\\PHibernateEnabled', '0') // hibernation was already off
  calls.length = 0
  await admin.set('hib', true)
  assert.deepEqual(calls, [], 'nothing is run (and nothing recorded) when the setting is already the wanted way')
  assert.equal((await row('hib')).changedByUs, false)

  // a setting that was already on before this app is never switched off by it
  assert.equal((await admin.set('hib', false)).ok, false)
  assert.equal(machine.get('HKLM\\PHibernateEnabled'), '0')
}

// ---- the helper itself: unknown jobs are refused and a normal (non-elevated) run cannot change HKLM ----
{
  const { existsSync } = await import('node:fs')
  const exe = join(process.env.FLY_DOCK_HELPER_DIR ?? 'helper/bin', 'dock-helper.exe')
  const elevatedNow = (() => { try { execFileSync('net.exe', ['session'], { stdio: 'ignore' }); return true } catch { return false } })()
  if (!existsSync(exe)) console.log('tweaks: helper not built, skipping the helper exit-code checks')
  else {
    const code = (...args) => { try { execFileSync(exe, args, { stdio: 'ignore', timeout: 20000 }); return 0 } catch (e) { return e.status } }
    assert.equal(code('--elevated', 'apply', 'rm-rf'), 2, 'unknown job')
    assert.equal(code('--elevated', 'explode', 'hibernate'), 2, 'unknown operation')
    assert.equal(code('--elevated', 'apply'), 2, 'missing argument')
    if (!elevatedNow) assert.equal(code('--elevated', 'apply', 'shortcut-arrow'), 5, 'without administrator rights the registry is not touched')
    else console.log('tweaks: running elevated, skipping the refusal check so the real registry is not changed')
  }
}

console.log('tweaks: all checks passed')
