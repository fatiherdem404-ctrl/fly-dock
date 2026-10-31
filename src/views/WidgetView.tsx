import { useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent } from '@/api'
import type { DockSettings, WidgetInstance } from '@/shared/types'
import { WidgetFrame } from '@/widgets/frame'

/** One desktop widget window: the widget's card, painted with the active theme. */
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
  return <WidgetFrame type={widget.type} options={widget.options} onOption={(key, value) => invoke('widgets:update', widget.id, { [key]: value })} />
}
