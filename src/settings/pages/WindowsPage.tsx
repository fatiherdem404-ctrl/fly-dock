import { DockSettings, StackSize, StackPlacement } from '@/shared/types'
import { Card, Cards, Pages, Row, Slider, Update } from '../ui'
import { PlacementPreview, SizePreview } from '../previews'

// ---- Dock windows ----

export function WindowsTab({ s, set }: { s: DockSettings; set: Update }) {
  return (
    <Pages id="windows">
      <Card icon="maximize" tab="Pencereler" title="Pencere boyutu" hint="Bir klasöre ya da gruba tıklayınca açılan dock penceresinin boyutu. Pencereyi kenarından sürükleyip büyütürsen boyut 'Özel' olarak hatırlanır.">
        <Cards<StackSize> size="s" value={s.stackSize} onChange={(stackSize) => set({ stackSize })} options={[
          { id: 'small', label: 'Küçük', hint: '360 × 300', preview: <SizePreview size="small" /> },
          { id: 'medium', label: 'Orta', hint: '520 × 420', preview: <SizePreview size="medium" /> },
          { id: 'full', label: 'Tam ekran', hint: 'Çalışma alanı', preview: <SizePreview size="full" /> },
          { id: 'custom', label: 'Özel', hint: `${s.stackWidth} × ${s.stackHeight}`, preview: <SizePreview size="custom" /> },
        ]} />
        {s.stackSize === 'custom' && (
          <>
            <Row icon="arrowRight" label="Genişlik"><Slider value={s.stackWidth} min={240} max={1600} step={10} unit=" px" onChange={(stackWidth) => set({ stackWidth })} /></Row>
            <Row icon="arrowDown" label="Yükseklik"><Slider value={s.stackHeight} min={200} max={1000} step={10} unit=" px" onChange={(stackHeight) => set({ stackHeight })} /></Row>
          </>
        )}
      </Card>
      <Card icon="location" tab="Pencereler" title="Açılış konumu" hint="Klasör, grup ve çark penceresi ekranın neresinde açılsın. Açılış efekti her durumda simgenin olduğu yerden başlar.">
        <Cards<StackPlacement> size="s" value={s.stackPlacement} onChange={(stackPlacement) => set({ stackPlacement })} options={[
          { id: 'icon', label: 'Simgenin üstünde', hint: 'Tıkladığın simgeye yaslı', preview: <PlacementPreview place="icon" /> },
          { id: 'dock', label: 'Dock ortasında', hint: 'Dock’un kenarına yaslı', preview: <PlacementPreview place="dock" /> },
          { id: 'center', label: 'Ekranın ortasında', hint: 'Çalışma alanının ortası', preview: <PlacementPreview place="center" /> },
          { id: 'cursor', label: 'Fare imlecinde', hint: 'İmlecin olduğu yer', preview: <PlacementPreview place="cursor" /> },
        ]} />
      </Card>
      <Card icon="list" tab="Pencereler" title="Nasıl çalışır">
        <p className="st-prose">Dock’taki bir klasöre sağ tıklayıp <b>Yığın olarak göster</b> de, ya da <b>Yeni grup</b> ile bir uygulama grubu oluştur. Tıklayınca pencere simgeden büyüyerek açılır. Başlık çubuğundan sürükleyip taşıyabilir, kenarlarından yeniden boyutlandırabilirsin. İçindeki öğelere sağ tıklayınca Windows’takine benzer bir menü açılır. <kbd>Esc</kbd> ya da dışarı tıklama kapatır; kapanırken simgesine geri çekilir.</p>
      </Card>
    </Pages>
  )
}
