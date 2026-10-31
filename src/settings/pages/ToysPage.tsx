import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import { DEFAULT_TOY_SCORES, DockSettings, ToyScores } from '@/shared/types'
import { Card, Cards, Pages, Row, Slider, Switch, Update } from '../ui'
import { Frame } from '../previews'
import PetSprite, { PET_NAMES } from '@/toys/PetSprite'
import type { PetKind } from '@/toys/pet'

/** A small picture of each game, drawn once: the pitch with its ball. */
function GamePic({ game }: { game: 'basket' | 'football' | 'tennis' }) {
  return (
    <svg viewBox="0 0 160 70" className="st-toypic" aria-hidden="true">
      <rect x="0" y="60" width="160" height="10" fill="rgba(255,255,255,0.12)" />
      {game === 'basket' && (
        <>
          <rect x="140" y="8" width="5" height="26" rx="1.5" fill="#fff" opacity="0.92" />
          <path d="M112 30h28" stroke="#ff7a2f" strokeWidth="3" strokeLinecap="round" />
          <path d="M114 30l5 14M138 30l-5 14M122 30l1 14M130 30l-1 14" stroke="#fff" strokeWidth="1" opacity="0.7" />
          <circle cx="60" cy="48" r="12" fill="#e8742a" /><path d="M48 48h24M60 36v24" stroke="#4a210a" strokeWidth="1.5" />
          <path d="M60 36 C 90 5 105 14 124 28" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        </>
      )}
      {game === 'football' && (
        <>
          <rect x="2" y="30" width="22" height="30" fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth="2" />
          <rect x="136" y="30" width="22" height="30" fill="rgba(255,255,255,0.12)" stroke="#fff" strokeWidth="2" />
          <circle cx="80" cy="46" r="13" fill="#f2f3f6" /><path d="M80 40l6 4-2 7h-8l-2-7z" fill="#23262e" />
        </>
      )}
      {game === 'tennis' && (
        <>
          <rect x="77" y="26" width="6" height="34" fill="rgba(255,255,255,0.18)" stroke="#fff" strokeWidth="1" />
          <circle cx="45" cy="44" r="7" fill="#c8e63a" /><path d="M39 42q6 4 12 0" stroke="#fff" strokeWidth="1.2" fill="none" />
          <path d="M45 44 C 55 10 75 8 110 40" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        </>
      )}
    </svg>
  )
}

function Scores(_props: { tab: string }) {
  const [scores, setScores] = useState<ToyScores>(DEFAULT_TOY_SCORES)
  useEffect(() => {
    invoke('toys:scores').then(setScores)
  }, [])
  return (
    <Card icon="check" tab="Oyunlar" title="Skorların" hint="Oyunlar sonuçlarını kendisi tutar; kapatıp açsan da kaybolmaz.">
      <div className="st-scores">
        <div><b>{scores.basket}</b><small>Atılan sepet</small></div>
        <div><b>{scores.football}</b><small>Atılan gol</small></div>
        <div><b>{scores.tennisBest}</b><small>En uzun tenis serisi</small></div>
      </div>
      <Row label="Skorları sıfırla"><button className="st-btn" onClick={() => invoke('toys:scores', { basket: 0, football: 0, tennisBest: 0 }).then(setScores)}><Icon name="refresh" size={15} />Sıfırla</button></Row>
    </Card>
  )
}

export function ToysTab({ s, set }: { s: DockSettings; set: Update }) {
  const game = (key: 'toyBasket' | 'toyFootball' | 'toyTennis', pic: 'basket' | 'football' | 'tennis', title: string, hint: string, how: string) => (
    <Card icon="toys" tab="Oyunlar" title={title} hint={hint}>
      <div className="st-toygame">
        <Frame className="st-toygame__pic"><GamePic game={pic} /></Frame>
        <p className="st-prose">{how}</p>
      </div>
      <Row label={`${title} açık`}><Switch label={title} value={s[key]} onChange={(v) => set({ [key]: v })} /></Row>
    </Card>
  )
  return (
    <Pages id="toys">
      <Card icon="toys" tab="Evcil hayvan" title="Evcil hayvan" hint="Masaüstünde, dock’un üstünde gezen küçük bir dost. Uyur, oturur, seni takip eder; tutup fırlatabilir, tıklayıp sevebilirsin.">
        <Row label="Evcil hayvan açık"><Switch label="Evcil hayvan" value={s.toyPet} onChange={(toyPet) => set({ toyPet })} /></Row>
        <Cards<PetKind> value={s.toyPetKind} onChange={(toyPetKind) => set({ toyPetKind })} options={(['cat', 'dog', 'rabbit'] as PetKind[]).map((k) => ({
          id: k,
          label: PET_NAMES[k],
          hint: k === 'cat' ? 'Sakin ve tembel' : k === 'dog' ? 'Neşeli, hep peşinde' : 'Ürkek ve sevimli',
          preview: <span className="st-petpic"><PetSprite kind={k} /></span>,
        }))} />
      </Card>
      <Card icon="edit" tab="Evcil hayvan" title="Huyu ve boyu">
        <Row label="Adı" hint="Üzerine gelince ya da severken görünür"><input className="st-input" type="text" maxLength={20} value={s.toyPetName} onChange={(e) => set({ toyPetName: e.target.value })} /></Row>
        <Row label="Peşimden gelsin" hint="İmleci yere yakın tutunca yanına koşar"><Switch label="Takip" value={s.toyPetChase} onChange={(toyPetChase) => set({ toyPetChase })} /></Row>
        <Row label="Boyut"><Slider value={s.toyPetSize} min={48} max={140} step={2} unit=" px" onChange={(toyPetSize) => set({ toyPetSize })} /></Row>
      </Card>
      {game('toyBasket', 'basket', 'Basketbol', 'Sağ kenarda bir pota, yerde bir top.', 'Topu tutup fırlat; potadan geçirirsen sepet sayılır. İmleci hızlıca topun üstünden geçirirsen de vurmuş olursun.')}
      {game('toyFootball', 'football', 'Futbol', 'İki yanda kale, ortada bir top.', 'İmleçle topa hızlıca vur ya da tutup fırlat. Toplar iki kenardaki kalelerden birine girerse gol olur, top ortaya döner.')}
      {game('toyTennis', 'tennis', 'Tenis', 'Ortada bir file, hafif bir top.', 'İmleç raketin; topa her vuruşun seriyi bir artırır. Top üç kez yere değerse seri biter. En uzun serin kaydedilir.')}
      <Scores tab="Oyunlar" />
      <Card icon="sound" tab="Oyunlar" title="Ses">
        <Row label="Oyuncak sesleri" hint="Top sekmesi, sepet, gol ve evcil hayvanın sesi"><Switch label="Ses" value={s.toySound} onChange={(toySound) => set({ toySound })} /></Row>
      </Card>
    </Pages>
  )
}
