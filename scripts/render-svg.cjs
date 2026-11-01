// Renders an html page (with an svg in it) to a transparent PNG: npx electron scripts/render-svg.cjs page.html out.png width height
// Used for src/assets/toys/boot.png and racket.png, made from the svgs in src/assets/toys/source.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const [html, out, w, h] = process.argv.slice(2)
  const win = new BrowserWindow({ width: +w, height: +h, show: false, frame: false, transparent: true, useContentSize: true })
  await win.loadFile(html)
  await new Promise((r) => setTimeout(r, 400))
  fs.writeFileSync(out, (await win.webContents.capturePage()).toPNG())
  app.quit()
})
