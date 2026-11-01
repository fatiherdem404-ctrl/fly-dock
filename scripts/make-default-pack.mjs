// Draws the built-in icon pack (resources/icon-packs/fly-default) with the icon studio's "Dock önizlemesi" card: coloured
// rounded squares with a soft gradient and a white glyph, the colours of the dock preview in the settings.
// Needs no network: the glyphs are already in src/studio. Run after changing the studio's look or key list.
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electronPath from 'electron'

const dir = mkdtempSync(join(tmpdir(), 'default-pack-'))
const bundle = join(dir, 'studio.cjs')
await build({ entryPoints: ['src/studio/pack-entry.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent' })
const out = resolve('resources/icon-packs/fly-default')
mkdirSync(out, { recursive: true })
writeFileSync(join(dir, 'package.json'), '{"name":"make-pack","main":"main.cjs"}')
writeFileSync(join(dir, 'main.cjs'), `
const { app, BrowserWindow } = require('electron')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await win.loadURL('data:text/html,<body></body>')
  const r = await win.webContents.executeJavaScript(${JSON.stringify(`(async () => {
    const fs = require('fs'), path = require('path')
    const m = require(${JSON.stringify(bundle)})
    const design = m.designFrom(m.TEMPLATES.find((t) => t.id === 'dock'))
    const out = ${JSON.stringify(out)}
    // the places everybody has get fixed colours (0 orange, 1 blue, 2 green, 3 yellow, 4 purple, 5 pink); the rest take their turn
    const PICK = { start: 1, mycomputerfolder: 2, profile: 0, documents: 3, belgeler: 3, downloads: 2, indirilenler: 2, pictures: 5, resimler: 5, videos: 4, videolar: 4, music: 0, desktop: 1, networkplacesfolder: 4, wheel: 4, power: 0, group: 3, trash: 5, 'trash-full': 5, folder: 3, file: 1, explorer: 3, notepad: 3, calc: 2, cmd: 4, powershell: 1, wt: 4, taskmgr: 2, control: 4 }
    const map = {}
    for (let i = 0; i < m.STUDIO_KEYS.length; i++) {
      const [key, , glyph] = m.STUDIO_KEYS[i]
      const svg = m.cardSvg(design, glyph, { index: PICK[key] ?? i, badge: key === 'trash-full', uid: 'p' })
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      await img.decode()
      const c = document.createElement('canvas'); c.width = c.height = 256
      c.getContext('2d').drawImage(img, 0, 0, 256, 256)
      fs.writeFileSync(path.join(out, key + '.png'), Buffer.from(c.toDataURL('image/png').split(',')[1], 'base64'))
      map[key] = key + '.png'
    }
    fs.writeFileSync(path.join(out, 'icons.json'), JSON.stringify({ map, card: design }, null, 2))
    fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ type: 'icons', id: 'fly-default', name: 'Fly Varsayılan', author: 'Fly Dock', version: '1.0' }, null, 2))
    return Object.keys(map).length
  })()`)})
  console.log('ICONS ' + r)
  app.quit()
})
`)
const run = spawnSync(electronPath, [dir], { encoding: 'utf8', timeout: 180000 })
const line = (run.stdout || '').split('\n').find((l) => l.startsWith('ICONS '))
if (!line) throw new Error('no icons drawn: ' + run.stdout + run.stderr)
console.log(line.trim(), '->', out)
