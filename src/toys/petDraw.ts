// Draws the desktop pets (cat, dog) as animated side-view animals. Nothing here is a fixed picture: every frame the
// pose is worked out from the pet's state and an animation clock, each leg is a two-bone limb whose knee is solved from
// where the foot has to be, and the gait follows the distance the pet really walked so the feet never slide.
import type { PetKind, PetState } from './pet'

type V = [number, number]
const TAU = Math.PI * 2

interface Look {
  body: string
  shade: string
  belly: string
  inner: string
  nose: string
  mark: string
}
interface Dims {
  hip: V
  chest: V
  rHip: number
  rChest: number
  head: V
  rHead: number
  up: number
  low: number
  stride: number
  lift: number
}

const LOOKS: Record<PetKind, Look> = {
  cat: { body: '#f2a65a', shade: '#cf7f34', belly: '#fff0dc', inner: '#f7b6aa', nose: '#e5767f', mark: '#b86a26' },
  dog: { body: '#c99159', shade: '#98643a', belly: '#f1d9b5', inner: '#8c5a32', nose: '#2b2b2b', mark: '#7b4a28' },
}
const DIMS: Record<PetKind, Dims> = {
  cat: { hip: [-24, -33], chest: [14, -34], rHip: 12.5, rChest: 13.5, head: [34, -50], rHead: 12, up: 15, low: 16, stride: 9, lift: 6 },
  dog: { hip: [-28, -37], chest: [16, -39], rHip: 14, rChest: 16, head: [40, -57], rHead: 13, up: 17, low: 18, stride: 11, lift: 7 },
}

export interface PetPose {
  kind: PetKind
  state: PetState
  /** The animation clock in seconds: tail sway, breathing, blinking. */
  time: number
  /** Position in the walking cycle (0..1, wraps): advances with the distance the pet has walked. */
  gait: number
}

interface Skeleton {
  hip: V
  chest: V
  head: V
  headTilt: number
  tail: number
  /** Feet: hind far, hind near, front far, front near. */
  feet: [V, V, V, V]
  eyesShut: boolean
  /** Whole-animal rotation around the feet centre, radians. */
  lean: number
  /** Ears' sway or flop in radians. */
  ear: number
  mouthOpen: boolean
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]

/** Solves the knee of a two-bone leg from the hip joint to where the foot must be. */
function knee(joint: V, foot: V, l1: number, l2: number, forward: boolean): V {
  const dx = foot[0] - joint[0]
  const dy = foot[1] - joint[1]
  const dist = Math.max(Math.hypot(dx, dy), 0.001)
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01)
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const ux = dx / dist
  const uy = dy / dist
  const px = joint[0] + ux * a
  const py = joint[1] + uy * a
  const c1: V = [px - uy * h, py + ux * h]
  const c2: V = [px + uy * h, py - ux * h]
  return forward ? (c1[0] > c2[0] ? c1 : c2) : c1[0] < c2[0] ? c1 : c2
}

/** Where each foot is in a walking or running cycle: it slides back while on the ground, then swings forward in an arc. */
function footAt(base: V, phase: number, stride: number, lift: number): V {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.6) return [base[0] + stride * (1 - (p / 0.6) * 2), 0]
  const q = (p - 0.6) / 0.4
  return [base[0] + stride * (-1 + q * 2), -Math.sin(q * Math.PI) * lift]
}

