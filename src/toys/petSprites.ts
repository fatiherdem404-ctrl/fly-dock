// The pets as rendered 3D sprite sheets (made in Blender by tools/pets/pets.py): one PNG per animal and animation, with
// the frames side by side. This file picks the frame for a pet's state and draws it standing on the floor.
import meta from '@/assets/toys/pets/pets.json'
import type { PetKind, PetState } from './pet'

const urls = import.meta.glob('@/assets/toys/pets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

interface Sheet {
  img: HTMLImageElement
  frames: number
}
const sheets = new Map<string, Sheet>()
const metaOf = meta as Record<string, { cell: number; footY: number; centreX: number; anims: Record<string, number> }>

/** Which animation plays in which state: a pet that stands still, walks, runs, or lies down. */
const ANIM: Record<PetState, string> = {
  idle: 'idle', walk: 'walk', run: 'run', sit: 'sit', sleep: 'sleep', held: 'held', fall: 'fall', happy: 'happy', play: 'play', carry: 'carry',
}
/** Animations whose frames follow the distance walked instead of the clock, so the feet never slide. */
const BY_DISTANCE = new Set(['walk', 'run', 'carry'])

function sheetFor(kind: PetKind, state: PetState): Sheet | null {
  const anim = ANIM[state]
  const key = `${kind}-${anim}`
  let sheet = sheets.get(key)
  if (!sheet) {
    const frames = metaOf[kind]?.anims[anim]
    const url = Object.entries(urls).find(([path]) => path.endsWith(`/${key}.png`))?.[1]
    if (!frames || !url) return null
    const img = new Image()
    img.src = url
    sheet = { img, frames }
    sheets.set(key, sheet)
  }
  return sheet.img.complete && sheet.img.naturalWidth > 0 ? sheet : null
}

/** Loads every animation of a pet in the background so the first step it takes is not missing a picture. */
export function preloadPet(kind: PetKind) {
  for (const state of Object.keys(ANIM) as PetState[]) sheetFor(kind, state)
}

/** Resolves once the first picture of the pet (standing) can be drawn. */
export function whenReady(kind: PetKind): Promise<void> {
  const state: PetState = 'idle'
  sheetFor(kind, state)
  const sheet = sheets.get(`${kind}-${ANIM[state]}`)
  if (!sheet || sheet.img.complete) return Promise.resolve()
  return new Promise((resolve) => {
    sheet.img.addEventListener('load', () => resolve(), { once: true })
    sheet.img.addEventListener('error', () => resolve(), { once: true })
  })
}

export function frameFor(kind: PetKind, state: PetState, time: number, gait: number): number {
  const anim = ANIM[state]
  const frames = metaOf[kind]?.anims[anim] ?? 1
  if (BY_DISTANCE.has(anim)) return Math.floor((((gait % 1) + 1) % 1) * frames) % frames
  return Math.floor(time * 10) % frames
}

/** Draws one frame so the animal's feet touch (x, footY). Returns false when its pictures are not loaded yet. */
export function drawSprite(c: CanvasRenderingContext2D, kind: PetKind, state: PetState, frame: number, x: number, footY: number, size: number, dir: 1 | -1): boolean {
  const sheet = sheetFor(kind, state)
  const m = metaOf[kind]
  if (!sheet || !m) return false
  const cell = m.cell
  // the animal fills about two thirds of its picture, so the picture is drawn a good deal larger than "size"
  const draw = size / 0.68
  c.save()
  c.translate(x, footY)
  c.scale(dir, 1)
  c.imageSmoothingEnabled = true
  c.imageSmoothingQuality = 'high'
  c.drawImage(sheet.img, (frame % sheet.frames) * cell, 0, cell, cell, -draw * m.centreX, -draw * m.footY, draw, draw)
  c.restore()
  return true
}
