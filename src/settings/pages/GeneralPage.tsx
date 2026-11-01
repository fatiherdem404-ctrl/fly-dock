// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useState } from 'react'
import brand from '@/brand'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { DockSettings } from '@/shared/types'
import { Card, Pages, Row, Switch, Message, Update } from '../ui'

// ---- General ----

export function GeneralTab({ s, set }: { s: DockSettings; set: Update }) {
  const [info] = useRemote('app:info', [])
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const backup = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    const r = await fn()
    if (r.message !== 'cancelled') setMessage({ text: r.ok ? r.message : r.message, error: !r.ok })
  }
  return (
    <Pages id="general">
      <Card icon="power" tab="Genel" title="Başlangıç">
        <Row label="Windows ile başlat" hint={info && !info.loginSupported ? 'Yalnızca kurulu sürümde çalışır (geliştirme çalıştırmasında kapalı)' : 'Bilgisayar açılınca dock kendiliğinden başlar'}>
          <Switch label="Windows ile başlat" value={s.launchAtLogin} disabled={info ? !info.loginSupported : true} onChange={(launchAtLogin) => set({ launchAtLogin })} />
        </Row>
        <Row label="Dock’u göster / gizle kısayolu" hint="Electron biçimi: Control+Alt+D">
          <input className="st-input" type="text" defaultValue={s.toggleHotkey} onBlur={(e) => e.target.value !== s.toggleHotkey && set({ toggleHotkey: e.target.value.trim() })} />
        </Row>
      </Card>
      <Card icon="download" tab="Genel" title="Yedekle ve geri yükle" hint="Ayarlar, öğeler ve widget’lar tek bir JSON dosyasında. Geri yükleyince uygulama yeniden başlar.">
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => backup(() => invoke('backup:export'))}><Icon name="upload" size={15} />Yedekle</button>
          <button className="st-btn" onClick={() => backup(() => invoke('backup:import'))}><Icon name="download" size={15} />Geri yükle</button>
        </div>
        {message && <Message text={message.text} error={message.error} />}
      </Card>
      <Card icon="heart" tab="Hakkında" title="Hakkında">
        <p className="st-prose"><b>{info?.name}</b> {info?.version && `v${info.version}`}<br />{info?.tagline}<br />Ücretsiz ve açık kaynak (GPLv3).<br />Geliştiren: {brand.company} · © {brand.copyrightYear}. Ad ve logo resmî sürüme aittir (NOTICE).</p>
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => invoke('app:open-external', 'repo')}><Icon name="code" size={15} />Kaynak kodu</button>
          <button className="st-btn" onClick={() => invoke('app:open-external', 'issues')}><Icon name="bug" size={15} />Sorun bildir</button>
          <button className="st-btn st-btn--danger" onClick={() => invoke('app:quit')}><Icon name="power" size={15} />Çık</button>
        </div>
      </Card>
    </Pages>
  )
}
