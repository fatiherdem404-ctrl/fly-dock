# Konsept ↔ gerçek uygulama farkı

Kaynak görseller: `docs/concepts/DesktopFlow_ Kişisel Masaüstü Dünyanız.png` ve `docs/concepts/DesktopForge Kişiselleştirme Evreni.png`.
Bunlar yapay zekâ konsepti; amaç tasarım dilini almak, birebir kopyalamak değil.

## Konseptte ne var

| Alan | Konseptte |
|---|---|
| Renk | Çok koyu lacivert zemin (≈ `#0a0f1f`), kart yüzeyleri bir ton açık lacivert, ince beyaz %8 çerçeveler, tek vurgu rengi canlı mavi (≈ `#2f7bff`) ve mavi parıltı |
| Dock | Uçları tam yuvarlak, ince ve uzun **hap biçimli** çubuk; solda Windows Başlat düğmesi, ortada renkli uygulama simgeleri, sağda çöp kutusu. 5 varyant: koyu cam, mavi parlak çerçeve, ahşap kaplama, mavi neon halka, metal |
| Ayarlar | Solda ikonlu liste (Genel, Dock, Tema, Simge, Ses, Duvar Kağıdı, Widget, Performans), seçili satır mavi dolgu; sağda "Dock Ayarları" alanları: konum açılır menü, ince mavi kaydırıcılar (boyut, şeffaflık), anahtarlar; altta dock önizlemesi ve mavi **Kaydet** düğmesi |
| Kartlar | 12–14 px köşe, hafif iç parıltı, hover'da yükselme; mağaza kartlarında büyük küçük resim, yıldız puanı, "İndir" düğmesi |
| Widget | Ekranın sağında tek cam panel: büyük saat, hava durumu, mavi gradyan dolgulu CPU/RAM/Disk çubukları, albüm kapaklı medya oynatıcı, hızlı ayar düğmeleri |
| Diğer | Tema/simge/ses paketleri, duvar kağıtları, canlı arka planlar, tema mağazası |

## Neyi birebir yapabiliriz (ve yaptık)

- Lacivert palet, mavi vurgu, cam kartlar, ince çerçeveler, mavi kaydırıcı ve anahtar: ayarlar penceresi ve varsayılan tema bu paletle yeniden boyandı.
- Hap biçimli dock ve beş dock varyantı (koyu cam, mavi parlak çerçeve, ahşap, mavi neon, metal): raf şekli ayarı (hap / yuvarlak / kare) ve yeni stiller eklendi.
- Başlat düğmesi: dock'a eklenebilen "Başlat" öğesi (Windows tuşunu gönderir).
- Ayarlar sol listesi, seçili satırın mavi dolgusu, altta/üstte canlı dock önizlemesi.
- Widget'larda mavi gradyan çubuklar ve büyük saat.

## Neyi yaklaştırabiliriz (tam aynısı olmaz)

- Ahşap/metal rafın fotogerçekçi dokusu: CSS gradyanlarıyla benzer hava verilir, gerçek fotoğraf dokusu için doku dosyası gerekir (ileride tema paketiyle).
- Konseptteki parlak yansımalar ve derin gölgeler: CSS ile yaklaşık; bunlar gerçek ışık hesabı değil.
- "Kaydet" düğmesi: bizde değişiklikler anında uygulanıyor (canlı), ayrı kaydet gerekmiyor; bilerek böyle.

## Yapamayacağımız ya da şimdilik yapmayacağımız

- **Tema mağazası, yıldız puanı, indirme sayıları:** sunucu gerektirir; ROADMAP v3 (önce GitHub tabanlı paylaşım). Şu an yalnızca yerel `.flypack` içe/dışa aktarma var.
- **Ses paketleri, duvar kağıdı, canlı arka plan:** ROADMAP v2.
- **Albüm kapağı ve parça adı:** Windows medya oturumu için WinRT paketi indirmek gerekir (izin bekliyor); şimdilik oynatıcı pencere başlığı.
- **Hızlı ayar düğmeleri (parlaklık, ses, Wi-Fi):** sistem ayarlarına dokunmayı gerektirir; kapsam dışı.
- **Konseptteki masaüstü simgeleri ve duvar kağıdı:** bizim işimiz değil, kullanıcının masaüstü.
- Konseptteki 3B ahşap dock'un gerçek derinlikli (fotogerçekçi) görünümü yapay zekâ çizimi; CSS perspektifiyle yaklaşık bir 3B verilir, birebir olmaz.

## Karşılaştırma

Yeniden boyama sonrası yan yana ekran görüntüsü ve dürüst değerlendirme: aşağıda (çalışma sonunda eklenecek).
