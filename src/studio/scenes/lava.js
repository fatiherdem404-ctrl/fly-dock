// LAV — sıvı ışık
// Birbirine yaklaşınca erişen, birleşen ve ayrılan parlak damlalar (metaball). Her piksel damlaların toplam alanından
// boyanıyor: iç sıcak beyaz, kenar pembe-mor, dışarıda yumuşak bir ışıma. Fare büyük bir damla olup etrafı toplar,
// basılı tutunca damlaları emer ve büyür, tıklayınca damla küçük damlalara dağılıp yeniden birleşir.
//
//   init(ctx, view)             boyut her değiştiğinde çalışır; view = { width, height }
//   draw(ctx, t, dt, pointer)   her karede çalışır; t ve dt saniye
//   click(x, y)                 tıklayınca çalışır

const BLOBS = 13
let W = 0, H = 0, GW = 0, GH = 0, CELL = 6
let low = null, lowCtx = null, img = null
const bx = new Float32Array(BLOBS + 16), by = new Float32Array(BLOBS + 16), br = new Float32Array(BLOBS + 16)
const bvx = new Float32Array(BLOBS + 16), bvy = new Float32Array(BLOBS + 16), blife = new Float32Array(BLOBS + 16)
let extra = 0 // tıklamayla gelen geçici damlalar
let mr = 0 // fare damlasının yarıçapı
let hueShift = 0

function init(ctx, view) {
  W = view.width; H = view.height
  CELL = Math.max(3, Math.round(Math.min(W, H) / 170))
  GW = Math.ceil(W / CELL); GH = Math.ceil(H / CELL)
  low = document.createElement('canvas')
  low.width = GW; low.height = GH
  lowCtx = low.getContext('2d')
  img = lowCtx.createImageData(GW, GH)
  for (let i = 0; i < BLOBS; i++) {
    bx[i] = Math.random() * W; by[i] = Math.random() * H
    br[i] = (0.05 + Math.random() * 0.07) * Math.min(W, H)
    bvx[i] = (Math.random() - 0.5) * 40; bvy[i] = (Math.random() - 0.5) * 40
    blife[i] = 1e9
  }
  extra = 0
}

function click(x, y) {
  for (let k = 0; k < 7 && BLOBS + extra < BLOBS + 16; k++) {
    const i = BLOBS + extra++
    const a = Math.random() * 6.283, s = 140 + Math.random() * 220
    bx[i] = x; by[i] = y
    bvx[i] = Math.cos(a) * s; bvy[i] = Math.sin(a) * s
    br[i] = (0.025 + Math.random() * 0.03) * Math.min(W, H)
    blife[i] = 2.2 + Math.random() * 1.4
  }
}

