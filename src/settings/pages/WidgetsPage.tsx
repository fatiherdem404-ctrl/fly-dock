import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { WidgetType } from '@/shared/types'
import { Card } from '../ui'

export const WIDGET_NAMES: Record<WidgetType, string> = { clock: 'Saat', weather: 'Hava durumu', system: 'CPU / RAM / Disk', media: 'Medya', calendar: 'Takvim' }

export function WidgetsTab() {
  const [widgets, setWidgets] = useRemote('widgets:list', [], 'widgets:changed', (p) => p)
  return (
    <Card icon="widgets" title="Widget'lar" hint="Masaüstünde serbest pencereler olarak durur; sürükleyerek yerini değiştirebilirsin.">
      <div className="st-row-inline">
        {(Object.keys(WIDGET_NAMES) as WidgetType[]).map((type) => (
          <button key={type} className="st-btn" onClick={() => invoke('widgets:add', type).then(setWidgets)}><Icon name="plus" size={14} />{WIDGET_NAMES[type]}</button>
        ))}
      </div>
      <div className="st-list">
        {(widgets ?? []).map((w) => (
          <div className="st-list__row st-list__row--widget" key={w.id}>
            <b>{WIDGET_NAMES[w.type]}</b>
            {w.type === 'weather' ? (
              <input className="st-input" type="text" placeholder="Şehir" defaultValue={String(w.options.city ?? '')} onBlur={(e) => invoke('widgets:update', w.id, { city: e.target.value.trim() || 'Istanbul' }).then(setWidgets)} />
            ) : w.type === 'clock' ? (
              <label className="st-check"><input type="checkbox" checked={!!w.options.seconds} onChange={(e) => invoke('widgets:update', w.id, { seconds: e.target.checked }).then(setWidgets)} /> Saniye göster</label>
            ) : <span />}
            <button className="st-btn st-btn--danger" onClick={() => invoke('widgets:remove', w.id).then(setWidgets)}><Icon name="trash" size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  )
}
