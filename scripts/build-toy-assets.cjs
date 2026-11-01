// Fetches the pictures the desktop toys use and writes them as PNGs into src/assets/toys:
//  - hand, fist, basketball, soccer ball: Microsoft Fluent Emoji 3D (MIT)
//  - football boot (Football_shoe.svg, public domain) and tennis racket (Tennis_racket.svg, CC0) from Wikimedia Commons,
//    kept in src/assets/toys/source and rendered to PNG with scripts/render-svg.cjs (a page with the svg at 640 px wide).
// Run once with `npx electron scripts/build-toy-assets.cjs`; the PNGs are committed.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.join(__dirname, '..', 'src', 'assets', 'toys')
const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'
const UA = 'FlyDock-asset-fetch/1.0 (local build script)'

const PNGS = {
  'hand.png': `${FLUENT}/Hand%20with%20fingers%20splayed/Default/3D/hand_with_fingers_splayed_3d_default.png`,
  'fist.png': `${FLUENT}/Raised%20fist/Default/3D/raised_fist_3d_default.png`,
  'reach.png': `${FLUENT}/Rightwards%20hand/Default/3D/rightwards_hand_3d_default.png`,
  'grab.png': `${FLUENT}/Palm%20down%20hand/Default/3D/palm_down_hand_3d_default.png`,
  'basketball.png': `${FLUENT}/Basketball/3D/basketball_3d.png`,
  'soccer.png': `${FLUENT}/Soccer%20ball/3D/soccer_ball_3d.png`,
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  for (const [name, url] of Object.entries(PNGS)) {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (!res.ok) throw new Error(`${name}: ${res.status}`)
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await res.arrayBuffer()))
  }
  fs.writeFileSync(
    path.join(OUT, 'CREDITS.md'),
    [
      '# Toy pictures',
      '',
      '- `hand.png`, `fist.png`, `basketball.png`, `soccer.png`: Fluent Emoji (3D) by Microsoft, MIT licence, https://github.com/microsoft/fluentui-emoji',
      '- `boot.png`: "Football shoe.svg" from Wikimedia Commons, public domain, rendered to PNG.',
      '- `racket.png`: "Tennis racket.svg" from Wikimedia Commons, CC0, rendered to PNG.',
      '',
    ].join('\n'),
  )
  console.log('toy assets written')
  app.quit()
})
