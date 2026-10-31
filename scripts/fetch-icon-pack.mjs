// Downloads the 3D PNGs of Microsoft's Fluent Emoji (MIT licence) that the built-in "Fly 3B" icon pack uses and writes
// resources/icon-packs/fly-3d (png files + icons.json + the licence). Run once; the result is committed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon-packs', 'fly-3d')
const RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main'

// pack key (what the dock looks up) -> [emoji folder, file stem]
const E = (folder, stem = folder.toLowerCase().replace(/ /g, '_')) => [folder, stem]
const KEYS = {
  folder: E('File folder'), file: E('Page facing up'), trash: E('Wastebasket'), wheel: E('Control knobs'), power: E('High voltage'), group: E('Card file box'),
  mycomputerfolder: E('Laptop'), profile: E('Bust in silhouette'), networkplacesfolder: E('Globe with meridians'), desktop: E('Desktop computer'), documents: E('Open file folder'), belgeler: E('Open file folder'), downloads: E('Package'), indirilenler: E('Package'),
  pictures: E('Framed picture'), resimler: E('Framed picture'), videos: E('Television'), videolar: E('Television'), music: E('Musical note'),
  notepad: E('Memo'), calc: E('Abacus'), mspaint: E('Artist palette'), explorer: E('File folder'), cmd: E('Keyboard'), powershell: E('Keyboard'), wt: E('Keyboard'),
  taskmgr: E('Bar chart'), regedit: E('Wrench'), charmap: E('Input symbols'), magnify: E('Magnifying glass tilted left'), snippingtool: E('Scissors'),
  mstsc: E('Desktop computer'), control: E('Control knobs'), wmplayer: E('Musical note'), soundrecorder: E('Microphone'), mmc: E('Hammer and wrench'),
  'wheel-apps': E('Package'), 'wheel-system': E('Laptop'), 'wheel-power': E('Battery'), 'wheel-datetime': E('Alarm clock'), 'wheel-mouse': E('Computer mouse'),
  'wheel-controlpanel': E('Control knobs'), 'wheel-sound': E('Loudspeaker'), 'wheel-display': E('Desktop computer'), 'wheel-bluetooth': E('Satellite antenna'),
  'wheel-devices': E('Joystick'), 'wheel-network': E('Globe with meridians'), 'wheel-wifi': E('Antenna bars'), 'wheel-apps-settings': E('Package'),
  'wheel-personalize': E('Artist palette'), 'wheel-startup': E('Rocket'), 'wheel-storage': E('Floppy disk'), 'wheel-taskmgr': E('Bar chart'),
  'wheel-disks': E('Optical disk'), 'wheel-services': E('Gear'), 'wheel-events': E('Clipboard'), 'wheel-computer': E('Hammer and wrench'),
}

fs.mkdirSync(out, { recursive: true })
const files = new Map() // emoji file -> local name
const map = {}
for (const [key, [folder, stem]] of Object.entries(KEYS)) {
  const local = `${stem}.png`
  if (!files.has(local)) {
    const res = await fetch(`${RAW}/assets/${encodeURIComponent(folder)}/3D/${stem}_3d.png`)
    if (!res.ok) throw new Error(`${folder}: ${res.status}`)
    fs.writeFileSync(path.join(out, local), Buffer.from(await res.arrayBuffer()))
    files.set(local, true)
  }
  map[key] = local
}
// The full bin is the bin with two sheets of paper on top, composed by hand from wastebasket + page_facing_up (see git history).
map['trash-full'] = 'wastebasket_full.png'
const licence = await fetch(`${RAW}/LICENSE`)
fs.writeFileSync(path.join(out, 'LICENSE-fluentui-emoji.txt'), `Icons: Microsoft Fluent Emoji (3D), https://github.com/microsoft/fluentui-emoji\n\n${await licence.text()}`)
fs.writeFileSync(path.join(out, 'icons.json'), JSON.stringify({ map }, null, 2))
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ type: 'icons', id: 'fly-3d', name: 'Fly 3B', author: 'Fly Dock · Fluent Emoji (MIT)', version: '1.0' }, null, 2))
console.log(`${files.size} pictures, ${Object.keys(map).length} keys`)
