// VOID — hacimli 3B toz evreni
// Gerçek x, y, z koordinatlarında ~2000 parçacık: dönen bir sarmal galaksi, ara sıra bir 3B şekle (düğüm, küre, halka,
// çift sarmal) dönüşüp yeniden dağılıyor. Fare kamerayı çevirir ve tozu iter, basılı tutunca çeker; tıklayınca
// süpernova patlar. Uzak ve yakın parçacıklar odak dışında yumuşar (alan derinliği). Kare süresine bakıp parçacık
// sayısını kendi ayarlar, canlı duvar kâğıdında işlemciyi yormaz.
//
//   init(ctx, view)             boyut her değiştiğinde çalışır; view = { width, height }
//   draw(ctx, t, dt, pointer)   her karede çalışır; t ve dt saniye
//                               pointer = { x, y, nx, ny, on, down }  (nx, ny: 0..1)
//   click(x, y)                 tıklayınca çalışır

const MAXN = 2600
const MINN = 500
const CYCLE = 40
const NPAL = 24

let W = 0, H = 0, CX = 0, CY = 0, FOCAL = 1, UNIT = 1
let N = 1700, built = false
let emaDt = 0.016, tune = 0

// parçacık verisi (hepsi düz diziler: hızlı ve çöp üretmez)
const gr = new Float32Array(MAXN), gth = new Float32Array(MAXN), gy = new Float32Array(MAXN), gw = new Float32Array(MAXN)
const sx = new Float32Array(MAXN), sy = new Float32Array(MAXN), sz = new Float32Array(MAXN)
const dly = new Float32Array(MAXN), ph = new Float32Array(MAXN), siz = new Float32Array(MAXN), bri = new Float32Array(MAXN)
const col = new Uint8Array(MAXN)
const dx = new Float32Array(MAXN), dy = new Float32Array(MAXN), dz = new Float32Array(MAXN)
const vx = new Float32Array(MAXN), vy = new Float32Array(MAXN), vz = new Float32Array(MAXN)

let sprites = [], halo = null, fog = null
let cyc = 0, tg = 0, shapeKind = 0, shapeYaw = 0
let yawBase = 0, yawOff = 0, pitch = 0.4, camD = 2.7, zoom = 0
let waves = [], flash = 0
let lastClick = null

const rnd = Math.random
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2
const smooth = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x) }

function paletteHue(k) {
  // sıcak çekirdek -> mavi kollar -> mor halo -> pembe yıldız doğum bölgeleri
  if (k < 4) return 32 + k * 6
  if (k < 15) return 196 + (k - 4) * 4
  if (k < 21) return 262 + (k - 15) * 7
  return 318 + (k - 21) * 6
}

function makeSprites() {
  sprites = []
  for (let k = 0; k < NPAL; k++) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const hue = paletteHue(k)
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    rg.addColorStop(0, 'hsla(' + hue + ', 60%, 96%, 1)')
    rg.addColorStop(0.14, 'hsla(' + hue + ', 100%, 70%, 0.95)')
    rg.addColorStop(0.42, 'hsla(' + hue + ', 100%, 55%, 0.26)')
    rg.addColorStop(1, 'hsla(' + hue + ', 100%, 50%, 0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 64, 64)
    sprites.push(c)
  }
  halo = document.createElement('canvas')
  halo.width = halo.height = 256
  const h = halo.getContext('2d')
  const hg = h.createRadialGradient(128, 128, 0, 128, 128, 128)
  hg.addColorStop(0, 'rgba(190, 215, 255, 0.55)')
  hg.addColorStop(0.3, 'rgba(110, 140, 255, 0.18)')
  hg.addColorStop(1, 'rgba(60, 80, 255, 0)')
  h.fillStyle = hg
  h.fillRect(0, 0, 256, 256)
}

function makeFog() {
  fog = document.createElement('canvas')
  fog.width = Math.max(2, Math.round(W / 2))
  fog.height = Math.max(2, Math.round(H / 2))
  const g = fog.getContext('2d')
  const w = fog.width, h = fog.height
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#02030b')
  bg.addColorStop(1, '#070a1f')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  const clouds = [
    [0.22, 0.3, 0.55, 'rgba(60, 90, 255, 0.20)'],
    [0.78, 0.7, 0.6, 'rgba(150, 60, 255, 0.17)'],
    [0.55, 0.15, 0.4, 'rgba(0, 200, 220, 0.10)'],
    [0.35, 0.85, 0.5, 'rgba(255, 70, 160, 0.09)'],
  ]
  for (const c of clouds) {
    const r = c[2] * Math.max(w, h)
    const rg = g.createRadialGradient(c[0] * w, c[1] * h, 0, c[0] * w, c[1] * h, r)
    rg.addColorStop(0, c[3])
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = rg
    g.fillRect(0, 0, w, h)
  }
  // kenarları karart
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vg.addColorStop(1, 'rgba(0, 0, 8, 0.7)')
  g.fillStyle = vg
  g.fillRect(0, 0, w, h)
}

