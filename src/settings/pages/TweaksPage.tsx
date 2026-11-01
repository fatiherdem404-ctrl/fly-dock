// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useState } from 'react'
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { TweakInfo } from '@/shared/types'
import { Card, Pages, Row, Switch, Message } from '../ui'

export const EFFECT_NOTE: Record<TweakInfo['effect'], string> = { none: '', explorer: "Gezgin’i yeniden başlatınca görünür", signout: 'Oturumu kapatıp açınca görünür' }

export function TweaksTab() {
  const [tweaks, setTweaks] = useRemote('tweaks:list', [])
  const [log] = useRemote('tweaks:log', [])
  const [notice, setNotice] = useState<string | null>(null)
  const refresh = () => invoke('tweaks:list').then(setTweaks)
  const toggle = async (t: TweakInfo, enabled: boolean) => {
    const r = await invoke('tweaks:set', t.id, enabled)
    setNotice(r.ok ? (t.effect === 'none' ? null : EFFECT_NOTE[t.effect]) : `Uygulanamadı: ${r.message}`)
    refresh()
  }
  const categories = [...new Set((tweaks ?? []).map((t) => t.category))]
  const nameOf = (id: string) => tweaks?.find((t) => t.id === id)?.name ?? id
  return (
    <Pages id="tweaks">
      <Card icon="tools" tab="Ayarlar" title="Güvenli ayarlar" hint="Çoğu ayar yalnızca kullanıcı kayıt defterinde (HKCU) değişir. Değiştirmeden önce eski değer saklanır; kapatınca tam o değer geri gelir.">
        <Message text="Yönetici yetkisi isteyen ayarlar yönetici onayı ister (Windows’un kendi onay penceresi açılır); uygulamanın kendisi hiçbir zaman yönetici olarak çalışmaz. Hizmetleri (SysMain, telemetri, Windows Search) kapatan ayarlar henüz yok. Defender, Windows Update, güvenlik duvarı ve kullanıcı hesaplarına hiç dokunulmaz." />
        {categories.map((category) => (
          <div key={category}>
            <h4 className="st-subtitle">{category}</h4>
            {(tweaks ?? []).filter((t) => t.category === category).map((t) => (
              <Row key={t.id} label={t.admin ? `${t.name} · yönetici` : t.name} hint={`${t.description}${t.effect !== 'none' ? ' · ' + EFFECT_NOTE[t.effect] : ''}`}>
                <Switch label={t.name} value={t.enabled} onChange={(on) => toggle(t, on)} />
              </Row>
            ))}
          </div>
        ))}
        {notice && <Message text={notice} />}
        <div className="st-row-inline">
          <button className="st-btn" onClick={() => invoke('tweaks:restore-point').then((r) => setNotice(r.ok ? 'Geri yükleme noktası oluşturuldu.' : r.message === 'cancelled' ? 'Onay verilmedi, nokta oluşturulmadı.' : `Oluşturulamadı: ${r.message} (Sistem Geri Yükleme kapalı olabilir, Windows günde yalnızca bir noktaya izin verir)`))}><Icon name="lock" size={15} />Geri yükleme noktası oluştur</button>
          <button className="st-btn" onClick={() => invoke('tweaks:restart-explorer')}><Icon name="refresh" size={15} />Gezgin’i yeniden başlat</button>
          <button className="st-btn st-btn--danger" onClick={() => invoke('tweaks:revert-all').then(refresh)}><Icon name="refresh" size={15} />Hepsini eski haline döndür</button>
        </div>
      </Card>
      {(log ?? []).length > 0 && (
        <Card icon="list" tab="Ayarlar" title="Değişiklik kaydı">
          <div className="st-log">
            {[...(log ?? [])].reverse().slice(0, 12).map((l, i) => (
              <div key={i}>{new Date(l.at).toLocaleString('tr-TR')} — {nameOf(l.id)}: {l.action === 'apply' ? 'açıldı' : 'geri alındı'}</div>
            ))}
          </div>
        </Card>
      )}
    </Pages>
  )
}
