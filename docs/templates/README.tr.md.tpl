<!-- docs/templates/README.tr.md.tpl ve src/config/brand.config.json dosyalarından `npm run brand:render` ile üretilir. Elle düzenleme. -->
# {{name}}

{{tagline.tr}} — {{description.tr}}

[English](README.md) · [Sorunlar]({{issuesUrl}}) · [Ko-fi'de destek ol]({{kofiUrl}})

> Durum: erken geliştirme (Faz 0). Henüz günlük kullanıma uygun değil.

![Ekran görüntüsü yer tutucusu](docs/screenshot.png)

## Özellikler

Şu an çalışan (iskelet):

- Şeffaf, her zaman üstte dock penceresi (alt/üst/sol/sağ)
- Üzerine gelince büyütme (cosine falloff)
- Çalışan uygulama göstergesi (şimdilik PowerShell ile yoklama)
- `.exe` ikonunu otomatik çıkarma, disk önbelleği ve elle değiştirme
- Kalıcı ayarlar (`electron-store`)

Planlananlar: sürükle-bırak, ayarlar penceresi, otomatik gizleme, çok monitör, widget'lar, JSON temalar, ikon paketleri, duvar kağıtları, ses paketleri. Bkz. [ROADMAP.md](ROADMAP.md).

## Başlarken

Node.js ve Windows 10/11 gerekir. Derleme araçları gerekmez.

```bash
npm install
npm run dev
```

Faydalı komutlar: `npm run typecheck`, `npm run brand:check`, `npm run brand:render`, `npm run build`.

## Mimari

```
electron/   ana süreç: dock penceresi, tepsi, IPC, store, windowManager (PowerShell + user32.dll),
            iconExtractor (PowerShell + System.Drawing). PowerShell çağrılarının yerini bir C#
            yardımcı süreç alacak (ROADMAP.md, madde 0.2).
src/        arayüz (React): Dock, DockIcon, Separator, stiller
src/config/brand.config.json   ad, kimlikler, bağlantılar ve logo yolları için tek kaynak
scripts/    marka denetimi ve doküman üretimi
```

Ad, uygulama kimliği, bağlantılar, tepsi metni, pencere başlığı, kurulum dosyası adı ve bu belgeler `src/config/brand.config.json` dosyasından gelir. Değişikliği orada yap, `npm run brand:render` çalıştır; başka yerde sabit yazılmış bir şey kalırsa `npm run brand:check` söyler.

## Destek ol

{{name}} ücretsiz ve açık kaynaklıdır. İşine yaradıysa geliştirmeyi [Ko-fi]({{kofiUrl}}) üzerinden destekleyebilirsin.

## Lisans

{{license}} — bkz. [LICENSE](LICENSE). Telif © {{copyrightYear}} {{company}}.
