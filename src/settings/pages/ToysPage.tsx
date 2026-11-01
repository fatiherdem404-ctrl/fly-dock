import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon from '@/icons'
import { DEFAULT_TOY_SCORES, DockLayer, DockSettings, ToyMode, ToyScores } from '@/shared/types'
import { Card, Cards, Pages, Row, Segmented, Switch, Update } from '../ui'
import { LayerPreview } from '../previews'
import { Frame } from '../previews'
import basketballUrl from '@/assets/toys/basketball.png'
import soccerUrl from '@/assets/toys/soccer.png'

/** Each game's own little picture: its ball or racket. */
function GameGlyph({ game }: { game: 'basket' | 'football' | 'bounce' }) {
  if (game === 'basket') return <img src={basketballUrl} alt="" />
  if (game === 'football') return <img src={soccerUrl} alt="" />
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#cfe84a" stroke="#8fa61a" strokeWidth="1" />
      <path d="M5 10 Q 14 16 5 22 M27 10 Q 18 16 27 22" fill="none" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
  )
}

/** A small picture of each game, drawn once: the pitch with its ball. */
function GamePic({ game }: { game: 'basket' | 'football' | 'bounce' }) {
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
      {game === 'bounce' && (
        <>
          <path d="M40 8 C 44 30 60 40 78 44" stroke="#efe7d2" strokeWidth="1.8" fill="none" />
          <circle cx="40" cy="8" r="3" fill="#ffd9a0" />
          <circle cx="80" cy="46" r="13" fill="#f4f1ea" stroke="#b9b3a6" />
          <path d="M72 38 Q 77 46 72 54 M88 38 Q 83 46 88 54" fill="none" stroke="#c8302f" strokeWidth="1.8" />
          <path d="M92 30 Q 100 10 112 30 M118 34 Q 126 14 138 34" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeDasharray="3 4" />
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
    <Card icon="check" tab="Oyunlar" title="Skorların" hint="Süreye karşı modda tur 60 saniyedir: topa ilk dokunuşunla başlar, süre dolunca rekorun kaydedilir. Serbest modda rekor yalnızca top sektirme serisi için tutulur. Kapatıp açsan da kaybolmaz.">
      <div className="st-scores">
        <div><b>{scores.basketBest}</b><small>Basketbol rekoru (60 sn)</small><em>toplam {scores.basket}</em></div>
        <div><b>{scores.footballBest}</b><small>Futbol rekoru (60 sn)</small><em>toplam {scores.football}</em></div>
        <div><b>{scores.juggleBest}</b><small>Futbol sektirme rekoru (60 sn)</small><em>en uzun seri {scores.juggleCombo}</em></div>
        <div><b>{scores.bounceBest}</b><small>Top sektirme rekoru (60 sn)</small><em>en uzun seri {scores.bounceCombo}</em></div>
      </div>
      <Row label="Skorları sıfırla"><button className="st-btn" onClick={() => invoke('toys:scores', { basket: 0, basketBest: 0, football: 0, footballBest: 0, bounceBest: 0, bounceCombo: 0, juggleBest: 0, juggleCombo: 0 }).then(setScores)}><Icon name="refresh" size={15} />Sıfırla</button></Row>
    </Card>
  )
}

export function ToysTab({ s, set }: { s: DockSettings; set: Update }) {
  const game = (key: 'toyBasket' | 'toyFootball' | 'toyBounce', modeKey: 'toyBasketMode' | 'toyFootballMode' | 'toyBounceMode', pic: 'basket' | 'football' | 'bounce', title: string, hint: string, how: string, extra?: React.ReactNode) => (
    <Card glyph={<GameGlyph game={pic} />} icon="toys" tab="Oyunlar" title={title} hint={hint}>
      <div className="st-toygame">
        <Frame className="st-toygame__pic"><GamePic game={pic} /></Frame>
        <p className="st-prose">{how}</p>
      </div>
      {extra}
      <Row label={`${title} açık`}><Switch label={title} value={s[key]} onChange={(v) => set({ [key]: v })} /></Row>
      <Row label="Mod" hint="Serbest: sadece oyna, sayaç tutulur. Süreye karşı: 60 saniyede en yüksek skor, rekor kaydedilir."><Segmented<ToyMode> value={s[modeKey]} onChange={(v) => set({ [modeKey]: v })} options={[['free', 'Serbest'], ['timed', 'Süreye karşı']]} /></Row>
    </Card>
  )
  return (
    <Pages id="toys">
      {game('toyBasket', 'toyBasketMode', 'basket', 'Basketbol', 'Sağ kenarda bir pota, yerde bir top.', 'İmleç topun yanına gelince ele dönüşür: topu tutup fırlat, potadan geçerse basket sayılır. Uzaktan atış üç sayı, hiçbir yere değmeden giren atış deliksiz.')}
      {game('toyFootball', 'toyFootballMode', 'football', 'Futbol', 'Serbest vuruş, penaltı ya da top sektirme.', 'Serbest vuruşta imleç topun yanına gelince krampona dönüşür: topa hızlıca vur, kenardaki kalelere sok. Penaltıda topu sapan gibi geri çek, yön ve gücü çekişin belirler; fare tekerleği falsoyu ayarlar, kaleci seni durdurmaya çalışır. Top sektirmede topa tıkla, krampon sana geçer; topu yere düşürmeden havada tut, her vuruş bir puan.', (
        <>
          <Row label="Futbol türü" hint="Serbest vuruş: iki kale. Penaltı: tek kale ve kaleci. Top sektirme: topu kramponla havada tut"><Segmented<'free' | 'penalty' | 'juggle'> value={s.toyFootballStyle} onChange={(toyFootballStyle) => set({ toyFootballStyle })} options={[['free', 'Serbest vuruş'], ['penalty', 'Penaltı'], ['juggle', 'Top sektirme']]} /></Row>
          {s.toyFootballStyle === 'penalty' && <Row label="Kaleci de sana atsın" hint="Sen attıktan sonra kaleci karşı kaleye şut çeker; imleçle kalenin önünde eldiven olarak savunursun"><Switch label="Kaleci sana da atsın" value={s.toyKeeperShoots} onChange={(toyKeeperShoots) => set({ toyKeeperShoots })} /></Row>}
        </>
      ))}
      {game('toyBounce', 'toyBounceMode', 'bounce', 'Top sektirme', 'Raketle tenis topunu havada tut.', 'Topa tıkla, havaya fırlasın; imleç yatay bir raket olur. Topu yere düşürmeden sektir, her vuruş bir puan. Top düşünce seri biter; sağ tık oyunu bırakır.')}
      <Scores tab="Oyunlar" />
      <Card icon="window" tab="Yerleşim" title="Pencere katmanı" hint="Oyunlar diğer pencerelerin üstünde mi dursun, onlar gibi davransın mı, yoksa masaüstü gibi altta mı kalsın.">
        <Cards<DockLayer> size="s" value={s.toyLayer} onChange={(toyLayer) => set({ toyLayer })} options={[
          { id: 'above', label: 'Üstte', hint: 'Hep önde', preview: <LayerPreview layer="above" /> },
          { id: 'normal', label: 'Normal', hint: 'Pencereler kapatabilir', preview: <LayerPreview layer="normal" /> },
          { id: 'below', label: 'Altta', hint: 'Masaüstü gibi', preview: <LayerPreview layer="below" /> },
        ]} />
      </Card>
      <Card icon="location" tab="Yerleşim" title="Konum" hint="Oyunların bastığı zemin ve potanın yeri.">
        <Row label="Zemin" hint="Dock altta ve açıksa 'Dock’un üstü' onun rafını zemin yapar"><Segmented value={s.toyFloor} onChange={(toyFloor) => set({ toyFloor })} options={[['dock', 'Dock’un üstü'], ['screen', 'Ekranın altı']]} /></Row>
        <Row label="Pota" hint="Basketbol potasının durduğu kenar"><Segmented value={s.toyHoopSide} onChange={(toyHoopSide) => set({ toyHoopSide })} options={[['right', 'Sağda'], ['left', 'Solda']]} /></Row>
      </Card>
      <Card icon="sound" tab="Oyunlar" title="Ses">
        <Row label="İmleci göster" hint="Oyun sırasında Windows imleci raketin, elin ya da kramponun yanında da görünsün. Skor kartındaki düğmeyle de değişir"><Switch label="İmleci göster" value={s.toyShowCursor} onChange={(toyShowCursor) => set({ toyShowCursor })} /></Row>
        <Row label="Oyun sesleri" hint="Top sekmesi, basket ve gol sesleri"><Switch label="Ses" value={s.toySound} onChange={(toySound) => set({ toySound })} /></Row>
      </Card>
    </Pages>
  )
}
