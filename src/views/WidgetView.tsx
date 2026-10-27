import { useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent } from '@/api'
import type { DockSettings, WidgetInstance } from '@/shared/types'
import ClockWidget from '@/widgets/ClockWidget'
import WeatherWidget from '@/widgets/WeatherWidget'
import SystemWidget from '@/widgets/SystemWidget'
import MediaWidget from '@/widgets/MediaWidget'
import CalendarWidget from '@/widgets/CalendarWidget'

export default function WidgetView({ widgetId }: { widgetId: string }) {
  const [widget, setWidget] = useState<WidgetInstance | null>(null)
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const load = (list: WidgetInstance[]) => setWidget(list.find((w) => w.id === widgetId) ?? null)
  useEffect(() => {
    invoke('widgets:list').then(load)
    invoke('settings:get').then(setSettings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId])
  useEvent('widgets:changed', load)
  useEvent('settings:changed', setSettings)
  useActiveTheme(settings?.theme)

  if (!widget) return null
  const body = (() => {
    switch (widget.type) {
      case 'clock': return <ClockWidget options={widget.options} />
      case 'weather': return <WeatherWidget options={widget.options} />
      case 'system': return <SystemWidget />
      case 'media': return <MediaWidget />
      case 'calendar': return <CalendarWidget />
    }
  })()
  return <div className="widget">{body}</div>
}