function buildGalaxy() {
  for (let i = 0; i < MAXN; i++) {
    const u = rnd()
    let r, th, y, k
    if (u < 0.66) {
      // sarmal kollar
      const arm = i % 3
      r = 0.05 + Math.pow(rnd(), 1.35) * 0.97
      th = (arm * Math.PI * 2) / 3 + r * 4.4 + gauss() * (0.1 + r * 0.17)
      y = gauss() * 0.032 * (1.15 - r * 0.7)
      k = rnd() < 0.07 ? 21 + ((rnd() * 3) | 0) : Math.min(14, 4 + ((r * 13) | 0))
      siz[i] = 0.5 + rnd() * 0.7
    } else if (u < 0.86) {
      // çekirdek
      r = Math.abs(gauss()) * 0.11
      th = rnd() * Math.PI * 2
      y = gauss() * 0.07
      k = (rnd() * 4) | 0
      siz[i] = 0.6 + rnd() * 0.8
    } else {
      // seyrek halo tozu: derinlik hissini bu verir
      r = 0.25 + rnd() * 1.1
      th = rnd() * Math.PI * 2
      y = gauss() * 0.42
      k = 15 + ((rnd() * 6) | 0)
      siz[i] = 0.35 + rnd() * 0.5
    }
    gr[i] = r
    gth[i] = th
    gy[i] = y
    gw[i] = 0.16 + 0.035 / (r + 0.35)
    col[i] = k
    dly[i] = rnd()
    ph[i] = rnd() * 6.28
    bri[i] = 0.45 + rnd() * 0.55
    if (rnd() < 0.025) { siz[i] *= 2.3; bri[i] = 1 }
  }
}

// dönüşeceği şekiller
function setShape(kind) {
  shapeKind = kind
  for (let i = 0; i < MAXN; i++) {
    const f = i / MAXN
    let x = 0, y = 0, z = 0
    if (kind === 0) {
      // üçlü düğüm (trefoil), kalın bir tüp
      const u = f * Math.PI * 2 * 3
      x = Math.sin(u) + 2 * Math.sin(2 * u)
      y = Math.cos(u) - 2 * Math.cos(2 * u)
      z = -Math.sin(3 * u)
      x *= 0.26; y *= 0.26; z *= 0.26
      x += gauss() * 0.03; y += gauss() * 0.03; z += gauss() * 0.03
    } else if (kind === 1) {
      // küre kabuğu + ekvator halkası
      if (i % 5 === 0) {
        const a = rnd() * Math.PI * 2
        x = Math.cos(a) * 1.05; z = Math.sin(a) * 1.05; y = gauss() * 0.015
      } else {
        const yy = 1 - 2 * ((i + 0.5) / MAXN)
        const rr = Math.sqrt(1 - yy * yy)
        const phi = i * 2.39996
        x = Math.cos(phi) * rr * 0.78; y = yy * 0.78; z = Math.sin(phi) * rr * 0.78
      }
      x += gauss() * 0.01; y += gauss() * 0.01; z += gauss() * 0.01
    } else if (kind === 2) {
      // simit
      const a = rnd() * Math.PI * 2, b = rnd() * Math.PI * 2
      const R = 0.62, r = 0.25
      x = (R + r * Math.cos(b)) * Math.cos(a)
      z = (R + r * Math.cos(b)) * Math.sin(a)
      y = r * Math.sin(b)
    } else {
      // çift sarmal (DNA)
      const s = (f * 2 - 1) * 1.25
      const strand = i % 2 ? 0 : Math.PI
      const a = s * 5.2 + strand
      x = Math.cos(a) * 0.36; z = Math.sin(a) * 0.36; y = s * 0.78
      if (i % 11 === 0) { const m = (rnd() * 2 - 1) * 0.36; x = Math.cos(a) * m; z = Math.sin(a) * m }
      x += gauss() * 0.012; y += gauss() * 0.012; z += gauss() * 0.012
    }
    sx[i] = x; sy[i] = y; sz[i] = z
  }
}

function init(ctx, view) {
  W = view.width; H = view.height
  CX = W / 2; CY = H / 2
  FOCAL = Math.min(W * 0.9, H * 1.5)
  UNIT = Math.max(0.55, Math.min(1.6, H / 900))
  if (!built) {
    built = true
    buildGalaxy()
    makeSprites()
    setShape(0)
  }
  makeFog()
}

// kamera: önce yatay (yaw), sonra eğim (pitch)
let cyaw = 1, syaw = 0, cpit = 1, spit = 0