function skeleton(kind: PetKind, state: PetState, time: number, gait: number): Skeleton {
  const D = DIMS[kind]
  const standFeet = (): [V, V, V, V] => [
    [D.hip[0] - 3, 0],
    [D.hip[0] + 4, 0],
    [D.chest[0] - 1, 0],
    [D.chest[0] + 6, 0],
  ]
  const sk: Skeleton = { hip: [...D.hip], chest: [...D.chest], head: [...D.head], headTilt: 0, tail: Math.sin(time * 2.2) * 0.25, feet: standFeet(), eyesShut: false, lean: 0, ear: Math.sin(time * 1.3) * 0.04, mouthOpen: false }
  const breathe = Math.sin(time * 2.4) * 0.6
  sk.chest[1] += breathe * 0.4
  sk.head[1] += breathe * 0.5

  switch (state) {
    case 'walk':
    case 'run':
    case 'carry': {
      const fast = state !== 'walk'
      const stride = D.stride * (fast ? 1.55 : 1)
      const lift = D.lift * (fast ? 1.5 : 1)
      const offsets = fast ? [0.03, 0, 0.5, 0.55] : [0.5, 0, 0.75, 0.25]
      sk.feet = [
        footAt([D.hip[0] - 2, 0], gait + offsets[0], stride, lift),
        footAt([D.hip[0] + 5, 0], gait + offsets[1], stride, lift),
        footAt([D.chest[0] - 1, 0], gait + offsets[2], stride, lift),
        footAt([D.chest[0] + 6, 0], gait + offsets[3], stride, lift),
      ]
      const bob = Math.sin(((gait * 2) % 1) * TAU) * (fast ? 2.4 : 1.1)
      sk.hip[1] += bob
      sk.chest[1] += bob * 0.8
      sk.head[1] += bob * 1.3 - (state === 'carry' ? 3 : 0)
      sk.head[0] += fast ? 2 : 0
      sk.lean = fast ? -0.05 : 0
      sk.tail = fast ? 0.9 + Math.sin(time * 14) * 0.15 : 0.3 + Math.sin(time * 3) * 0.2
      sk.ear = fast ? 0.3 : 0.05
      sk.mouthOpen = state === 'run' && kind === 'dog'
      break
    }
    case 'sit': {
      sk.hip = [D.hip[0] + 2, -D.rHip * 0.95]
      sk.chest = [D.chest[0] - 12, D.chest[1] - 12]
      sk.head = [D.head[0] - 12, D.head[1] - 14]
      sk.headTilt = -0.08
      sk.feet = [[D.hip[0] + 12, 0], [D.hip[0] + 19, 0], [sk.chest[0] + 1, 0], [sk.chest[0] + 8, 0]]
      sk.tail = -0.35 + Math.sin(time * 2) * 0.12
      break
    }
    case 'sleep': {
      // curled up in a loaf with the head resting on the front paws
      const r = DIMS[kind]
      sk.hip = [r.hip[0] + 2, -r.rHip * 0.9]
      sk.chest = [r.chest[0] - 6, -r.rChest * 0.88]
      sk.head = [r.head[0] - 8, -r.rHead * 0.85 + Math.sin(time * 1.8) * 0.5]
      sk.headTilt = 0.35
      sk.feet = [[sk.hip[0] + 9, 0], [sk.hip[0] + 15, 0], [sk.chest[0] + 12, 0], [sk.chest[0] + 18, 0]]
      sk.eyesShut = true
      sk.tail = -0.9
      sk.ear = -0.15
      break
    }
    case 'play': {
      // front low, hindquarters up and wiggling, a paw swatting at the toy
      sk.chest = [D.chest[0] + 10, -D.rChest * 1.15]
      sk.head = [D.head[0] + 8, -D.rHead * 1.1]
      sk.hip[1] -= 2
      const swat = Math.max(0, Math.sin(time * 9))
      sk.feet = [[D.hip[0] - 3, 0], [D.hip[0] + 4, 0], [sk.chest[0] + 8, 0], [sk.chest[0] + 18 + swat * 12, -swat * 14]]
      sk.tail = Math.sin(time * 12) * 0.6
      sk.lean = 0.04
      sk.ear = 0.1
      break
    }
    case 'happy': {
      sk.head[1] -= 3 + Math.abs(Math.sin(time * 8)) * 2
      sk.headTilt = Math.sin(time * 7) * 0.12
      sk.tail = Math.sin(time * 16) * 0.7 + 0.6
      sk.eyesShut = true
      sk.mouthOpen = true
      break
    }
    case 'held': {
      // hanging by the scruff: the body swings and the legs dangle
      const sway = Math.sin(time * 5)
      sk.lean = 1.15 + sway * 0.1
      sk.feet = [[D.hip[0] + 4 + sway * 3, -2], [D.hip[0] + 10 - sway * 3, -3], [D.chest[0] + 2 - sway * 3, -2], [D.chest[0] + 8 + sway * 3, -3]]
      sk.tail = 0.9 + sway * 0.3
      sk.ear = 0.35
      break
    }
    case 'fall': {
      sk.feet = [[D.hip[0] - 10, -8], [D.hip[0] - 4, -10], [D.chest[0] + 10, -10], [D.chest[0] + 16, -8]]
      sk.tail = 1.2
      sk.ear = 0.5
      sk.lean = -0.1
      break
    }
    default: {
      // standing around: a slow look about
      sk.headTilt = Math.sin(time * 0.9) * 0.08
      sk.head[0] += Math.sin(time * 0.7) * 1.2
    }
  }
  return sk
}

