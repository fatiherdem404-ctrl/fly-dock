import { useEffect, useState } from 'react'

const DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

export default function CalendarWidget() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const year = now.getFullYear()
  const month = now.getMonth()
  const first = (new Date(year, month, 1).getDay() + 6) % 7 // Monday first
  const count = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]

  return (
    <div className="widget__calendar">
      <div className="widget__title">{now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
      <div className="widget__grid">
        {DAYS.map((d) => <span key={d} className="widget__dow">{d}</span>)}
        {cells.map((day, i) => (
          <span key={i} className={day === now.getDate() ? 'widget__today' : undefined}>{day ?? ''}</span>
        ))}
      </div>
    </div>
  )
}
