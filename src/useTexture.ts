import { useEffect, useState } from 'react'
import { invoke } from '@/api'

export interface Texture {
  url: string
  /** Natural size of the image in px. */
  w: number
  h: number
}

const cache = new Map<string, Promise<Texture | null>>()

function load(file: string): Promise<Texture | null> {
  let hit = cache.get(file)
  if (!hit) {
    hit = invoke('texture:get', file).then(
      (url) =>
        !url
          ? null
          : new Promise<Texture | null>((resolve) => {
              const img = new Image()
              img.onload = () => resolve({ url, w: img.naturalWidth, h: img.naturalHeight })
              img.onerror = () => resolve(null)
              img.src = url
            }),
    )
    cache.set(file, hit)
  }
  return hit
}

export function forgetTexture(file: string) {
  cache.delete(file)
}

/** The custom desk texture named in the settings, once it has loaded. */
export function useTexture(file: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)
  useEffect(() => {
    let live = true
    if (!file) setTexture(null)
    else load(file).then((t) => live && setTexture(t))
    return () => {
      live = false
    }
  }, [file])
  return texture
}