function limb(c: CanvasRenderingContext2D, a: V, b: V, width: number, color: string) {
  c.strokeStyle = color
  c.lineWidth = width
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(a[0], a[1])
  c.lineTo(b[0], b[1])
  c.stroke()
}

function leg(c: CanvasRenderingContext2D, joint: V, foot: V, D: Dims, look: Look, color: string, hind: boolean, thick: number) {
  const k = knee(joint, foot, D.up, D.low, hind)
  limb(c, joint, k, thick, color)
  limb(c, k, foot, thick * 0.72, color)
  c.fillStyle = color === look.shade ? look.shade : look.belly
  c.beginPath()
  c.ellipse(foot[0] + 2, foot[1] - 1.6, 5.6, 3.3, 0, 0, TAU)
  c.fill()
}

function capsule(c: CanvasRenderingContext2D, a: V, ra: number, b: V, rb: number) {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0])
  const up = th - Math.PI / 2
  const down = th + Math.PI / 2
  c.beginPath()
  c.moveTo(a[0] + ra * Math.cos(up), a[1] + ra * Math.sin(up))
  c.lineTo(b[0] + rb * Math.cos(up), b[1] + rb * Math.sin(up))
  c.arc(b[0], b[1], rb, up, down, false)
  c.lineTo(a[0] + ra * Math.cos(down), a[1] + ra * Math.sin(down))
  c.arc(a[0], a[1], ra, down, up + TAU, false)
  c.closePath()
}

function tail(c: CanvasRenderingContext2D, kind: PetKind, base: V, swing: number, look: Look) {
  c.save()
  c.translate(base[0], base[1])
  c.lineCap = 'round'
  if (kind === 'cat') {
    c.rotate(-0.5 + swing * 0.9)
    c.strokeStyle = look.body
    c.lineWidth = 6.2
    c.beginPath()
    c.moveTo(0, 0)
    c.bezierCurveTo(-16, 4, -26, -6, -24, -22)
    c.bezierCurveTo(-23, -30, -16, -33, -12, -29)
    c.stroke()
    c.strokeStyle = look.mark
    c.lineWidth = 6.4
    c.beginPath()
    c.moveTo(-23, -14)
    c.lineTo(-24, -20)
    c.moveTo(-21, -27)
    c.lineTo(-17, -31)
    c.stroke()
  } else {
    c.rotate(-0.9 + swing * 1.1)
    c.strokeStyle = look.shade
    c.lineWidth = 6.8
    c.beginPath()
    c.moveTo(0, 0)
    c.quadraticCurveTo(-12, -3, -18, -16)
    c.stroke()
  }
  c.restore()
}

