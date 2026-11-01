// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent } from '@/api'
import type { DockSettings, WidgetInstance } from '@/shared/types'
import { WidgetFrame } from '@/widgets/frame'
import Icon from '@/icons'

import { t } from '../i18n'
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
  return (
    <div className="wv">
      <WidgetFrame type={widget.type} options={widget.options} onOption={(key, value) => invoke('widgets:update', widget.id, { [key]: value })} />
      <button className="wv__close" aria-label={t('Widget\'ı kapat')} title={t('Widget\'ı kapat')} onClick={() => invoke('widgets:remove', widget.id)}><Icon name="cross" size={12} /></button>
    </div>
  )
}
