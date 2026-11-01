<!-- docs/templates/README.tr.md.tpl ve src/config/brand.config.json dosyalarından `npm run brand:render` ile üretilir. Elle düzenleme. -->
# Fly Dock

Masaüstün için modern dock — RocketDock'tan ilham alan, açık kaynaklı Windows dock'u: widget'lar, temalar ve ikon paketleri.

[English](README.md) · [Sorunlar](https://github.com/PLACEHOLDER/fly-dock/issues) · [Ko-fi'de destek ol](https://ko-fi.com/PLACEHOLDER)

> Durum: erken geliştirme (Faz 0). Henüz günlük kullanıma uygun değil.

![Ekran görüntüsü yer tutucusu](docs/screenshot.png)

## Özellikler

Şu an çalışan (iskelet):

- Şeffaf, her zaman üstte dock penceresi (alt/üst/sol/sağ)
- Yay fiziğiyle büyütme, sürükle-bırakla ekleme, sıralama ve kaldırma, çöp kutusu
- C# yardımcı süreçten gelen pencere olaylarıyla çalışan uygulama göstergesi
- Net kabuk simgeleri (256 piksele kadar), simge paketleri ve elle değiştirme
- Klasör yığınları, genel kısayollar, çok monitör, Win11 akrilik/mica
- Masaüstü widget'ları: saat, hava durumu, CPU/RAM/disk, medya tuşları, takvim
- JSON temalar ve simge paketleri (`.flypack`, içe/dışa aktarma, doğrulamalı)
- Canlı önizlemeli ayarlar penceresi, 10 raf stili, animasyon kütüphanesi, yedekle ve geri yükle

Planlananlar: duvar kağıtları, canlı arka planlar, ses paketleri, topluluk paketleri. Bkz. [ROADMAP.md](ROADMAP.md).

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

## Destek ol

Fly Dock ücretsiz ve açık kaynaklıdır. İşine yaradıysa geliştirmeyi [Ko-fi](https://ko-fi.com/PLACEHOLDER) üzerinden destekleyebilirsin.

## Lisans

GPL-3.0-only — bkz. [LICENSE](LICENSE). Telif © 2026 Fatih Erdem.

Kod serbestçe kullanılabilir ve değiştirilebilir. "Fly Dock" adı ve logo lisansın parçası değildir: resmî sürümü belirtir. Değiştirilmiş bir sürüm yayımlarsan başka bir ad ve logo kullan, telif notlarını koru ve değiştirildiğini belirt — ayrıntılar [NOTICE](NOTICE) dosyasında.