function head(c: CanvasRenderingContext2D, kind: PetKind, sk: Skeleton, D: Dims, look: Look, time: number) {
  c.save()
  c.translate(sk.head[0], sk.head[1])
  c.rotate(sk.headTilt)
  const r = D.rHead
  const ear = sk.ear
  // ears behind the head
  if (kind === 'cat') {
    for (const side of [-1, 1]) {
      c.save()
      c.translate(side * r * 0.55, -r * 0.7)
      c.rotate(side * (0.25 + ear))
      c.fillStyle = look.body
      c.beginPath(); c.moveTo(-6, 2); c.lineTo(0, -15); c.lineTo(6, 2); c.closePath(); c.fill()
      c.fillStyle = look.inner
      c.beginPath(); c.moveTo(-3.2, 1); c.lineTo(0, -10); c.lineTo(3.2, 1); c.closePath(); c.fill()
      c.restore()
    }
  }
  // the head
  const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.2)
  g.addColorStop(0, look.body)
  g.addColorStop(1, look.shade)
  c.fillStyle = g
  c.strokeStyle = 'rgba(0,0,0,0.22)'
  c.lineWidth = 1
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke()
  if (kind === 'dog') {
    // floppy ear and a long muzzle
    c.save()
    c.translate(-r * 0.45, -r * 0.45)
    c.rotate(0.35 - ear * 1.4)
    c.fillStyle = look.inner
    c.strokeStyle = 'rgba(0,0,0,0.25)'
    c.beginPath(); c.ellipse(0, 7, 5.6, 11, 0, 0, TAU); c.fill(); c.stroke()
    c.restore()
    c.fillStyle = look.belly
    c.strokeStyle = 'rgba(0,0,0,0.2)'
    c.beginPath(); c.ellipse(r * 0.75, r * 0.22, r * 0.62, r * 0.45, 0.08, 0, TAU); c.fill(); c.stroke()
    c.fillStyle = look.nose
    c.beginPath(); c.ellipse(r * 1.25, r * 0.05, 3.2, 2.6, 0, 0, TAU); c.fill()
    if (sk.mouthOpen) {
      c.fillStyle = '#e8566e'
      c.beginPath(); c.ellipse(r * 0.95, r * 0.62, 4.5, 3, 0.2, 0, Math.PI); c.fill()
    }
  } else {
    c.fillStyle = look.belly
    c.beginPath(); c.ellipse(r * 0.55, r * 0.3, r * 0.5, r * 0.36, 0, 0, TAU); c.fill()
    c.fillStyle = look.nose
    c.beginPath(); c.ellipse(r * 0.92, r * 0.1, 2.3, 1.8, 0, 0, TAU); c.fill()
  }
  // an eye on the near side, with a blink every few seconds
  const blink = Math.abs((time % 4.2) - 4.1) < 0.07
  const ex = r * 0.42
  const ey = -r * 0.18
  if (sk.eyesShut || blink) {
    c.strokeStyle = '#23232b'
    c.lineWidth = 1.7
    c.lineCap = 'round'
    c.beginPath(); c.arc(ex, ey + 1, 3.1, Math.PI * 1.1, Math.PI * 1.9); c.stroke()
  } else {
    c.fillStyle = '#23232b'
    c.beginPath(); c.ellipse(ex, ey, 2.4, 3, 0, 0, TAU); c.fill()
    c.fillStyle = '#ffffff'
    c.beginPath(); c.arc(ex + 0.8, ey - 1, 0.9, 0, TAU); c.fill()
  }
  if (kind === 'cat') {
    c.strokeStyle = 'rgba(255,255,255,0.85)'
    c.lineWidth = 0.8
    c.beginPath()
    c.moveTo(r * 0.7, r * 0.15); c.lineTo(r * 1.6, r * 0.0)
    c.moveTo(r * 0.7, r * 0.3); c.lineTo(r * 1.55, r * 0.42)
    c.stroke()
    c.fillStyle = look.nose
    c.beginPath(); c.moveTo(r * 0.9, r * 0.02); c.lineTo(r * 1.1, r * 0.02); c.lineTo(r * 1.0, r * 0.14); c.closePath(); c.fill()
  }
  c.restore()
}

