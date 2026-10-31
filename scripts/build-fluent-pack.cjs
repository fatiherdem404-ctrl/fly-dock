// Builds the built-in "Fly Windows 11" icon pack: downloads SVGs from vinceliuice/Fluent-icon-theme (GPL-3.0) and renders
// them to 256 px PNGs with Electron. Run once with `npx electron scripts/build-fluent-pack.cjs`; the result is committed
// in resources/icon-packs/fly-win11.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.join(__dirname, '..', 'resources', 'icon-packs', 'fly-win11')
const RAW = 'https://raw.githubusercontent.com/vinceliuice/Fluent-icon-theme/master/src/scalable'
const KEYS = {
  folder: 'places/default-folder', file: 'mimetypes/text-x-generic', group: 'places/folder-applications', trash: 'places/user-trash', 'trash-full': 'places/user-trash-full',
  wheel: 'apps/applications-system', power: 'apps/gnome-power-manager',
  mycomputerfolder: 'devices/computer', profile: 'places/default-user-home', networkplacesfolder: 'places/default-network', desktop: 'places/default-user-desktop',
  documents: 'places/default-folder-documents', belgeler: 'places/default-folder-documents', downloads: 'places/default-folder-download', indirilenler: 'places/default-folder-download',
  pictures: 'places/default-folder-pictures', resimler: 'places/default-folder-pictures', videos: 'places/default-folder-video', videolar: 'places/default-folder-video', music: 'places/default-folder-music',
  notepad: 'apps/text-editor', calc: 'apps/calc', mspaint: 'apps/gnome-paint', explorer: 'apps/file-manager', cmd: 'apps/terminal', powershell: 'apps/terminal', wt: 'apps/terminal',
  taskmgr: 'apps/utilities-system-monitor', regedit: 'apps/regedit', snippingtool: 'apps/accessories-screenshot', mstsc: 'apps/remote-desktop', control: 'apps/applications-system',
  wmplayer: 'apps/totem', soundrecorder: 'apps/gnome-sound-recorder', mmc: 'apps/applications-system', charmap: 'apps/fonts',
  'wheel-apps': 'apps/applications-utilities', 'wheel-system': 'apps/preferences-devices-cpu', 'wheel-power': 'apps/gnome-power-manager', 'wheel-datetime': 'apps/preferences-system-time',
  'wheel-mouse': 'apps/input-mouse', 'wheel-controlpanel': 'apps/applications-system', 'wheel-sound': 'apps/multimedia-volume-control', 'wheel-display': 'apps/preferences-desktop-display',
  'wheel-bluetooth': 'apps/bluetooth', 'wheel-devices': 'apps/preferences-devices-cpu', 'wheel-network': 'devices/network-wired', 'wheel-wifi': 'devices/network-wireless',
  'wheel-apps-settings': 'apps/applications-utilities', 'wheel-personalize': 'apps/preferences-desktop-theme-global', 'wheel-startup': 'apps/system-software-update', 'wheel-storage': 'devices/drive-harddisk',
  'wheel-taskmgr': 'apps/utilities-system-monitor', 'wheel-disks': 'devices/drive-harddisk', 'wheel-services': 'apps/applications-system', 'wheel-events': 'apps/preferences-log', 'wheel-computer': 'devices/computer',
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: false } })
  const map = {}
  const done = new Map()
  for (const [key, src] of Object.entries(KEYS)) {
    const name = src.split('/')[1] + '.png'
    if (!done.has(src)) {
      const res = await fetch(`${RAW}/${src}.svg`)
      if (!res.ok) throw new Error(`${src}: ${res.status}`)
      const svg = Buffer.from(await res.arrayBuffer()).toString('base64')
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${svg}" style="width:256px;height:256px;display:block">`)}`)
      await new Promise((r) => setTimeout(r, 150))
      fs.writeFileSync(path.join(OUT, name), (await win.webContents.capturePage()).toPNG())
      done.set(src, name)
    }
    map[key] = name
  }
  const licence = await (await fetch('https://raw.githubusercontent.com/vinceliuice/Fluent-icon-theme/master/COPYING')).text()
  fs.writeFileSync(path.join(OUT, 'LICENSE-fluent-icon-theme.txt'), `Icons: Fluent icon theme by vinceliuice, https://github.com/vinceliuice/Fluent-icon-theme (GPL-3.0)\n\n${licence}`)
  fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify({ map }, null, 2))
  fs.writeFileSync(path.join(OUT, 'pack.json'), JSON.stringify({ type: 'icons', id: 'fly-win11', name: 'Fly Windows 11', author: 'Fluent icon theme (GPL-3.0)', version: '1.0' }, null, 2))
  console.log(`${done.size} pictures, ${Object.keys(map).length} keys`)
  app.quit()
})
