import { useEffect, useRef } from 'react'
import type { PetKind } from './pet'
import { drawPet } from './petDraw'
import { drawSprite, whenReady } from './petSprites'

export const PET_NAMES: Record<PetKind, string> = { cat: 'Kedi', dog: 'Köpek' }

/** One still picture of a pet for the settings page: the same 3D frames the desktop pet is made of, standing at rest. */
export default function PetSprite({ kind }: { kind: PetKind }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(cv.clientWidth * dpr)
    cv.height = Math.round(cv.clientHeight * dpr)
    const draw = () => {
      if (!live) return
      const c = cv.getContext('2d')!
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
      const x = cv.clientWidth * 0.5
      const foot = cv.clientHeight * 0.96
      const size = cv.clientHeight * 0.8
      if (!drawSprite(c, kind, 'idle', 0, x, foot, size, 1)) drawPet(c, x, foot, size, 1, { kind, state: 'idle', time: 0.4, gait: 0 })
    }
    draw()
    whenReady(kind).then(draw)
    return () => {
      live = false
    }
  }, [kind])
  return <canvas ref={ref} className="pet-canvas" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
}
