// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useState } from 'react'
import brand from '@/brand'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { DockSettings } from '@/shared/types'
import { Card, Pages, Row, Select, Switch, Message, Update } from '../ui'

import { t } from '../../i18n'
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
      <Card icon="power" tab={t('Genel')} title={t('Başlangıç')}>
        <Row icon="globe" label={t('Dil')} hint={t('Uygulamanın dili. Değişince uygulama yeniden başlar.')}>
          <Select value={s.language} options={[['auto', t('Windows’u izle')], ['tr', 'Türkçe'], ['en', 'English']]} onChange={(language) => set({ language: language as DockSettings['language'] })} />
        </Row>
        <Row label={t('Windows ile başlat')} hint={info && !info.loginSupported ? t('Yalnızca kurulu sürümde çalışır (geliştirme çalıştırmasında kapalı)') : t('Bilgisayar açılınca dock kendiliğinden başlar')}>
          <Switch label={t('Windows ile başlat')} value={s.launchAtLogin} disabled={info ? !info.loginSupported : true} onChange={(launchAtLogin) => set({ launchAtLogin })} />
        </Row>
        <Row label={t('Dock’u göster / gizle kısayolu')} hint={t('Electron biçimi: Control+Alt+D')}>
          <input className="st-input" type="text" defaultValue={s.toggleHotkey} onBlur={(e) => e.target.value !== s.toggleHotkey && set({ toggleHotkey: e.target.value.trim() })} />
        </Row>
      </Card>
      <Card icon="download" tab={t('Genel')} title={t('Yedekle ve geri yükle')} hint={t('Ayarlar, öğeler ve widget’lar tek bir JSON dosyasında. Geri yükleyince uygulama yeniden başlar.')}>
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => backup(() => invoke('backup:export'))}><Icon name="upload" size={15} />{t('Yedekle')}</button>
          <button className="st-btn" onClick={() => backup(() => invoke('backup:import'))}><Icon name="download" size={15} />{t('Geri yükle')}</button>
        </div>
        {message && <Message text={message.text} error={message.error} />}
      </Card>
      <Card icon="heart" tab={t('Hakkında')} title={t('Hakkında')}>
        <p className="st-prose"><b>{info?.name}</b> {info?.version && `v${info.version}`}<br />{info?.tagline}<br />{t('Ücretsiz ve açık kaynak (GPLv3).')}<br />{t('Geliştiren:')} {brand.company} · © {brand.copyrightYear}{t('. Ad ve logo resmî sürüme aittir (NOTICE).')}</p>
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => invoke('app:open-external', 'repo')}><Icon name="code" size={15} />{t('Kaynak kodu')}</button>
          <button className="st-btn" onClick={() => invoke('app:open-external', 'issues')}><Icon name="bug" size={15} />{t('Sorun bildir')}</button>
          <button className="st-btn st-btn--danger" onClick={() => invoke('app:quit')}><Icon name="power" size={15} />{t('Çık')}</button>
        </div>
      </Card>
    </Pages>
  )
}
