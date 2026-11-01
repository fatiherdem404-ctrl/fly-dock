// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect } from 'react'
import Icon from '@/icons'
import { initSound, previewSound, SOUND_THEMES } from '@/sound'
import { DockSettings, SOUND_GROUP_OF, SoundEvent, SoundGroup, SoundTheme } from '@/shared/types'
import { Frame } from '../previews'
import { Card, Cards, Pages, Row, Switch, Slider, Update } from '../ui'

import { t } from '../../i18n'
// ---- Sounds ----

export const SOUND_GROUPS: [SoundGroup, string, string][] = [
  ['hover', t('Üzerine gelince'), t('Fare bir simgenin üstünden geçerken küçük bir tık')],
  ['click', t('Tıklama'), t('Simgeye tıklayınca')],
  ['launch', t('Uygulama açılışı'), t('Kapalı bir program başlatılınca')],
  ['dock', 'Dock', t('Simge bırakma, silme ve otomatik gizlenen dock’un gelip gitmesi')],
  ['windows', t('Dock pencereleri'), t('Klasör, grup ve kontrol paneli penceresinin cin efektiyle açılıp kapanması')],
  ['menus', t('Menüler'), t('Sağ tık menüsünün açılması ve seçim')],
  ['trash', t('Çöp kutusu'), t('Dosya atma ve çöp kutusunu boşaltma')],
  ['dialogs', t('Onay pencereleri'), t('Soru, onay, vazgeçme ve uyarı sesleri')],
  ['ui', t('Ayarlar ve bildirimler'), t('Bu penceredeki anahtarlar ve bildirim sesi')],
]

export const SOUND_TESTS: [SoundEvent, string][] = [
  ['hover', t('Üzerine gelme')], ['click', t('Tıklama')], ['launch', t('Açılış')], ['drop', t('Bırakma')], ['remove', t('Silme (puf)')], ['dockShow', t('Dock gelir')], ['dockHide', t('Dock gider')],
  ['windowOpen', t('Pencere açılır (cin)')], ['windowClose', t('Pencere kapanır (cin)')], ['menuOpen', t('Menü açılır')], ['menuPick', t('Menü seçimi')],
  ['trashDrop', t('Çöpe atma')], ['trashEmpty', t('Çöp boşaltma')], ['confirmOpen', t('Soru')], ['accept', t('Onay')], ['cancel', t('Vazgeç')], ['warn', t('Uyarı')], ['error', t('Hata')], ['toggle', t('Anahtar')], ['notify', t('Bildirim')],
]

export function SoundTab({ s, set }: { s: DockSettings; set: Update }) {
  useEffect(() => initSound(), [])
  const toggleGroup = (g: SoundGroup, on: boolean) => set({ soundGroups: on ? [...s.soundGroups, g] : s.soundGroups.filter((x) => x !== g) })
  return (
    <Pages id="sound">
      <Card icon="sound" tab={t('Sesler')} title={t('Genel')} hint={t('Sesler uygulamanın kendi içinde üretilir; ses dosyası gerekmez. Windows’un genel sesine ve ses karıştırıcısına bağlıdır.')}>
        <Row icon="power" label={t('Sesleri aç')}><Switch label={t('Sesleri aç')} value={s.soundEnabled} onChange={(soundEnabled) => set({ soundEnabled })} /></Row>
        <Row icon="sound" label={t('Ses düzeyi')}><Slider value={s.soundVolume} min={0} max={100} unit="%" onChange={(soundVolume) => set({ soundVolume })} /></Row>
        <Row icon="motion" label={t('Ses stili')} hint={t('Aynı olaylar, farklı bir karakterle çalar. Karta tıklayınca duyarsın.')} />
        <Cards<SoundTheme> size="s" value={s.soundTheme} onChange={(soundTheme) => { set({ soundTheme }); previewSound('click', soundTheme, s.soundVolume) }} options={(Object.keys(SOUND_THEMES) as SoundTheme[]).map((id) => ({ id, label: SOUND_THEMES[id].label, preview: <Frame><svg viewBox="0 0 100 60" className="pv-svg" aria-hidden="true"><path d="M6 30H94" className="pv-svg__axis" /><path d={wavePath(id)} className="pv-svg__line" /></svg></Frame> }))} />
      </Card>
      <Card icon="list" tab={t('Sesler')} title={t('Hangi olaylarda ses çalsın')}>
        {SOUND_GROUPS.map(([group, label, hint]) => (
          <Row key={group} label={label} hint={hint}><Switch label={label} value={s.soundGroups.includes(group)} onChange={(on) => toggleGroup(group, on)} /></Row>
        ))}
      </Card>
      <Card icon="play" tab={t('Dene')} title={t('Sesleri dene')} hint={t('Her ses seçili stille ve düzeyle çalar; olay kapalı olsa bile buradan dinleyebilirsin.')}>
        <div className="st-row-inline" style={{ flexWrap: 'wrap' }}>
          {SOUND_TESTS.map(([event, label]) => (
            <button key={event} className="st-btn" title={SOUND_GROUPS.find(([g]) => g === SOUND_GROUP_OF[event])?.[1]} onClick={() => previewSound(event, s.soundTheme, s.soundVolume)}><Icon name="play" size={13} />{label}</button>
          ))}
        </div>
      </Card>
    </Pages>
  )
}

/** A little picture of each sound style's wave: soft = sine, wood = triangle, retro = square, the others sine with an overtone. */
function wavePath(theme: SoundTheme): string {
  const shape = theme === 'wood' ? 'triangle' : theme === 'retro' ? 'square' : 'sine'
  const cycles = theme === 'glass' ? 5 : theme === 'bubble' ? 4 : 3
  const pts: string[] = []
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * cycles
    const frac = t - Math.floor(t)
    const y = shape === 'sine' ? Math.sin(t * 2 * Math.PI) + (theme === 'glass' ? 0.35 * Math.sin(t * 2 * Math.PI * 2.76) : 0) : shape === 'triangle' ? 1 - 4 * Math.abs(frac - 0.5) : frac < 0.5 ? 1 : -1
    pts.push(`${i === 0 ? 'M' : 'L'}${(6 + (i / 120) * 88).toFixed(1)} ${(30 - y * 16).toFixed(1)}`)
  }
  return pts.join(' ')
}
