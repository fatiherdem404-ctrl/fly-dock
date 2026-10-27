# RocketDock Pro — Durum Raporu (2026-10-27)

## Çalışıyor mu?
- `npm run typecheck` temiz (renderer + electron).
- `npm run dev` hatasız açılıyor (Vite + Electron derleniyor, uyarı/hata yok). Pencerenin görsel/etkileşim testi yapılmadı.
- Lint, test, git deposu yok. Klasörde `{electron,src` adında hatalı bir boş/artık klasör var (silinebilir).

## Neler var
| Alan | Durum |
|---|---|
| Magnification | Var: cosine falloff, `Dock.tsx`. **Sorun:** her mousemove'da pencere boyutu `setBounds` ile IPC üzerinden değişiyor → titreme/gecikme riski. Doğrusu: pencereyi sabit (max boyut) tutup sadece içeriği çizmek |
| Running-app tespiti | Var ama zayıf: her 1.5 sn'de yeni `powershell.exe` açıyor (CPU/pil, AV alarmı). Sadece exe başına tek pencere. UWP/Store uygulamaları eksik. README "node-window-manager" diyor, kod PowerShell — README yanlış |
| İkon çıkarma | Var: `ExtractAssociatedIcon` (32px, büyüyünce bulanık), disk cache var. `.lnk` hedefi çözülmüyor, hata yakalama yok (ikon bulunamazsa promise reddi) |
| Ayarlar | Sadece store'da. Ayarlar paneli UI yok, tray menüsü olay gönderiyor ama renderer dinlemiyor. Auto-hide checkbox'ı var ama işlevsiz |
| Konumlandırma | 4 kenar var, ama sadece birincil monitör; `display-metrics-changed` var. Pencere boyutu değişince merkez kayması olabilir |
| Menü / ekleme | Sağ tık: program ekle, ayraç, simge değiştir, kaldır (Türkçe). Sürükle-bırak yok, sıralama yok |
| Çöp kutusu | Sadece görsel, tıklayınca bir şey olmuyor |
| Tema | Tek CSS tema (glass-dark) |
| Diğer | Aktifleştirme/minimize yine PowerShell, tıklamada 150-300 ms gecikme. Proje bağımlılığı `electron-store` 8 (CJS) |

## Mimari değerlendirme
Küçük (≈1000 satır), temiz ve okunur; ayrım (main / preload / renderer, tipli IPC) doğru. **Devam edilebilir**, yeniden başlamaya gerek yok. Ama çekirdek iki karar baştan değişmeli, bunlar "yeniden yazma" değil modül değişimi:
1. **Pencere yönetimi:** PowerShell yerine tek bir uzun yaşayan yardımcı süreç (küçük bir C#/.NET veya Rust exe; WinEvent hook ile olay tabanlı) ya da `koffi` gibi native-derlemesiz FFI ile user32. Polling kalkar, ikonlar (SHGetFileInfo / büyük ikon), çöp kutusu durumu, UWP, çok pencere hepsi aynı yardımcıya eklenir.
2. **Dock penceresi:** sabit boyutlu, tam şeffaf, click-through bölgeli pencere (`setIgnoreMouseEvents(true, {forward:true})`), içerik animasyonu rAF/spring ile.

Ayrıca yarım kalan: auto-hide, ayarlar UI, sıralama/sürükle-bırak.

## Önerilen v1 kapsamı (8 madde)
1. Native yardımcı süreç (pencere olayları, büyük ikon, çöp kutusu, UWP) — **L**
2. Sabit pencere + akıcı magnification/spring + click-through — **M**
3. Sürükle-bırak ekleme/sıralama/çıkarma (exe, lnk, klasör, dosya) — **M**
4. Ayarlar penceresi (boyut, konum, zoom, tema, başlangıçta çalıştır) — **M**
5. Auto-hide + kenar tetik + tam ekran uygulama davranışı — **M**
6. Çok monitör (monitör seçimi, DPI, çoklu dock) + Win11 uyumu (görev çubuğu, Mica/acrylic arka plan) — **M-L**
7. JSON tema sistemi + 2-3 hazır tema + ikon paketi — **M**
8. Yığınlar/klasör (stack) ve global kısayollar — **M** (widget'lar v2'ye)

Toplam kabaca 4-6 hafta yarı zamanlı.

## Açık kaynak hazırlığı — eksikler
- **Lisans:** `package.json`'da `UNLICENSED/private`. GPLv3 ekle (LICENSE dosyası + `license` alanı). Ticari kopyayı engellemek istiyorsan GPLv3 uygun; bağışla gelir için MIT de olur ama kapalı fork riski var.
- **Git deposu yok:** `git init`, GitHub'a depo, `.gitignore` tamam (`build/` hariç tutulmalı mı kontrol et).
- **README:** İngilizce ana + Türkçe; ekran görüntüsü/GIF, kurulum, yol haritası, düzeltilmiş mimari (node-window-manager ifadesi yanlış).
- **Eksik dosyalar:** CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR şablonları, CHANGELOG, `build/icon.ico` (electron-builder bunu bekliyor, yok), CI (GitHub Actions: typecheck + build).
- **Bağış:** `.github/FUNDING.yml` (GitHub Sponsors ve/veya Ko-fi), README rozeti, uygulama içinde "Destek ol" bağlantısı. Türkiye'den Sponsors hesabı kısıtlı olabilir; Ko-fi/Buy Me a Coffee daha kolay.
- **Ad:** "RocketDock Pro" mevcut markaya benziyor, hukuki/arama sorunu çıkarabilir; özgün isim önerilir (klasör adı `wi-dock` zaten alternatif).
- **Dağıtım:** kod imzalama yok (SmartScreen uyarısı), otomatik güncelleme yok.

## Karar bekleyen sorular
1. Devam mı (önerim) yoksa sıfırdan mı?
2. Native yardımcı: C#/.NET exe mi, Rust mu, `koffi` mi? (Önerim C# — hızlı yazılır, Windows'ta hazır.)
3. v1 kapsamı: yukarıdaki 8 madde uygun mu, çıkarılacak/eklenecek var mı?
4. Lisans: GPLv3 mü MIT mi?
5. İsim: "RocketDock Pro" kalsın mı, yeni isim mi?
6. Bağış platformu: Ko-fi mi GitHub Sponsors mı?


## Güncel durum (2026-10-27, v1.5)
Yazılanlar ve doğrulananlar için ROADMAP.md sonundaki "v1 düzeltme turu" ve "v1.5 — Dock tamamlama" bölümlerine bak.
Otomatik kontroller: `npm test`, `npm run e2e` (19 senaryo), `npm run perf <konum>`, `node scripts/shot-page.mjs <ayarlar|stack|menu> <dosya.png>`.
Elle denenmesi gerekenler: Explorer'dan gerçek fareyle sürükle-bırak, kısayol tuşları, çok monitör, Windows ile başlat (kurulu sürüm).
