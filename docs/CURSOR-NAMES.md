# İmleç (cursor) türleri: paket hazırlama rehberi

Windows'ta fare imleci **17 ayrı durumda** değişir. Bir imleç paketi, bu durumların her biri için bir resimdir.
Aşağıdaki dosya adlarını **birebir** kullan; ben paketi bu adlara göre içe alırım ve Windows'a dönüştürürüm.
Hepsini çizdirmek zorunda değilsin: olmayan imleç Windows'un kendi imleciyle kalır.

## Dosya biçimi (hepsi için)

- **PNG, 256 × 256 piksel, tamamen şeffaf arka plan.** (Ben bundan 32, 48, 64 ve 128 piksel boyutlarını üretirim.)
- İmleç resmin içinde **kenarlardan en az 8 piksel boşlukla** dursun, kenara yapışmasın.
- **Gölge çizdirme.** Windows kendi gölgesini ekleyebiliyor, çift gölge kötü durur.
- Hepsi **aynı stilde** olsun: aynı renk paleti, aynı çizgi kalınlığı, aynı ışık yönü.
- Beyaz ya da siyah zemin üzerinde de okunsun: ince bir dış çizgi (kontur) iyi olur.

## 15 sabit imleç + 2 yeni

| Dosya adı | Windows'taki adı | Ne zaman görünür | Tasarım notu | Sıcak nokta (tıklanan yer) |
|---|---|---|---|---|
| `arrow.png` | Normal Seçim | Her zamanki ok | Ok sivri ucu **sol üstte** | ucu: sol üst köşe (%4, %3) |
| `help.png` | Yardım Seçimi | Soru işaretli yardım | Ok + küçük `?` | ok ucu: sol üst (%4, %3) |
| `working.png` | Arka Planda Çalışıyor | Program açılırken | Ok + küçük dönen halka. **Hareketli** (aşağıya bak) | ok ucu: sol üst (%4, %3) |
| `busy.png` | Meşgul | Bekle / yükleniyor | Dönen halka ya da kum saati. **Hareketli** | merkez (%50, %50) |
| `precision.png` | Kesin Seçim | Artı işareti | İnce artı (+) | merkez (%50, %50) |
| `text.png` | Metin Seçimi | Yazı alanı üstünde | Dikey I çubuğu | merkez (%50, %50) |
| `handwriting.png` | El Yazısı | Kalem | Kalem ucu **sol altta** | kalem ucu: sol alt (%10, %92) |
| `unavailable.png` | Kullanılamaz | Yasak / izin yok | Yasak işareti (daire + çapraz çizgi) | merkez (%50, %50) |
| `resize-vertical.png` | Dikey Boyutlandırma | Pencerenin alt/üst kenarı | Yukarı-aşağı çift ok (↕) | merkez (%50, %50) |
| `resize-horizontal.png` | Yatay Boyutlandırma | Pencerenin sağ/sol kenarı | Sağ-sol çift ok (↔) | merkez (%50, %50) |
| `resize-diagonal1.png` | Çapraz Boyutlandırma 1 | Sol üst / sağ alt köşe | Sol üstten sağ alta çift ok (↘↖) | merkez (%50, %50) |
| `resize-diagonal2.png` | Çapraz Boyutlandırma 2 | Sağ üst / sol alt köşe | Sağ üstten sol alta çift ok (↙↗) | merkez (%50, %50) |
| `move.png` | Taşı | Pencere taşırken | Dört yönlü ok (✥) | merkez (%50, %50) |
| `alternate.png` | Alternatif Seçim | Yukarı ok | Yukarı bakan ince ok | ok ucu: üst orta (%50, %5) |
| `link.png` | Bağlantı Seçimi | Linkin üstünde | El (işaret parmağı uzanmış) | parmak ucu (%38, %5) |
| `location.png` | Konum Seçimi | (Windows 10/11) | Harita iğnesi | iğnenin ucu: alt orta (%50, %94) |
| `person.png` | Kişi Seçimi | (Windows 10/11) | Ok + küçük insan figürü | ok ucu: sol üst (%4, %3) |