function click(x, y) {
  lastClick = { x: x, y: y }
}

function explode(x, y, focusD) {
  // tıklanan noktayı odak düzleminde 3B dünyaya taşı
  const f = FOCAL / focusD
  const xr = (x - CX) / f, yr = (y - CY) / f, zr2 = camD - focusD
  const wy = yr * cpit + zr2 * spit
  const zr = -yr * spit + zr2 * cpit
  const wx = xr * cyaw + zr * syaw
  const wz = -xr * syaw + zr * cyaw
  const R = 0.7
  for (let i = 0; i < N; i++) {
    // parçacığın şu anki yeri yaklaşık: taban + sapma, yeterince iyi bir ölçü
    const px = bx[i] + dx[i], py = by[i] + dy[i], pz = bz[i] + dz[i]
    const ex = px - wx, ey = py - wy, ez = pz - wz
    const d2 = ex * ex + ey * ey + ez * ez
    if (d2 > R * R) continue
    const d = Math.sqrt(d2) + 0.02
    const k = (1 - d / R) * 3.8
    vx[i] += (ex / d) * k + gauss() * 0.25
    vy[i] += (ey / d) * k + gauss() * 0.25
    vz[i] += (ez / d) * k + gauss() * 0.25
  }
  waves.push({ x: x, y: y, age: 0 })
  if (waves.length > 5) waves.shift()
  flash = 1
}

// parçacıkların bu karedeki tabanı (galaksi ya da şekil), tıklama için saklanır
const bx = new Float32Array(MAXN), by = new Float32Array(MAXN), bz = new Float32Array(MAXN)