/** Draws the pet standing on (x, footY), facing the way dir says, `size` px tall. */
export function drawPet(c: CanvasRenderingContext2D, x: number, footY: number, size: number, dir: 1 | -1, pose: PetPose) {
  const D = DIMS[pose.kind]
  const look = LOOKS[pose.kind]
  const sk = skeleton(pose.kind, pose.state, pose.time, pose.gait)
  const u = size / 100
  c.save()
  c.translate(x, footY)
  c.scale(u * dir, u)
  // soft shadow on the ground
  c.fillStyle = 'rgba(0,0,0,0.2)'
  c.beginPath(); c.ellipse(-2, 1.5, 36, 4.5, 0, 0, TAU); c.fill()
  c.save()
  if (sk.lean) c.rotate(sk.lean)
  const hipJoint: V = add(sk.hip, [-1, sk.hip[1] < -D.rHip * 1.3 ? D.rHip * 0.55 : 0])
  const chestJoint: V = add(sk.chest, [1, D.rChest * 0.45])
  const hindThick = 8.4
  const frontThick = 6.6
  // far legs first, a shade darker, then the tail and the body
  leg(c, add(hipJoint, [2, 0]), sk.feet[0], D, look, look.shade, true, hindThick)
  leg(c, add(chestJoint, [-2, 0]), sk.feet[2], D, look, look.shade, false, frontThick)
  tail(c, pose.kind, add(sk.hip, [-D.rHip * 0.8, -D.rHip * 0.2]), sk.tail, look)
  const g = c.createLinearGradient(0, sk.hip[1] - D.rHip, 0, sk.hip[1] + D.rHip)
  g.addColorStop(0, look.body)
  g.addColorStop(1, look.shade)
  c.fillStyle = g
  c.strokeStyle = 'rgba(0,0,0,0.22)'
  c.lineWidth = 1
  capsule(c, sk.hip, D.rHip, sk.chest, D.rChest)
  c.fill()
  c.stroke()
  // lighter belly and the markings of each animal
  c.fillStyle = look.belly
  c.globalAlpha = 0.9
  capsule(c, add(sk.hip, [4, D.rHip * 0.45]), D.rHip * 0.5, add(sk.chest, [-2, D.rChest * 0.4]), D.rChest * 0.5)
  c.fill()
  c.globalAlpha = 1
  if (pose.kind === 'cat') {
    c.strokeStyle = look.mark
    c.lineWidth = 2.6
    c.lineCap = 'round'
    c.beginPath()
    for (const t of [0.2, 0.42, 0.64]) {
      const px = sk.hip[0] + (sk.chest[0] - sk.hip[0]) * t
      const py = sk.hip[1] + (sk.chest[1] - sk.hip[1]) * t
      c.moveTo(px, py - D.rHip * 0.95)
      c.lineTo(px + 1.5, py - D.rHip * 0.4)
    }
    c.stroke()
  } else if (pose.kind === 'dog') {
    c.fillStyle = look.mark
    c.globalAlpha = 0.55
    c.beginPath(); c.ellipse(sk.hip[0] + 8, sk.hip[1] - 4, 11, 8, 0.1, 0, TAU); c.fill()
    c.globalAlpha = 1
  }
  // near legs, then the head
  leg(c, add(hipJoint, [3, 0]), sk.feet[1], D, look, look.body, true, hindThick)
  leg(c, add(chestJoint, [-1, 0]), sk.feet[3], D, look, look.body, false, frontThick)
  head(c, pose.kind, sk, D, look, pose.time)
  c.restore()
  c.restore()
}

/** The name tag, hearts and sleeping Zs that float around the pet; drawn in screen space. */
export function drawPetExtras(c: CanvasRenderingContext2D, x: number, footY: number, size: number, state: PetState, time: number, name: string, showName: boolean) {
  c.save()
  c.textAlign = 'center'
  if (state === 'happy') {
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.9 + i / 3) % 1
      c.globalAlpha = Math.sin(t * Math.PI)
      c.fillStyle = '#ff5d8f'
      c.font = `${Math.round(size * 0.24)}px 'Segoe UI Emoji', sans-serif`
      c.fillText('♥', x + (i - 1) * size * 0.26, footY - size * 1.0 - t * size * 0.55)
    }
  }
  if (state === 'sleep') {
    for (let i = 0; i < 2; i++) {
      const t = (time * 0.45 + i / 2) % 1
      c.globalAlpha = Math.sin(t * Math.PI) * 0.9
      c.fillStyle = '#d6e6ff'
      c.font = `800 ${Math.round(size * (0.2 + t * 0.12))}px 'Segoe UI', sans-serif`
      c.fillText('z', x + size * 0.3 + t * size * 0.22, footY - size * 0.62 - t * size * 0.5)
    }
  }
  c.globalAlpha = 1
  if (showName && name) {
    c.font = "600 12px 'Segoe UI', system-ui, sans-serif"
    const w = c.measureText(name).width + 18
    const ty = footY - size * 1.12
    c.fillStyle = 'rgba(20,24,36,0.82)'
    c.beginPath()
    c.roundRect(x - w / 2, ty - 11, w, 22, 11)
    c.fill()
    c.fillStyle = '#ffffff'
    c.textBaseline = 'middle'
    c.fillText(name, x, ty)
  }
  c.restore()
}
