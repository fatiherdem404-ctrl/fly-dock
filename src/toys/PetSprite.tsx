import { useEffect, useRef } from 'react'
import type { PetKind } from './pet'
import { drawPet } from './petDraw'

export const PET_NAMES: Record<PetKind, string> = { cat: 'Kedi', dog: 'Köpek', rabbit: 'Tavşan' }

/** One still picture of a pet for the settings page: the same drawing the desktop pet is made from, standing at rest. */
export default function PetSprite({ kind }: { kind: PetKind }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(cv.clientWidth * dpr)
    cv.height = Math.round(cv.clientHeight * dpr)
    const c = cv.getContext('2d')!
    c.scale(dpr, dpr)
    c.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
    drawPet(c, cv.clientWidth * 0.48, cv.clientHeight * 0.92, cv.clientHeight * 0.92, 1, { kind, state: 'idle', time: 0.4, gait: 0 })
  }, [kind])
  return <canvas ref={ref} className="pet-canvas" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
}