function draw(ctx, t, dt, pointer) {
  hueShift += dt * 6
  const S = Math.min(W, H)
  // fare damlası
  mr += ((pointer.on ? (pointer.down ? 0.2 : 0.11) : 0) * S - mr) * Math.min(1, dt * 5)
  const total = BLOBS + extra

  // hareket: yavaş sürüklenme, duvarlardan yumuşak dönme, fareye çekim
  for (let i = 0; i < total; i++) {
    if (i < BLOBS) {
      bvx[i] += Math.sin(t * 0.4 + i * 1.7) * 14 * dt
      bvy[i] += Math.cos(t * 0.33 + i * 2.1) * 14 * dt
    }
    if (pointer.on && i < BLOBS) {
      const dx = pointer.x - bx[i], dy = pointer.y - by[i]
      const d = Math.sqrt(dx * dx + dy * dy) + 1
      const f = (pointer.down ? 520 : 70) * Math.min(1, 380 / d) * dt
      bvx[i] += (dx / d) * f
      bvy[i] += (dy / d) * f
    }
    // yer çekimi: geçici damlalar ana kümeye geri toplanır
    if (i >= BLOBS) {
      const j = (i * 5) % BLOBS
      bvx[i] += (bx[j] - bx[i]) * 0.9 * dt
      bvy[i] += (by[j] - by[i]) * 0.9 * dt
    }
    bvx[i] *= 1 - Math.min(1, dt * 0.8)
    bvy[i] *= 1 - Math.min(1, dt * 0.8)
    bx[i] += bvx[i] * dt
    by[i] += bvy[i] * dt
    if (bx[i] < 0) { bx[i] = 0; bvx[i] = Math.abs(bvx[i]) }
    if (bx[i] > W) { bx[i] = W; bvx[i] = -Math.abs(bvx[i]) }
    if (by[i] < 0) { by[i] = 0; bvy[i] = Math.abs(bvy[i]) }
    if (by[i] > H) { by[i] = H; bvy[i] = -Math.abs(bvy[i]) }
    if (i >= BLOBS) {
      blife[i] -= dt
      if (blife[i] < 0.5) br[i] *= 1 - dt * 3
    }
  }
  // süresi dolan geçici damlaları at
  for (let i = BLOBS; i < BLOBS + extra; ) {
    if (blife[i] <= 0 || br[i] < 2) {
      const last = BLOBS + extra - 1
      bx[i] = bx[last]; by[i] = by[last]; br[i] = br[last]; bvx[i] = bvx[last]; bvy[i] = bvy[last]; blife[i] = blife[last]
      extra--
    } else i++
  }

  // alan: her hücre için damlaların etkisini topla
  const data = img.data
  const n = BLOBS + extra
  const mx = pointer.x / CELL, my = pointer.y / CELL, mrc = mr / CELL
  let p = 0
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      let f = 0
      for (let i = 0; i < n; i++) {
        const dx = gx - bx[i] / CELL, dy = gy - by[i] / CELL
        const r = br[i] / CELL
        f += (r * r) / (dx * dx + dy * dy + 1)
      }
      if (mrc > 1) {
        const dx = gx - mx, dy = gy - my
        f += (mrc * mrc) / (dx * dx + dy * dy + 1)
      }
      // f >= 1 damlanın içi. Kenarda yumuşak geçiş, içeride sıcak bir renk skalası
      const inside = f < 0.8 ? 0 : f > 1.15 ? 1 : (f - 0.8) / 0.35
      const sm = inside * inside * (3 - 2 * inside)
      // dış ışıma
      const gl = f > 1 ? 1 : f * f * f * f
      let or = 10 + 130 * gl, og = 6 + 40 * gl, ob = 26 + 190 * gl
      // iç skala: mor -> pembe -> turuncu -> sıcak beyaz
      const k = f > 1 ? 1 - 1 / (f * f) : 0
      let ir, ig, ib
      if (k < 0.34) { const u = k / 0.34; ir = 150 + 105 * u; ig = 30 + 40 * u; ib = 210 - 70 * u }
      else if (k < 0.7) { const u = (k - 0.34) / 0.36; ir = 255; ig = 70 + 90 * u; ib = 140 - 70 * u }
      else { const u = (k - 0.7) / 0.3; ir = 255; ig = 160 + 90 * u; ib = 70 + 140 * u }
      // konuma göre yavaşça mavi tarafa kayan ikinci bir renk
      const sh = (Math.sin(hueShift * 0.02 + gx * 0.012 + gy * 0.009) + 1) * 0.5 * 0.5
      ir = ir * (1 - sh) + 70 * sh; ig = ig * (1 - sh) + 140 * sh * (1 - k * 0.6); ib = ib * (1 - sh * 0.2) + 255 * sh * 0.5
      const r = or * (1 - sm) + ir * sm, g = og * (1 - sm) + ig * sm, bl = ob * (1 - sm) + ib * sm
      const aa = 255
      data[p++] = r; data[p++] = g; data[p++] = bl; data[p++] = aa
    }
  }
  lowCtx.putImageData(img, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(low, 0, 0, GW * CELL, GH * CELL)
}
