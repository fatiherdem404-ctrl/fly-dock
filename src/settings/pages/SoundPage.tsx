import { useEffect } from 'react'
import Icon from '@/icons'
import { initSound, previewSound, SOUND_THEMES } from '@/sound'
import { DockSettings, SOUND_GROUP_OF, SoundEvent, SoundGroup, SoundTheme } from '@/shared/types'
import { Frame } from '../previews'
import { Card, Cards, Pages, Row, Switch, Slider, Update } from '../ui'

// ---- Sounds ----

export const SOUND_GROUPS: [SoundGroup, string, string][] = [
  ['hover', 'Üzerine gelince', 'Fare bir simgenin üstünden geçerken küçük bir tık'],
  ['click', 'Tıklama', 'Simgeye tıklayınca'],
  ['launch', 'Uygulama açılışı', 'Kapalı bir program başlatılınca'],
  ['dock', 'Dock', 'Simge bırakma, silme ve otomatik gizlenen dockun gelip gitmesi'],
  ['windows', 'Dock pencereleri', 'Klasör, grup ve çark penceresinin cin efektiyle açılıp kapanması'],
  ['menus', 'Menüler', 'Sağ tık menüsünün açılması ve seçim'],
  ['trash', 'Çöp kutusu', 'Dosya atma ve çöp kutusunu boşaltma'],
  ['dialogs', 'Onay pencereleri', 'Soru, onay, vazgeçme ve uyarı sesleri'],
  ['ui', 'Ayarlar ve bildirimler', 'Bu penceredeki anahtarlar ve bildirim sesi'],
]

export const SOUND_TESTS: [SoundEvent, string][] = [
  ['hover', 'Üzerine gelme'], ['click', 'Tıklama'], ['launch', 'Açılış'], ['drop', 'Bırakma'], ['remove', 'Silme (puf)'], ['dockShow', 'Dock gelir'], ['dockHide', 'Dock gider'],
  ['windowOpen', 'Pencere açılır (cin)'], ['windowClose', 'Pencere kapanır (cin)'], ['menuOpen', 'Menü açılır'], ['menuPick', 'Menü seçimi'],
  ['trashDrop', 'Çöpe atma'], ['trashEmpty', 'Çöp boşaltma'], ['confirmOpen', 'Soru'], ['accept', 'Onay'], ['cancel', 'Vazgeç'], ['warn', 'Uyarı'], ['error', 'Hata'], ['toggle', 'Anahtar'], ['notify', 'Bildirim'],
]

export function SoundTab({ s, set }: { s: DockSettings; set: Update }) {
  useEffect(() => initSound(), [])
  const toggleGroup = (g: SoundGroup, on: boolean) => set({ soundGroups: on ? [...s.soundGroups, g] : s.soundGroups.filter((x) => x !== g) })
  return (
    <Pages id="sound">
      <Card icon="sound" title="Genel" hint="Sesler uygulamanın kendi içinde üretilir; ses dosyası gerekmez. Windows'un genel sesine ve ses karıştırıcısına bağlıdır.">
        <Row icon="power" label="Sesleri aç"><Switch label="Sesleri aç" value={s.soundEnabled} onChange={(soundEnabled) => set({ soundEnabled })} /></Row>
        <Row icon="sound" label="Ses düzeyi"><Slider value={s.soundVolume} min={0} max={100} unit="%" onChange={(soundVolume) => set({ soundVolume })} /></Row>
        <Row icon="motion" label="Ses stili" hint="Aynı olaylar, farklı bir karakterle çalar. Karta tıklayınca duyarsın." />
        <Cards<SoundTheme> size="s" value={s.soundTheme} onChange={(soundTheme) => { set({ soundTheme }); previewSound('click', soundTheme, s.soundVolume) }} options={(Object.keys(SOUND_THEMES) as SoundTheme[]).map((id) => ({ id, label: SOUND_THEMES[id].label, preview: <Frame><svg viewBox="0 0 100 60" className="pv-svg" aria-hidden="true"><path d="M6 30H94" className="pv-svg__axis" /><path d={wavePath(id)} className="pv-svg__line" /></svg></Frame> }))} />
      </Card>
      <Card icon="list" tab="Olaylar" title="Hangi olaylarda ses çalsın">
        {SOUND_GROUPS.map(([group, label, hint]) => (
          <Row key={group} label={label} hint={hint}><Switch label={label} value={s.soundGroups.includes(group)} onChange={(on) => toggleGroup(group, on)} /></Row>
        ))}
      </Card>
      <Card icon="play" tab="Dene" title="Sesleri dene" hint="Her ses seçili stille ve düzeyle çalar; olay kapalı olsa bile buradan dinleyebilirsin.">
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
