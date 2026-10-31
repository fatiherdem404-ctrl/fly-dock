| ✅ 1.9 || ✅ 1.8 || ✅ 1.7 || ✅ 1.6 || ✅ 1.5 || ✅ 1.4 || ✅ 1.3 || ✅ 1.2 || ✅ 1.1 || ✅ 0.4 || ✅ 0.3 || ✅ 0.2 |# Yol Haritası

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

## Durum notu (v1 kodu yazıldı)
v1 maddelerinin hepsi kodlandı. Çalıştırılıp doğrulananlar: C# yardımcı (pencere olayları, büyük ikonlar, çöp kutusu), büyütme, sağ tık menüsü, ayarlar penceresi, 5 widget (hava durumu canlı veriyle), akrilik arka plan, tam ekranda gizleme, paket doğrulama testleri (`npm test`).
Elle denenmesi gerekenler (otomatik test edilemedi): dosya sürükle-bırak ile ekleme ve sıralama, simgeyi dışarı atarak kaldırma, yığın penceresi, otomatik gizleme kenar tetiği, çok monitör, global kısayollar.
Bilinen sınırlar: medya widget'ı şarkı adını sadece Spotify/VLC gibi oynatıcıların pencere başlığından okur (Windows medya oturumu için WinRT paketi indirmek gerekir); UWP uygulamaları dock'a sabitlenemez; kurulum paketi .NET çalışma zamanı gerektirir (self-contained paket için NuGet indirmesi gerekecek).

