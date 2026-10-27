import { useEffect, useState } from 'react'
import type { WidgetInstance } from '@/shared/types'

export default function ClockWidget({ options }: { options: WidgetInstance['options'] }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), options.seconds ? 1000 : 5000)
    return () => clearInterval(timer)
  }, [options.seconds])

  const time = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: options.seconds ? '2-digit' : undefined,
    hour12: !!options.hour12,
  })
  const date = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  return (
    <div className="widget__clock">
      <div className="widget__big">{time}</div>
      <div className="widget__muted">{date}</div>
    </div>
  )
}
