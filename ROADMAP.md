# Yol Haritası

Boyutlar: **S** ≈ 1-3 gün, **M** ≈ 1 hafta, **L** ≈ 2+ hafta (yarı zamanlı).
Kararlar: wi-dock'tan devam · C# yardımcı süreç · GPLv3 · Ko-fi · kapsamın tamamı.
Tasarım dili: koyu cam, yuvarlak köşeler, mavi vurgu (konsept görsellerden esinlenme, kopya değil). Ürün adı kesin değil.

## Faz 0 — Temel (her şeyin önkoşulu)
| # | Madde | Boyut | Bağımlılık |
|---|---|---|---|
| 0.1 | Git deposu, GPLv3, `FUNDING.yml` (Ko-fi), README düzeltmesi, `icon.ico`, CI (typecheck + build) | S | — |
| 0.2 | C# yardımcı süreç (`helper.exe`): stdin/stdout JSON-RPC, WinEvent ile pencere olayları, büyük ikon (SHGetFileInfo), `.lnk` çözme, çöp kutusu durumu | L | 0.1 |
| 0.3 | Dock penceresi yeniden: sabit boyut, click-through, rAF/spring magnification | M | — |
| 0.4 | Tip güvenli IPC + ayar/öğe şeması (sürümlü, göç edilebilir) | S | — |

## v1 — Dock + Widget + Tema/İkon paketleri + Ayarlar
| # | Madde | Boyut | Bağımlılık |
|---|---|---|---|
| 1.1 | Sürükle-bırak ekle/sırala/kaldır, `.lnk`/klasör/dosya, çöp kutusu işlevi | M | 0.2, 0.3 |
| 1.2 | Ayarlar penceresi (Dock, Tema, İkon, Widget, Genel sekmeleri, başlangıçta çalıştır) | M | 0.4 |
| 1.3 | Auto-hide, kenar tetik, tam ekran davranışı | M | 0.3 |
| 1.4 | Çok monitör + DPI + Win11 uyumu (Mica/acrylic, görev çubuğu çakışması) | L | 0.3, 1.2 |
| 1.5 | Stack / klasör açılır menüsü, global kısayollar | M | 1.1 |
| 1.6 | Widget altyapısı + saat, hava, CPU/RAM/disk, medya (SMTC), takvim | L | 0.2, 1.2 |
| 1.7 | JSON tema paketi (renk, cam, dock stili, köşe, yazı tipi) + 3 hazır tema, yerel içe/dışa aktarma (`.zip`) | M | 1.2 |
| 1.8 | İkon paketi (uygulama→ikon eşleşmesi, klasör), yerel içe/dışa aktarma | M | 0.2, 1.7 |
| 1.9 | Paket doğrulama (şema, boyut sınırı, yol kaçışı engeli) | S | 1.7 |

**v1 sürümü:** 0.x + 1.1-1.9. Burada yayınla, bağış bağlantısı açık olsun.

## v2 — Duvar kağıdı, canlı arka plan, ses
| # | Madde | Boyut | Bağımlılık |
|---|---|---|---|
| 2.1 | Statik duvar kağıdı yönetimi (`SystemParametersInfo`, monitör başına, slayt) | M | 0.2, 1.2 |
| 2.2 | Canlı arka plan (masaüstü katmanına WorkerW ile video/HTML, pil/oyunda duraklat) | L | 2.1 |
| 2.3 | Ses paketi (dock/uygulama sesleri; Windows sistem seslerini değiştirmek ayrı, kullanıcı onaylı) | M | 1.7 |
| 2.4 | Tema paketi genişlemesi: duvar kağıdı + ses + ikon paketini tek pakette birleştir | S | 2.1, 2.3 |

## v3 — Topluluk paketleri
| # | Madde | Boyut | Bağımlılık |
|---|---|---|---|
| 3.1 | GitHub tabanlı paylaşım: paket deposu (index JSON), uygulama içi göz at/indir, imza yerine hash | M | 1.9, 2.4 |
| 3.2 | Paket gönderme akışı (PR şablonu, otomatik doğrulama CI) | M | 3.1 |
| 3.3 | Mağaza arayüzü (arama, kategori, puan yerel) | M | 3.1 |
| 3.4 | Sunucu/hesap/puan/ücretli paket — **en son**, ancak talep olursa | L | 3.3 |

## v4 — Kendi dosya gezgini (isteğe bağlı, en son)
Windows'un varsayılan gezgini **değiştirilmez**; sadece "klasörü bizim gezginle aç" seçeneği ve dock/yığından açma olur. Sistem pencerelerine (Gezgin, Başlat, görev çubuğu) dokunulmaz; yalnızca kendi pencerelerimizin şeffaflığı ve Mica/Acrylic kullanılır.
| # | Madde | Boyut | Bağımlılık |
|---|---|---|---|
| 4.1 | **Risk kapısı:** C# yardımcıda `IContextMenu` prototipi (bir dosyada Windows sağ tık menüsünü gösterip komut çalıştırma). Olmazsa v4 iptal | M | 0.2 |
| 4.2 | Gezgin çekirdeği: klasör listesi, gezinme, sekmeler, bölünmüş panel | L | 4.1 |
| 4.3 | Ön izleme paneli, hızlı arama, etiketler | L | 4.2 |
| 4.4 | Dock/stack entegrasyonu ("klasörü bizim gezginle aç") | S | 4.2, 1.5 |

**Riskler (açık yazıyorum):**
- Asıl zor kısım sağ tık menüsü: kabuk eklentilerinin (`IContextMenu`) COM ile doğru çağrılması, 3. parti eklenti çökmeleri ve yavaş yükleme. Bu yüzden 4.1 önce, tek başına prototip olarak yapılır.
- Prototip başarısız olursa v4 tamamen kaldırılır; 4.2-4.4 hiç başlanmaz. Kayıp en fazla 4.1'in emeğidir ("beceremiyoruz, kaldırırız").
- Dosya gezgini büyük bir ürün: kopyala/taşı/sil, ağ yolları, uzun yollar, geri alma gibi çok kenar durum var. Veri kaybı riski için silme önce çöp kutusuna ve onayla yapılmalı.
- Sistem gezgini değiştirilmediği için sistem kararlılığı ve antivirüs riski düşüktür; yine de yardımcı süreç imzalanmalı.

## Sıralama özeti
0.1 → 0.4 / 0.3 → 0.2 → 1.1, 1.2 → 1.3-1.9 → **v1 yayın** → 2.x → 3.x → 4.1 (risk kapısı) → 4.2-4.4
Kritik yol: **0.2 (C# yardımcı)** — widget, çöp kutusu, ikon, duvar kağıdı ve 4.1 hepsi buna yaslanıyor.