**Sıcak nokta** imleçte "tıklamanın gerçekte olduğu" pikseldir. Oku çizerken sivri ucun resmin sol üstüne,
parmak ya da iğne gibi şeylerin ucunun tablodaki yere yakın düşmesine dikkat et. Tam tutmazsa sorun değil:
paketin içine `cursors.json` dosyasında kendi sıcak noktalarını yazabilirsin (aşağıda), yazmazsan tablodaki
değerleri kullanırım.

## Hareketli iki imleç: `working` ve `busy`

Bunlar tek resim değil, **kare şeridi** olarak hazırlanır:

- Dosya adı `working-strip.png` ve `busy-strip.png`.
- Kareler **soldan sağa art arda** dizilir, her kare 256 × 256. Yani 12 kare için dosya **3072 × 256** olur.
- **8 ile 16 kare arası** yeterli. İlk ve son kare birbirine bağlanmalı (döngü).
- Hareketli olmasını istemezsen sadece `working.png` / `busy.png` vermen yeter, o zaman sabit kalır.

## Paketin içeriği

Tek bir klasör (ya da `.zip`) hazırla:

```
benim-imlec-paketim/
  pack.json        {"type":"cursors","id":"benim-imlec-paketim","name":"Benim paketim","author":"Ben"}
  arrow.png
  help.png
  working-strip.png
  busy-strip.png
  precision.png
  text.png
  handwriting.png
  unavailable.png
  resize-vertical.png
  resize-horizontal.png
  resize-diagonal1.png
  resize-diagonal2.png
  move.png
  alternate.png
  link.png
  location.png     (isteğe bağlı)
  person.png       (isteğe bağlı)
  cursors.json     (isteğe bağlı: sıcak noktaları ve hareket hızını yazmak istersen)
```

`cursors.json` örneği (hepsi isteğe bağlı; değerler resmin **piksel** cinsinden yeridir, 256 × 256 üzerinden):

```json
{
  "hotspots": { "arrow": [10, 8], "link": [98, 12], "location": [128, 240] },
  "animations": { "busy": { "fps": 16 }, "working": { "fps": 14 } }
}
```

## ChatGPT'ye vereceğin istem (kopyalayıp kullan)

> Bir Windows fare imleci paketi için görseller üret. Hepsi **aynı stilde** olsun: [STİLİ BURAYA YAZ, örn. "yumuşak
> 3B, parlak cam, mavi-mor tonlar, ince beyaz kontur"]. Her görsel **256×256 piksel, şeffaf arka plan, gölgesiz**,
> kenarlarda 8 piksel boşluk. Şu imleçleri ayrı ayrı çiz ve dosya adlarıyla ver: arrow (normal ok, ucu sol üstte),
> help (ok + soru işareti), precision (ince artı), text (I çubuğu), handwriting (kalem, ucu sol altta),
> unavailable (yasak işareti), resize-vertical (↕), resize-horizontal (↔), resize-diagonal1 (↖↘),
> resize-diagonal2 (↗↙), move (dört yönlü ok), alternate (yukarı ok), link (işaret parmağı uzanmış el),
> location (harita iğnesi), person (ok + küçük insan). Ayrıca iki hareketli imleç için **12 karelik şerit** ver:
> busy-strip (dönen halka, kareler soldan sağa, 3072×256) ve working-strip (ok + küçük dönen halka, 3072×256).

İpucu: ChatGPT bir seferde hepsini tutarlı çizmeyebilir. Önce `arrow` ve `link` ile stili oturt, beğenince kalanlarını
"aynı stilde" diye ver. Resimler beyaz/ekose arka planla gelirse arka planı kaldırması için ayrıca söyle ya da bana
ver, ben şeffaflaştırırım.

## Ben ne yapacağım

- Paketi içe alıp her PNG'den Windows imleç dosyalarını (`.cur`, hareketliler için `.ani`) üretirim.
- Ayarlar'da "İmleç paketleri" sayfasında seçince uygularım; **"Windows'un kendi imleçleri"** seçeneğiyle her an geri alırsın.
- Uygulama kapanınca imleçler normale döner (istersen açık bırakma seçeneği de koyarım).
