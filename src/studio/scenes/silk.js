// AKIŞ — ipek şeritler
// Binlerce parçacık görünmez bir akış alanını izliyor ve arkalarında ışıklı iplik gibi izler bırakıyor. Fare akışı
// bükünce şeritler kıvrılıyor, basılı tutunca fareye doğru bir girdap oluşuyor, tıklayınca bir kasırga doğup sönüyor.
//
//   init(ctx, view)             boyut her değiştiğinde çalışır; view = { width, height }
//   draw(ctx, t, dt, pointer)   her karede çalışır; t ve dt saniye
//   click(x, y)                 tıklayınca çalışır

const COUNT = 2600
const BUCKETS = 10
let W = 0, H = 0, SC = 1
const px = new Float32Array(COUNT), py = new Float32Array(COUNT)
const life = new Float32Array(COUNT), spd = new Float32Array(COUNT), hue = new Float32Array(COUNT)
let vortices = []
let started = false

function respawn(i, anywhere) {
  px[i] = Math.random() * W
  py[i] = anywhere ? Math.random() * H : (Math.random() < 0.5 ? -10 : H + 10)
  if (!anywhere) px[i] = Math.random() * W
  life[i] = 1.2 + Math.random() * 3
  spd[i] = 0.6 + Math.random() * 0.8
  hue[i] = Math.random()
}

function init(ctx, view) {
  W = view.width; H = view.height
  SC = Math.max(0.6, Math.min(1.8, H / 900))
  for (let i = 0; i < COUNT; i++) respawn(i, true)
  ctx.fillStyle = '#03050e'
  ctx.fillRect(0, 0, W, H)
  started = true
}

function click(x, y) {
  vortices.push({ x: x, y: y, age: 0, dir: Math.random() < 0.5 ? 1 : -1 })
  if (vortices.length > 4) vortices.shift()
}

function draw(ctx, t, dt, pointer) {
  // her karede önceki kareyi biraz söndür: iz böyle uzuyor
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(3, 5, 14, 0.055)'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineWidth = 1.6 * SC
  ctx.lineCap = 'round'

  const paths = []
  for (let b = 0; b < BUCKETS; b++) paths.push(new Path2D())

  for (let v = vortices.length - 1; v >= 0; v--) {
    vortices[v].age += dt
    if (vortices[v].age > 3.2) vortices.splice(v, 1)
  }

  for (let i = 0; i < COUNT; i++) {
    const x = px[i], y = py[i]
    // akış alanı: birkaç yavaş dalganın toplamı
    let a = Math.sin(x * 0.0042 / SC + t * 0.17) * 2.1 + Math.cos(y * 0.005 / SC - t * 0.13) * 2.1 + Math.sin((x + y) * 0.0024 / SC + t * 0.07 + hue[i] * 0.6) * 1.4
    let vx = Math.cos(a), vy = Math.sin(a)

    if (pointer.on) {
      const dx = x - pointer.x, dy = y - pointer.y
      const d2 = dx * dx + dy * dy
      const R = 230 * SC
      if (d2 < R * R) {
        const d = Math.sqrt(d2) + 0.001
        const f = 1 - d / R
        const k = f * f
        if (pointer.down) {
          // girdap: içe çek ve döndür
          vx += (-dx / d) * k * 2.2 + (-dy / d) * k * 3
          vy += (-dy / d) * k * 2.2 + (dx / d) * k * 3
        } else {
          // akış fareden kaçıp etrafından dolanır
          vx += (dx / d) * k * 1.8 + (-dy / d) * k * 1.2
          vy += (dy / d) * k * 1.8 + (dx / d) * k * 1.2
        }
      }
    }
    for (const q of vortices) {
      const dx = x - q.x, dy = y - q.y
      const d = Math.sqrt(dx * dx + dy * dy) + 1
      const f = Math.exp(-d / (260 * SC)) * Math.sin(Math.min(1, q.age / 0.4) * 1.57) * Math.max(0, 1 - q.age / 3.2)
      vx += (-dy / d) * f * 6 * q.dir + (dx / d) * f * 1.5
      vy += (dx / d) * f * 6 * q.dir + (dy / d) * f * 1.5
    }

    // küçük bir sapma: şeritler tek bir kanala çökmesin
    vx += Math.cos(i * 12.9898 + t * 0.4) * 0.35
    vy += Math.sin(i * 78.233 + t * 0.35) * 0.35
    const step = 95 * SC * spd[i] * dt
    const nx = x + vx * step, ny = y + vy * step
    // renk: yönle ve konumla kayan bir gökkuşağı, mavi-mor-pembe ağırlıklı
    const hh = (hue[i] * 0.35 + (Math.atan2(vy, vx) / 6.283 + 0.5) * 0.45 + t * 0.012) % 1
    const bucket = Math.min(BUCKETS - 1, (hh * BUCKETS) | 0)
    paths[bucket].moveTo(x, y)
    paths[bucket].lineTo(nx, ny)
    px[i] = nx; py[i] = ny
    life[i] -= dt
    if (life[i] <= 0 || nx < -30 || nx > W + 30 || ny < -30 || ny > H + 30) respawn(i, false)
  }

  for (let b = 0; b < BUCKETS; b++) {
    const h = 200 + (b / BUCKETS) * 160 // 200 mavi ... 360 pembe
    ctx.strokeStyle = 'hsla(' + h + ', 100%, 64%, 0.85)'
    ctx.stroke(paths[b])
  }

  // fare ışığı
  if (pointer.on) {
    const r = (pointer.down ? 170 : 110) * SC
    const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r)
    g.addColorStop(0, 'rgba(140, 170, 255, ' + (pointer.down ? 0.28 : 0.14) + ')')
    g.addColorStop(1, 'rgba(60, 80, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(pointer.x - r, pointer.y - r, r * 2, r * 2)
  }
  ctx.globalCompositeOperation = 'source-over'
}
