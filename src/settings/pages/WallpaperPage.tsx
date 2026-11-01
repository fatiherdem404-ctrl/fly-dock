// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { invoke, useRemote } from '@/api'
import Icon from '@/icons'
import { DockSettings, LIVE_WALLPAPERS, WallpaperMode, WallpaperFit } from '@/shared/types'
import { Card, Cards, Pages, Row, Switch, Select, Message, Update } from '../ui'
import { FileThumb, Frame, LiveThumb, ThemeScene } from '../previews'
import { Library } from '../WallpaperLibrary'

// ---- Wallpaper ----

export const FITS: [WallpaperFit, string][] = [['fill', 'Doldur'], ['fit', 'Sığdır'], ['stretch', 'Uzat'], ['center', 'Ortala'], ['tile', 'Döşe']]
export const INTERVALS: [number, string][] = [[1, '1 dakika'], [5, '5 dakika'], [10, '10 dakika'], [15, '15 dakika'], [30, '30 dakika'], [60, '1 saat'], [180, '3 saat'], [1440, 'Günde bir']]

export function WallpaperTab({ s, set }: { s: DockSettings; set: Update }) {
  const [info] = useRemote('wallpaper:info', [], 'wallpaper:changed', (p) => p)
  const [theme] = useRemote('themes:get', [s.theme])
  const fileName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p
  const pickFolder = async () => {
    const folder = await invoke('wallpaper:pick-folder')
    if (folder) set({ wallpaperMode: 'folder', wallpaperFolder: folder })
  }
  const ownFile = s.wallpaperSingle && !/^(live|lib):/.test(s.wallpaperSingle) ? s.wallpaperSingle : ''
  return (
    <Pages id="wallpaper">
      <Card icon="image" tab="Kaynak" title="Duvar kâğıdı" hint="Duvar kâğıdı masaüstü simgelerinin arkasında, Windows’a hiçbir şey yazmadan gösterilir. Uygulamayı kapatınca kendi duvar kâğıdın geri gelir.">
        <Cards<WallpaperMode> size="m" value={s.wallpaperMode} onChange={(wallpaperMode) => set({ wallpaperMode })} options={[
          { id: 'off', label: 'Kapalı', hint: 'Windows’un kendi duvar kâğıdı kalır', preview: <Frame><span className="pv-offdesk"><Icon name="image" size={22} /></span></Frame> },
          { id: 'theme', label: 'Temadan gelsin', hint: 'Seçili temanın arka planı; tema değişince o da değişir', preview: theme ? <ThemeScene theme={theme} /> : <Frame>{null}</Frame> },
          { id: 'single', label: 'Ben seçeyim', hint: 'Canlı arka plan, resim ya da video', preview: <Frame>{s.wallpaperSingle.startsWith('live:') ? <LiveThumb id={s.wallpaperSingle.slice(5)} hue={215} /> : ownFile ? <FileThumb path={ownFile} /> : s.wallpaperSingle.startsWith('lib:') ? <span className="pv-offdesk"><Icon name="image" size={22} /></span> : <LiveThumb id="aurora" />}</Frame> },
          { id: 'folder', label: 'Klasörden slayt', hint: 'Resim ve videolar belli aralıkla değişir', preview: <Frame><span className="pv-stack">{s.wallpaperFolder ? <FileThumb path={s.wallpaperFolder} /> : null}<i /><i /><i /></span></Frame> },
        ]} />
        {s.wallpaperMode === 'theme' && (
          <p className="st-prose">
            {theme?.wallpaper?.live
              ? `“${theme.name}” teması canlı arka plan getiriyor: ${LIVE_WALLPAPERS.find(([id]) => id === theme.wallpaper?.live)?.[1] ?? ''}.`
              : theme ? `“${theme.name}” teması bir arka plan getirmiyor ya da resim/video olarak getiriyor; yoksa masaüstün olduğu gibi kalır.` : ''}
          </p>
        )}
        {info?.message && <Message text={info.message} error />}
      </Card>
      {s.wallpaperMode === 'single' && (
        <Card icon="play" tab="Kaynak" title="Hazır canlı arka planlar" hint="Hazır sahnelerden birini seç; hepsi fareye ve tıklamaya tepki verir.">
          <Cards<string> size="m" value={s.wallpaperSingle} onChange={(wallpaperSingle) => set({ wallpaperSingle })} options={
            LIVE_WALLPAPERS.map(([id, name, hint]) => ({ id: `live:${id}`, label: name, hint, preview: <Frame><LiveThumb id={id} /></Frame> }))
          } />
        </Card>
      )}
      {s.wallpaperMode === 'single' && (
        <Card icon="image" tab="Kaynak" title="Kütüphanem" hint="Eklediğin resim, video ve kendi yazdığın sahneler burada adıyla durur. Dosyalar uygulamanın kendi klasörüne kopyalanır; asıl dosyana dokunulmaz.">
          <Library current={s.wallpaperSingle} legacyFile={ownFile} onUse={(id) => id && set({ wallpaperMode: 'single', wallpaperSingle: `lib:${id}` })} />
        </Card>
      )}
      {s.wallpaperMode === 'folder' && (
        <Card icon="folder" tab="Kaynak" title="Klasörden slayt" hint="Klasördeki (ve bir alt klasördeki) resim ve videolar belli aralıkla birbirine karışarak değişir.">
          <div className="st-row-inline">
            <button className="st-btn st-btn--accent" onClick={pickFolder}><Icon name="folder" size={15} />{s.wallpaperFolder ? 'Başka klasör seç…' : 'Klasör seç…'}</button>
            {s.wallpaperFolder && <span className="st-muted" title={s.wallpaperFolder}>{fileName(s.wallpaperFolder)}{info ? ` · ${info.folderCount} dosya` : ''}</span>}
          </div>
          <Row icon="clock" label="Değişme aralığı"><Select<number> value={s.wallpaperMinutes} onChange={(wallpaperMinutes) => set({ wallpaperMinutes })} options={INTERVALS} /></Row>
          <Row icon="refresh" label="Karışık sırayla" hint="Kapalıyken dosya adı sırasıyla"><Switch label="Karışık sırayla" value={s.wallpaperShuffle} onChange={(wallpaperShuffle) => set({ wallpaperShuffle })} /></Row>
          <Row icon="arrowRight" label="Şimdi değiştir"><button className="st-btn" onClick={() => invoke('wallpaper:next')} disabled={!s.wallpaperFolder}><Icon name="arrowRight" size={15} />Sonrakine geç</button></Row>
        </Card>
      )}
      <Card icon="settings" tab="Davranış" title="Yerleşim ve tasarruf">
        <Row icon="maximize" label="Resim yerleşimi"><Select<WallpaperFit> value={s.wallpaperFit} onChange={(wallpaperFit) => set({ wallpaperFit })} options={FITS} /></Row>
        <Row icon="monitor" label="Tam ekran uygulamada dur" hint="Oyun ya da video tam ekranken arka plan çalışmaz, işlemciyi yormaz"><Switch label="Tam ekranda dur" value={s.wallpaperPauseFullscreen} onChange={(wallpaperPauseFullscreen) => set({ wallpaperPauseFullscreen })} /></Row>
        <Row icon="cursor" label="Fareye tepki ver" hint="Hareketli arka planlar farenin yerini izler: yıldızlar bağlanır, dalgalar kabarır, baloncuklar kaçışır"><Switch label="Fareye tepki" value={s.wallpaperReact} onChange={(wallpaperReact) => set({ wallpaperReact })} /></Row>
        <Row icon="clock" label="Hareketli arka plan hızı" hint="Kendi yazdığın kod sahneleri bu hızda çizilir. Düşük hız işlemciyi, ekran kartını ve fanları rahatlatır"><Select<number> value={s.wallpaperFps} onChange={(wallpaperFps) => set({ wallpaperFps })} options={[[15, '15 kare (en sessiz)'], [24, '24 kare'], [30, '30 kare (önerilen)'], [60, '60 kare']]} /></Row>
        <Row icon="battery" label="Pilde dur" hint="Dizüstü pille çalışırken hareketli arka plan durur"><Switch label="Pilde dur" value={s.wallpaperPauseBattery} onChange={(wallpaperPauseBattery) => set({ wallpaperPauseBattery })} /></Row>
        {info && <p className="st-prose">{info.paused ? 'Şu an duraklatılmış.' : info.source ? 'Çalışıyor.' : 'Arka plan yok.'}</p>}
      </Card>
    </Pages>
  )
}
