import { useEffect, useState } from 'react'
import { invoke } from '@/api'

export default function MediaWidget() {
  const [playing, setPlaying] = useState<{ app: string; title: string } | null>(null)
  useEffect(() => {
    const load = () => invoke('widgets:now-playing').then(setPlaying)
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="widget__media">
      <div className="widget__track">
        <div className="widget__big widget__ellipsis">{playing?.title || (playing ? playing.app : 'Çalan bir şey yok')}</div>
        <div className="widget__muted">{playing ? playing.app : 'Spotify, VLC ve benzeri oynatıcılar'}</div>
      </div>
      <div className="widget__buttons">
        <button onClick={() => invoke('widgets:media', 'prev')} aria-label="Önceki">⏮</button>
        <button onClick={() => invoke('widgets:media', 'playpause')} aria-label="Oynat / duraklat">⏯</button>
        <button onClick={() => invoke('widgets:media', 'next')} aria-label="Sonraki">⏭</button>
      </div>
    </div>
  )
}