function draw(ctx, t, dt, pointer) {
  // ---- zaman çizelgesi: galaksi -> şekil -> galaksi ----
  const prev = cyc
  cyc = (cyc + dt) % CYCLE
  if (cyc < prev) setShape((shapeKind + 1) % 4)
  let m = 0
  if (cyc >= 22 && cyc < 25.5) m = smooth((cyc - 22) / 3.5)
  else if (cyc >= 25.5 && cyc < 31) m = 1
  else if (cyc >= 31 && cyc < 34.5) m = 1 - smooth((cyc - 31) / 3.5)
  if (m === 1) { tg = 0; shapeYaw += dt * 0.55 } else tg += dt
  const cs = Math.cos(shapeYaw), ss = Math.sin(shapeYaw)

  // ---- kamera ----
  yawBase += dt * 0.045
  const wantYaw = pointer.on ? (pointer.nx - 0.5) * 1.15 : 0
  const wantPit = pointer.on ? (pointer.ny - 0.5) * 0.5 : 0
  const ease = Math.min(1, dt * 2.4)
  yawOff += (wantYaw - yawOff) * ease
  pitch += (0.42 + wantPit - pitch) * ease
  zoom += ((pointer.down ? 1 : 0) - zoom) * Math.min(1, dt * 3)
  camD = 2.75 + Math.sin(t * 0.13) * 0.16 - zoom * 0.45
  const yaw = yawBase + yawOff
  cyaw = Math.cos(yaw); syaw = Math.sin(yaw); cpit = Math.cos(pitch); spit = Math.sin(pitch)
  const focusD = camD + Math.sin(t * 0.21) * 0.38

  // ---- arka plan: bulutsu + kuyruk izi ----
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.42
  const ox = -yaw * 14, oy = -pitch * 8
  ctx.drawImage(fog, -20 + ox, -20 + oy, W + 40, H + 40)
  ctx.globalAlpha = 1

  // ---- fare ışığı ----
  ctx.globalCompositeOperation = 'lighter'
  if (pointer.on) {
    const hs = (pointer.down ? 520 : 340) * UNIT
    ctx.globalAlpha = pointer.down ? 0.5 : 0.28
    ctx.drawImage(halo, pointer.x - hs / 2, pointer.y - hs / 2, hs, hs)
    ctx.globalAlpha = 1
  }

  // ---- tıklama: 3B patlama ----
  if (lastClick) {
    explode(lastClick.x, lastClick.y, focusD)
    lastClick = null
  }

  // ---- parçacıklar ----
  const R2 = (200 * UNIT) * (200 * UNIT)
  const down = pointer.down
  const aspectBoost = UNIT
  for (let i = 0; i < N; i++) {
    // taban konumu
    const th = gth[i] + gw[i] * tg
    let gx = gr[i] * Math.cos(th)
    let gz = gr[i] * Math.sin(th)
    const gyy = gy[i] + Math.sin(t * 0.7 + ph[i]) * 0.006
    let x = gx, y = gyy, z = gz
    if (m > 0) {
      const e = smooth(m * 1.55 - dly[i] * 0.55)
      if (e > 0) {
        const tx = sx[i] * cs - sz[i] * ss
        const tz = sx[i] * ss + sz[i] * cs
        x = gx + (tx - gx) * e
        y = gyy + (sy[i] - gyy) * e
        z = gz + (tz - gz) * e
        // yolda hafif bir girdap: düz çizgide uçmasınlar
        const a = Math.sin(Math.PI * e) * 1.5
        const ca = Math.cos(a), sa = Math.sin(a)
        const rx = x * ca - z * sa
        z = x * sa + z * ca
        x = rx
      }
    }
    bx[i] = x; by[i] = y; bz[i] = z

    // yay + sönüm: sapma kendiliğinden yerine döner
    const ax = -2.1 * dx[i] - 1.25 * vx[i]
    const ay = -2.1 * dy[i] - 1.25 * vy[i]
    const az = -2.1 * dz[i] - 1.25 * vz[i]
    vx[i] += ax * dt; vy[i] += ay * dt; vz[i] += az * dt
    dx[i] += vx[i] * dt; dy[i] += vy[i] * dt; dz[i] += vz[i] * dt

    x += dx[i]; y += dy[i]; z += dz[i]

    // kameraya göre döndür
    const xr = x * cyaw - z * syaw
    const zr = x * syaw + z * cyaw
    const yr = y * cpit - zr * spit
    const zc = y * spit + zr * cpit
    const depth = camD - zc
    if (depth < 0.35) continue
    const f = FOCAL / depth
    const px = CX + xr * f
    const py = CY + yr * f

    // fare: ekran düzleminde it ya da çek, kuvvet 3B uzaya geri çevrilir
    if (pointer.on) {
      const mx = px - pointer.x, my = py - pointer.y
      const d2 = mx * mx + my * my
      if (d2 < R2 && d2 > 4) {
        const d = Math.sqrt(d2)
        const fall = 1 - d / (200 * UNIT)
        // ekran yönü (mx, my): fare uzaklaştırır, basılıyken içe çeker ve döndürür
        const ux = mx / d, uy = my / d
        const push = (down ? -9 : 5.5) * fall * fall * dt
        const spin = (down ? 5 : 1.6) * fall * dt
        const cxv = ux * push - uy * spin
        const cyv = uy * push + ux * spin
        const wy2 = cyv * cpit
        const zr2 = -cyv * spit
        vx[i] += cxv * cyaw + zr2 * syaw
        vy[i] += wy2
        vz[i] += -cxv * syaw + zr2 * cyaw
      }
    }

    if (px < -40 || px > W + 40 || py < -40 || py > H + 40) continue

    // alan derinliği: odak düzlemine uzak olan yumuşar, soluklaşır ve büyür
    const blur = Math.min(1, Math.abs(depth - focusD) / 1.35)
    const rel = camD / depth
    const tw = 0.82 + 0.18 * Math.sin(t * 2.3 + ph[i] * 3)
    let s = (5.5 + 8 * siz[i]) * rel * (1 + blur * 2.1) * aspectBoost
    // şekil halindeyken parçacıklar biraz küçülür: çizgiler netleşir
    if (m > 0.5) s *= 1 - 0.28 * (m - 0.5) * 2
    const a = bri[i] * tw * (0.95 - blur * 0.62) * Math.min(1, 0.35 + rel * 0.6)
    ctx.globalAlpha = a > 1 ? 1 : a
    ctx.drawImage(sprites[col[i]], px - s / 2, py - s / 2, s, s)
  }

  // ---- süpernova: ışık patlaması ve halkalar ----
  if (flash > 0) {
    const fs = Math.max(W, H) * (1.1 - flash * 0.3)
    ctx.globalAlpha = flash * 0.35
    ctx.drawImage(halo, CX - fs / 2, CY - fs / 2, fs, fs)
    flash = Math.max(0, flash - dt * 1.6)
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]
    w.age += dt
    if (w.age > 1.5) { waves.splice(i, 1); continue }
    const p = w.age / 1.5
    const r = (30 + p * 420) * UNIT
    ctx.globalAlpha = (1 - p) * 0.7
    ctx.strokeStyle = 'rgba(160, 200, 255, 1)'
    ctx.lineWidth = 3 * (1 - p) + 0.5
    ctx.beginPath()
    ctx.ellipse(w.x, w.y, r, r * (0.55 + 0.45 * (1 - pitch)), 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // ---- kalite ayarı: kareler yavaşsa parçacık azalır, rahatsa artar ----
  emaDt += (dt - emaDt) * 0.05
  tune += dt
  if (tune > 0.6) {
    tune = 0
    if (emaDt > 0.026 && N > MINN) N = Math.max(MINN, N - 160)
    else if (emaDt < 0.0185 && N < MAXN) N = Math.min(MAXN, N + 70)
  }
}
