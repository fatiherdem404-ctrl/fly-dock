// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Draws the 1280 x 640 picture GitHub and Reddit show when the repository is linked (Settings > Social preview).
//   npx electron scripts/make-social-preview.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const url = (p) => 'file:///' + path.join(root, p).replace(/\\/g, '/')

const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1280px;height:640px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
body{background:radial-gradient(900px 600px at 15% 10%,#2c4fa8 0%,transparent 60%),radial-gradient(800px 600px at 95% 90%,#7a3fb0 0%,transparent 60%),#0b1020;position:relative}
.left{position:absolute;left:72px;top:96px;width:520px}
.logo{width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(77,163,255,.5))}
h1{font-size:84px;line-height:1;margin:26px 0 14px;letter-spacing:-1px}
p{font-size:30px;line-height:1.3;margin:0;color:#c9d6f5}
.tags{margin-top:28px;display:flex;flex-wrap:wrap;gap:10px}
.tags span{font-size:20px;padding:6px 14px;border-radius:99px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2)}
.shot{position:absolute;left:640px;top:80px;width:560px;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18)}
.shot2{position:absolute;left:700px;top:330px;width:520px;border-radius:18px;box-shadow:0 30px 70px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18)}
</style>
<div class="left"><img class="logo" src="${url('src/assets/logo.png')}"><h1>Fly Dock</h1><p>A free, open-source dock for Windows</p>
<div class="tags"><span>Themes</span><span>Shelves</span><span>Live wallpapers</span><span>Icon studio</span></div></div>
<img class="shot" src="${url('docs/screenshots/themes.png')}"><img class="shot2" src="${url('docs/screenshots/dock.png')}">`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 640, show: false, useContentSize: true, webPreferences: { offscreen: false } })
  const tmp = path.join(app.getPath('temp'), 'social-preview.html')
  fs.writeFileSync(tmp, html)
  await win.loadFile(tmp)
  await new Promise((r) => setTimeout(r, 800))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 640 })
  const out = path.join(root, 'docs', 'social-preview.png')
  const small = img.resize({ width: 1280, height: 640, quality: 'best' })
  fs.writeFileSync(out, small.toPNG())
  console.log('saved', out, small.getSize())
  app.quit()
})
