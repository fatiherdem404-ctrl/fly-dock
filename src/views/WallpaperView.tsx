import { useEffect, useRef, useState } from 'react'
import { invoke, useActiveTheme, useEvent } from '@/api'
import { startLive, hueOf, makePointer, feedPointer, Pointer } from '@/live'
import type { DockSettings, WallpaperFit, WallpaperInfo, WallpaperSource } from '@/shared/types'

const FIT_CSS: Record<WallpaperFit, { size: string; repeat: string; object: string }> = {
  fill: { size: 'cover', repeat: 'no-repeat', object: 'cover' },
  fit: { size: 'contain', repeat: 'no-repeat', object: 'contain' },
  stretch: { size: '100% 100%', repeat: 'no-repeat', object: 'fill' },
  center: { size: 'auto', repeat: 'no-repeat', object: 'none' },
  tile: { size: 'auto', repeat: 'repeat', object: 'cover' },
}

function LiveLayer({ id, hue, paused, pointer }: { id: string; hue: number; paused: boolean; pointer: Pointer }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (paused || !canvas.current) return
    return startLive(canvas.current, id, hue, undefined, pointer)
  }, [id, hue, paused, pointer])
  return <canvas ref={canvas} className="wp__canvas" />
}

function VideoLayer({ url, fit, paused }: { url: string; fit: WallpaperFit; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = video.current
    if (!el) return
    if (paused) el.pause()
    else el.play().catch(() => {})
  }, [paused, url])
  return <video ref={video} className="wp__media" src={url} autoPlay loop muted playsInline style={{ objectFit: FIT_CSS[fit].object as 'cover' }} />
}

function Layer({ source, fit, hue, paused, visible, pointer }: { source: WallpaperSource; fit: WallpaperFit; hue: number; paused: boolean; visible: boolean; pointer: Pointer }) {
  const f = FIT_CSS[fit]
  return (
    <div className="wp__layer" style={{ opacity: visible ? 1 : 0 }}>
      {source.kind === 'live' && <LiveLayer id={source.live ?? 'aurora'} hue={hue} paused={paused} pointer={pointer} />}
      {source.kind === 'video' && source.url && <VideoLayer url={source.url} fit={fit} paused={paused} />}
      {source.kind === 'image' && source.url && <div className="wp__media" style={{ backgroundImage: `url("${source.url}")`, backgroundSize: f.size, backgroundRepeat: f.repeat, backgroundPosition: 'center' }} />}
    </div>
  )
}

interface Entry {
  key: number
  source: WallpaperSource
  visible: boolean
}

/**
 * The wallpaper window's content. A new picture, video or scene fades in over the old one (the slideshow's crossfade);
 * the old layer is removed once it is covered, and everything that animates stops while the wallpaper is paused.
 */
export default function WallpaperView() {
  const [info, setInfo] = useState<WallpaperInfo | null>(null)
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [layers, setLayers] = useState<Entry[]>([])
  const counter = useRef(0)
  const shown = useRef('')

  useEffect(() => {
    invoke('wallpaper:info').then(setInfo)
    invoke('settings:get').then(setSettings)
  }, [])
  useEvent('wallpaper:changed', setInfo)
  useEvent('settings:changed', setSettings)
  const pointer = useRef(makePointer()).current
  ;(window as unknown as { __wpPointer: Pointer }).__wpPointer = pointer
  useEvent('wallpaper:pointer', (p) => feedPointer(pointer, p.x, p.y, p.on))
  useActiveTheme(settings?.theme)

  const [hue, setHue] = useState(215)
  useEffect(() => {
    const read = () => setHue(hueOf(getComputedStyle(document.documentElement).getPropertyValue('--accent')))
    const timer = setTimeout(read, 300)
    return () => clearTimeout(timer)
  }, [settings?.theme])

  // the effect is keyed by the content, not by the info object (a new object arrives with every status push)
  const source = info?.source ?? null
  const key = source ? `${source.kind}|${source.url ?? ''}|${source.live ?? ''}` : ''
  useEffect(() => {
    if (key === shown.current) return
    shown.current = key
    if (!source) return void setLayers([])
    const id = ++counter.current
    setLayers((cur) => [...cur, { key: id, source, visible: false }])
    // let the new layer mount at opacity 0, then fade it in and drop what it covers
    const fade = setTimeout(() => setLayers((cur) => cur.map((l) => (l.key === id ? { ...l, visible: true } : l))), 60)
    const clean = setTimeout(() => setLayers((cur) => cur.filter((l) => l.key >= id)), 1500)
    return () => {
      clearTimeout(fade)
      clearTimeout(clean)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className="wp">
      {layers.map((l) => (
        <Layer key={l.key} source={l.source} fit={info?.fit ?? 'fill'} hue={hue} paused={info?.paused ?? false} visible={l.visible} pointer={pointer} />
      ))}
    </div>
  )
}
