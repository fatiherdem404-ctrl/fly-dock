<!-- docs/templates/README.tr.md.tpl ve src/config/brand.config.json dosyalarından `npm run brand:render` ile üretilir. Elle düzenleme. -->
# {{name}}

{{tagline.tr}} — {{description.tr}}

[English](README.md) · [Sorunlar]({{issuesUrl}})

> Durum: erken geliştirme (Faz 0). Henüz günlük kullanıma uygun değil.

![Ekran görüntüsü yer tutucusu](docs/screenshot.png)

## Özellikler

Şu an çalışan:

- Şeffaf, her zaman üstte dock penceresi (alt/üst/sol/sağ)
- Yay fiziğiyle büyütme, sürükle-bırakla ekleme, sıralama ve kaldırma, çöp kutusu
- C# yardımcı süreçten gelen pencere olaylarıyla çalışan uygulama göstergesi
- Net kabuk simgeleri (256 piksele kadar), simge paketleri ve elle değiştirme
- Klasör yığınları, genel kısayollar, çok monitör, Win11 akrilik/mica
- Masaüstü widget'ları: saat, hava durumu, CPU/RAM/disk, medya tuşları, takvim
- JSON temalar ve simge paketleri (`.flypack`, içe/dışa aktarma, doğrulamalı)
- Canlı önizlemeli ayarlar penceresi, 10 raf stili, animasyon kütüphanesi, yedekle ve geri yükle
- Duvar kâğıtları: resim, video, canlı arka planlar ve kendi yazdığın JavaScript canvas sahneleri
- İmleç paketleri, simge ve simge paketi tasarlayabileceğin ikon stüdyosu
- Mini masaüstü oyunları: basketbol, futbol, top sektirme ve pong
- İngilizce ve Türkçe arayüz; Windows’un diline uyar, Ayarlar → Genel’den değiştirilir

Planlananlar: ses paketleri, topluluk paketleri. Bkz. [ROADMAP.md](ROADMAP.md).

## Ekran görüntüleri

<p>
  <img src="docs/screenshots/tr/dock.png" width="49%" alt="dock" />
  <img src="docs/screenshots/tr/themes.png" width="49%" alt="themes" />
  <img src="docs/screenshots/tr/desk.png" width="49%" alt="desk" />
  <img src="docs/screenshots/tr/icons.png" width="49%" alt="icons" />
  <img src="docs/screenshots/tr/studio.png" width="49%" alt="studio" />
  <img src="docs/screenshots/tr/cursors.png" width="49%" alt="cursors" />
  <img src="docs/screenshots/tr/toys.png" width="49%" alt="toys" />
</p>

## İndir

Son kurulum dosyasını [Releases]({{repoUrl}}/releases) sayfasından indirip çalıştır. Kurulum dosyası henüz kod imzalı değil; Windows SmartScreen "Windows bilgisayarınızı korudu" diyebilir: **Daha fazla bilgi**, ardından **Yine de çalıştır**. Kaynak kodun tamamı burada, istersen kendin de derleyebilirsin (aşağıya bak).

## Başlarken

Node.js, .NET 10 SDK (yardımcı süreci derler) ve Windows 10/11 gerekir.

```bash
npm install
npm run dev
```

Faydalı komutlar: `npm run typecheck`, `npm run brand:check`, `npm run brand:render`, `npm run build`.

## Mimari

```
helper/     C# yardımcı süreç: pencere olayları, kabuk simgeleri, çöp kutusu (stdin/stdout üzerinden JSON)
electron/   ana süreç: dock pencereleri, tepsi, tipli IPC, store, paketler, widget'lar
src/        arayüz (React): dock, ayarlar, yığın ve widget görünümleri; src/shared IPC sözleşmesini tutar
src/config/brand.config.json   ad, kimlikler, bağlantılar ve logo yolları için tek kaynak
scripts/    marka denetimi ve doküman üretimi
```

Ad, uygulama kimliği, bağlantılar, tepsi metni, pencere başlığı, kurulum dosyası adı ve bu belgeler `src/config/brand.config.json` dosyasından gelir. Değişikliği orada yap, `npm run brand:render` çalıştır; başka yerde sabit yazılmış bir şey kalırsa `npm run brand:check` söyler.


## Lisans

{{license}} — bkz. [LICENSE](LICENSE). Telif © {{copyrightYear}} {{company}}.

Kod serbestçe kullanılabilir ve değiştirilebilir. "{{name}}" adı ve logo lisansın parçası değildir: resmî sürümü belirtir. Değiştirilmiş bir sürüm yayımlarsan başka bir ad ve logo kullan, telif notlarını koru ve değiştirildiğini belirt — ayrıntılar [NOTICE](NOTICE) dosyasında.

Üçüncü taraf lisansları: [THIRD-PARTY.md](THIRD-PARTY.md).
