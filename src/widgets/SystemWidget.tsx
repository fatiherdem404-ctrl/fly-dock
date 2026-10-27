import { useEffect, useState } from 'react'
import { invoke } from '@/api'

type Stats = { cpu: number; ram: number; disk: number; diskLabel: string }

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="widget__row">
      <span>{label}</span>
      <div className="widget__bar"><div style={{ width: `${value}%` }} /></div>
      <span className="widget__value">{value}%</span>
    </div>
  )
}

export default function SystemWidget() {
  const [stats, setStats] = useState<Stats>({ cpu: 0, ram: 0, disk: 0, diskLabel: 'C:' })
  useEffect(() => {
    const load = () => invoke('widgets:system').then(setStats)
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="widget__system">
      <Row label="CPU" value={stats.cpu} />
      <Row label="RAM" value={stats.ram} />
      <Row label={stats.diskLabel} value={stats.disk} />
    </div>
  )
}
