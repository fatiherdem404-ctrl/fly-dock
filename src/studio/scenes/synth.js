// SYNTH — neon ufuk
// 80'lerin gün batımı: çizgili güneş, katmanlı dağlar, size doğru akan perspektifli neon zemin ve parlayan yıldızlar.
// Fare ufku ve bakış açısını kaydırır (dağlar farklı hızlarda, parallax), basılı tutunca zemin hızlanır,
// tıklayınca zeminden güneşe doğru bir ışık dalgası geçer.
//
//   init(ctx, view)             boyut her değiştiğinde çalışır; view = { width, height }
//   draw(ctx, t, dt, pointer)   her karede çalışır; t ve dt saniye
//   click(x, y)                 tıklayınca çalışır

let W = 0, H = 0
let sky = null
let stars = []
let scroll = 0, speed = 1, look = 0, tilt = 0
let pulses = []

function init(ctx, view) {
  W = view.width; H = view.height
  sky = document.createElement('canvas')
  sky.width = 4
  sky.height = Math.max(2, Math.round(H))
  const g = sky.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, '#0a0221')
  gr.addColorStop(0.45, '#2b0a54')
  gr.addColorStop(0.72, '#8a1f78')
  gr.addColorStop(0.9, '#ff5a8a')
  gr.addColorStop(1, '#ffb36b')
  g.fillStyle = gr
  g.fillRect(0, 0, 4, H)
  stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.5, s: 0.5 + Math.random() * 1.4, p: Math.random() * 6.28 }))
}

function click(x, y) {
  pulses.push({ z: 0 })
  if (pulses.length > 3) pulses.shift()
}

function mountains(ctx, hy, seed, amp, shift, fill, edge) {
  ctx.beginPath()
  ctx.moveTo(0, hy)
  const step = Math.max(6, W / 160)
  for (let x = 0; x <= W + step; x += step) {
    const u = x + shift
    const y = hy - amp * (0.55 * Math.abs(Math.sin(u * 0.0031 + seed)) + 0.3 * Math.abs(Math.sin(u * 0.0079 + seed * 2.3)) + 0.15 * Math.sin(u * 0.019 + seed))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, hy)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function draw(ctx, t, dt, pointer) {
  const nx = pointer.on ? pointer.nx : 0.5, ny = pointer.on ? pointer.ny : 0.5
  look += ((nx - 0.5) - look) * Math.min(1, dt * 2.5)
  tilt += ((ny - 0.5) - tilt) * Math.min(1, dt * 2.5)
  speed += ((pointer.down ? 4.2 : 1) - speed) * Math.min(1, dt * 2.2)
  scroll = (scroll + dt * 0.55 * speed) % 1

  const hy = H * (0.56 + tilt * 0.1)
  const vx = W / 2 - look * W * 0.35 // kaçış noktası

  // gökyüzü
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.drawImage(sky, 0, 0, W, H)

  // yıldızlar
  for (const s of stars) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + s.p))
    ctx.globalAlpha = a * (1 - s.y * 1.3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(s.x * W - look * 18 * s.s, s.y * hy, s.s, s.s)
  }
  ctx.globalAlpha = 1

  // güneş: çizgili, ufka batıyor
  const R = Math.min(W, H) * 0.24
  const sxp = vx, syp = hy - R * 0.5
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, hy)
  ctx.clip()
  const sg = ctx.createLinearGradient(0, syp - R, 0, syp + R)
  sg.addColorStop(0, '#fff3a6')
  sg.addColorStop(0.5, '#ff9a5c')
  sg.addColorStop(1, '#ff2f8a')
  ctx.shadowColor = '#ff4fa3'
  ctx.shadowBlur = R * 0.9
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.arc(sxp, syp, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  // dilimler: alta doğru kalınlaşan kesikler, yavaşça aşağı kayıyor
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  for (let i = 0; i < 9; i++) {
    const f = ((i + scroll * 0.5) % 9) / 9
    const y = syp + R * (-0.15 + f * 1.15)
    const h = R * (0.015 + f * 0.085)
    ctx.fillStyle = 'rgba(0,0,0,1)'
    if (y > syp - R * 0.1) ctx.fillRect(sxp - R - 4, y, R * 2 + 8, h)
  }
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'

  // dağlar: uzak olan yavaş, yakın olan hızlı kayar
  mountains(ctx, hy, 1.7, H * 0.16, look * 160, '#1b0a3d', 'rgba(255, 90, 200, 0.55)')
  mountains(ctx, hy, 4.2, H * 0.1, look * 320, '#12062a', 'rgba(90, 220, 255, 0.55)')

  // zemin
  const fg = ctx.createLinearGradient(0, hy, 0, H)
  fg.addColorStop(0, '#16062f')
  fg.addColorStop(1, '#05010f')
  ctx.fillStyle = fg
  ctx.fillRect(0, hy, W, H - hy)

  ctx.lineCap = 'round'
  // boylamsal çizgiler: kaçış noktasından açılır
  ctx.strokeStyle = 'rgba(255, 70, 200, 0.85)'
  ctx.lineWidth = 1.6
  ctx.shadowColor = '#ff2fd0'
  ctx.shadowBlur = 10
  ctx.beginPath()
  for (let j = -24; j <= 24; j++) {
    ctx.moveTo(vx + j * W * 0.006, hy)
    ctx.lineTo(vx + j * W * 0.12 - look * W * 0.3, H)
  }
  ctx.stroke()
  // enlemsel çizgiler: yaklaştıkça seyrekleşir ve kalınlaşır
  ctx.strokeStyle = 'rgba(80, 230, 255, 0.9)'
  ctx.shadowColor = '#34d8ff'
  for (let i = 0; i < 22; i++) {
    const z = (i + scroll) / 22
    const y = hy + (H - hy) * Math.pow(z, 2.3)
    ctx.globalAlpha = Math.min(1, z * 2.5)
    ctx.lineWidth = 0.6 + z * 2.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // ufuk parıltısı
  const hg = ctx.createLinearGradient(0, hy - 30, 0, hy + 30)
  hg.addColorStop(0, 'rgba(255, 120, 200, 0)')
  hg.addColorStop(0.5, 'rgba(255, 150, 210, 0.55)')
  hg.addColorStop(1, 'rgba(255, 120, 200, 0)')
  ctx.fillStyle = hg
  ctx.fillRect(0, hy - 30, W, 60)

  // tıklama dalgası: ekrandan ufka doğru akan parlak çizgi
  ctx.globalCompositeOperation = 'lighter'
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i]
    p.z += dt * 0.7
    if (p.z > 1.05) { pulses.splice(i, 1); continue }
    const z = 1 - p.z
    const y = hy + (H - hy) * Math.pow(z, 2.3)
    ctx.globalAlpha = Math.min(1, z * 2) * 0.9
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2 + z * 5
    ctx.shadowColor = '#7fffee'
    ctx.shadowBlur = 24
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