## v1 düzeltme turu (kullanıcı denemesi sonrası)
Bulunan ve düzeltilenler: ikonlar dikey ters çiziliyordu (kabuk bitmap'i alttan üste okunuyordu, GetDIBits ile düzeltildi); yardımcı süreçteki WinForms zamanlayıcıları hiç çalışmıyordu, bu yüzden pencere olayları, çalışan uygulama göstergesi ve tam ekranda gizleme gerçekte çalışmıyordu (iş parçacığı zamanlayıcılarıyla değişti); zemin düz kutuydu ve ikonlarla uyumsuzdu (akrilik varsayılan, raf ikonlarla birlikte genişleyip kalınlaşıyor); animasyon kritik sönümlü yaya geçti; eski yapılandırma dosyalarının taşınması çalışmıyordu.
Yeni: çalışan ama sabitlenmemiş programlar ayraçtan sonra geçici simge olarak görünür ("Dock'ta tut" ile sabitlenir).
Otomatik kontroller: `npm test` (paket doğrulama, fizik), `npm run e2e` (14 uçtan uca senaryo), `npm run perf <konum>` (kare süresi, titreme, taşma; 4 konumda geçiyor).
Hâlâ elle denenmesi gereken: gerçek fareyle dosya sürükle-bırak (Explorer'dan), kısayol tuşları, çok monitör.

## v1.5 — Dock tamamlama
| # | Madde | Durum |
|---|---|---|
| ✅ 1.5.1 | Tek dock: ikinci başlatma yenisini açmaz, ayarlar penceresini öne getirir (e2e ile doğrulandı). Windows ile başlat: kurulu sürümde çalışır, geliştirme çalıştırmasında kapalı gösterilir | tamam |
| ✅ 1.5.2 | Konum: 4 kenar seçici, kenara uzaklık ve kenar boyunca yer kaydırıcıları, monitör seçimi (e2e ile pencere konumu doğrulandı) | tamam |
| ✅ 1.5.3 | Büyüme ayarları: simge boyutu, en büyük ölçek, yayılma, 4 etki eğrisi, simge aralığı; raf büyümesi ve raf kalınlığı ayrı | tamam |
| ✅ 1.5.4 | Animasyon kütüphanesi: hız (hızlı/orta/yavaş/özel), hareket tipi, fare üzerine (büyüme/yükselme/dalga), başlatma (sıçrama/atlama/ışık atımı), gösterge stili (4), dock giriş/çıkış (3), pencere açılış (4) | tamam |
| ✅ 1.5.5 | Dock pencereleri: klasör yığını ve uygulama grubu; boyut küçük/orta/tam ekran/özel; kaydırma ve temalı kaydırma çubuğu; simgeden büyüyerek açılma, kapanma; Esc ve dışarı tıklama | tamam |
| ✅ 1.5.6 | Bağlam menüsü: cam stilli kendi penceresi, her satırda ikon, açılış animasyonu | tamam |
| ✅ 1.5.7 | Raf kütüphanesi: 10 stil (düz cam, 3B cam, ahşap, metal, mermer, neon, kristal, mat siyah, yansımalı, tuğla), renk, saydamlık, 3B derinlik, önizleme kartları | tamam |
| ✅ 1.5.8 | Ayarlar arayüzü baştan: kartlı bölümler, canlı önizleme, animasyonlu geçişler, tutarlı jetonlar | tamam |
| ✅ 1.5.9 | Ek ayarlar: etiket modu/boyut/yazı tipi, kilitle, tam ekranda gizle, çalışan program göstergesi, yedekle/geri yükle, kısayol tuşları | tamam |

Sınırlar: akrilik/Mica ayrı bir sistem penceresi olduğu için sabit durur (tema rafı simgelerle birebir hareket eder). Raf stillerinin 3B görünümü CSS perspektifidir, gerçek 3B değildir.

## Yeni fikirler (wi-dock-ozellikler.md, 2026-10-31)
| # | Madde | Durum |
|---|---|---|
| ✅ N.1 | Taşma/kesilme: pencere boyutu tek hesaptan (ikon × büyütme + etiket + raf + boşluklar), 4 kenar, DPI %100/125/150/200 ölçüldü; ekrandan uzun dock otomatik küçülür | tamam |
| ✅ N.2 | Raf boşlukları: üst/alt/sol/sağ ayrı, "hepsini bağla", canlı önizleme | tamam |
| ✅ N.3 | Konsept farkı belgesi ve yan yana karşılaştırma (docs/konsept-farki.md), palet ve hap raf | tamam |
| ✅ N.4 | Çark menüsü (madde 7): sabit katalog, arama, görünürlük ve sıralama, yalnızca listedeki komutlar | tamam |
| ✅ N.5 | Güç menüsü (madde 6): tam ekran, kilitle/uyku/oturumu kapat/yeniden başlat/kapat, ikinci tıklama onayı. Karşılama animasyonu ve kilit ekranı görseli yok | kısmen |
| ✅ N.6 | WI Tweaks çekirdeği (madde 10): 7 HKCU ayarı, eski değeri saklayıp geri yükler, günlük, hepsini geri al | tamam |
| ✅ N.7 | Tweaks: yönetici gerektirenler (kısayol oku, hazırda bekletme), geri yükleme noktası, ayrı yükseltilmiş yardımcı (UAC Windows'tan gelir). Hizmetler (SysMain, telemetri) hâlâ yok | kısmen |
| ⏳ | Tema paketine duvar kağıdı/imleç/ses şeması, `.theme` yöneticisi (madde 1) | v2 ile |
| ⏳ | DWM efektleri, AppBar çubuğu ve tepsi ikonları (madde 3, 5) | bekliyor: sistem pencerelerine dokunma kararı |
| ⛔ | Gelişmiş Tema Desteği / SecureUxTheme (madde 4) | kullanıcı onayı yok, sistem dosyalarını yamar |
| ⏳ | Toys / sanal evcil hayvan (madde 9), WI Explorer (madde 8), plugin API | büyük, ayrı proje |

## Ayar sekmeleri, klasör penceresi, çark, simge paketi, ses (2026-10-31)
- Ayar sayfalarındaki gruplar alt sekme oldu (seçim hatırlanır); "Rafsız" stili; Mavi çerçeve ayrı görünüm.
- Klasör/grup penceresi: Explorer önizlemesi (resim, video, PDF), görünüm menüsü (çok büyük → ayrıntılar), sıralama (ad, tarih, boyut, tür; artan/azalan).
- Çark menüsü: program/dosya/klasör ekle-kaldır, her girdiye kendi simgesi.
- Simge paketi oluşturucu: öğelere resim ata ya da klasörden dağıt, `.flypack` olarak kaydet.
- Sesler: dosyasız, anında üretilen 5 stil (yumuşak, cam, ahşap, retro, baloncuk); 20 olay (cin pencere açılış/kapanış, hover, tıklama, açılış, bırakma, silme, çöp boşaltma, menü, onay…); grup grup aç/kapa, ses düzeyi, "Dene" sekmesi.
- Kendi onay penceremiz (`electron/confirm.ts`, `ConfirmView`): çöp boşaltma, yedek geri yükleme, tüm tweakleri geri alma, paket silme.
- Fikir: sesleri `.flypack` temalarına koymak (kullanıcı ses dosyası), geçiş sesi için "bildirim" olayı widget'larda henüz kullanılmıyor.

## Tek pencere stili ve bağlam menüleri (2026-10-31)
- Klasör, grup ve çark penceresi artık tek bileşen (`DockWindow`): temadan boyanan çerçeve, başlık çubuğu, sağda X ile kapat düğmesi, araç çubuğu, kaydırılan gövde.
- Pencere içindeki öğelere sağ tık menüsü (Windows gibi): Aç, Konumunu aç, Dock'a ekle, Yolu kopyala, Yeniden adlandır, Gruptan çıkar, Sil (geri dönüşüm kutusuna). Çark girdilerinde: Aç, Simge değiştir, Yeniden adlandır, Gizle/Kaldır.
- Kendi metin girişi penceresi (yeniden adlandırma) ve onay penceresi; menü ya da soru açılınca dock penceresi kapanmaz.
- Test: `node scripts/check-entry-menu.mjs` (adlandırma, çakışan ad, silme, listede olmayan yol).

## Gerçek dokulu raflar (2026-10-31)
- Ahşap, açık ahşap, ceviz, mermer, siyah mermer, fırçalı metal, beton ve tuğla rafları gerçek CC0 fotoğraf dokularıyla (ambientCG, `docs/textures.md`); üstüne yalnızca ışık/gölge katmanı çizilir, ön yüz aynı malzemenin gölgedeki hâli.
- Temalar raf taşıyabilir (`desk` bloğu + `desk-texture.*`); hazır temaların kendi rafı var.
