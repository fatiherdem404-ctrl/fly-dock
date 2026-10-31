# Simge adları (kendi simge paketini tasarlamak için)

Bir simge paketi, **anahtar adı → resim dosyası** eşlemesinden ibarettir. Dock bir öğe için simge ararken aşağıdaki
anahtarlara bakar; pakette karşılığı yoksa o öğe Windows'un kendi simgesini kullanır, yani listenin hepsini çizmek zorunda değilsin.

## Dosya biçimi

- **PNG, 256×256 piksel, saydam arka plan** önerilir (kare; kenarlarda küçük bir boşluk bırak, dock büyütürken kesilmesin). `.ico`, `.svg`, `.jpg`, `.webp` de olur.
- Bir resim en fazla 8 MB; paket en fazla 50 MB.
- Anahtar adları **küçük harf**, yalnızca `a-z 0-9 . _ -` karakterleri. Türkçe harf (ü, ş, ı…) kullanma.

## Paketi nasıl yaparsın

**Kolay yol (Ayarlar → Simge paketleri → Paket oluştur):** Resimlerini aşağıdaki anahtar adlarıyla adlandır
(ör. `trash.png`, `trash-full.png`, `mycomputerfolder.png`, `notepad.png`) ve tek klasöre koy. "Adlarına göre klasörden dağıt…"
düğmesiyle klasörü seç; her resim kendi anahtarına yerleşir. Sonra paket adını yaz, "Paketi oluştur ve kullan".

**Elle (.flypack):** Bir zip dosyası; uzantısı `.flypack`. İçinde:

```
pack.json     {"type":"icons","id":"benim-paketim","name":"Benim paketim","author":"Ben","version":"1.0"}
icons.json    {"map":{"trash":"icons/trash.png","trash-full":"icons/trash-full.png","notepad":"icons/notepad.png"}}
icons/        resimler
```

`id`: 2-41 karakter, küçük harf, rakam, tire. Paketi Ayarlar → Simge paketleri → "Paket içe aktar" ile yüklersin.

## Dock'un kendi öğeleri

| Anahtar | Ne için |
|---|---|
| `start` | Başlat düğmesi |
| `wheel` | Kontrol paneli öğesi (dock'taki) |
| `power` | Güç menüsü öğesi |
| `group` | Grup öğesi |
| `trash` | Geri dönüşüm kutusu (boş) |
| `trash-full` | Geri dönüşüm kutusu (dolu) |
| `folder` | Her klasör ve yığın (özel adı olmayanlar) |
| `file` | Simgesi bulunamayan dosyalar |

## Bilinen yerler

| Anahtar | Ne için |
|---|---|
| `mycomputerfolder` | Bilgisayarım |
| `profile` | Kullanıcı klasörüm |
| `networkplacesfolder` | Ağ |
| `desktop` | Masaüstü klasörü |
| `documents` (ve `belgeler`) | Belgelerim |
| `downloads` (ve `indirilenler`) | İndirilenler |
| `pictures` (ve `resimler`) | Resimler |
| `videos` (ve `videolar`) | Videolar |
| `music` | Müzik |

Bir klasör bu adlardan biriyle bitiyorsa (ör. `C:\Users\Ali\Documents`) kendi simgesini alır, yoksa `folder` kullanılır.

## Programlar

Bir programın anahtarı, **exe dosyasının adıdır (uzantısız, küçük harf)**. Örnek: `C:\Windows\notepad.exe` → `notepad`,
`chrome.exe` → `chrome`. İstediğin her programa böyle simge verebilirsin; aşağıdakiler hazır pakette tanımlı olanlardır:

`notepad`, `calc`, `mspaint`, `explorer`, `cmd`, `powershell`, `wt` (Windows Terminal), `taskmgr`, `regedit`, `snippingtool`,
`mstsc` (Uzak Masaüstü), `control` (Denetim Masası), `wmplayer`, `soundrecorder`, `mmc`, `charmap`, `magnify`.

## Kontrol paneli menüsündeki araçlar

Anahtar `wheel-` ile başlar:

| Anahtar | Araç |
|---|---|
| `wheel-apps` | Programlar ve Özellikler |
| `wheel-system` | Sistem özellikleri |
| `wheel-power` | Güç seçenekleri |
| `wheel-datetime` | Tarih ve saat |
| `wheel-mouse` | Fare |
| `wheel-controlpanel` | Denetim Masası |
| `wheel-sound` | Ses |
| `wheel-display` | Ekran |
| `wheel-bluetooth` | Bluetooth |
| `wheel-devices` | Aygıt Yöneticisi |
| `wheel-network` | Ağ bağlantıları |
| `wheel-wifi` | Wi-Fi |
| `wheel-apps-settings` | Uygulamalar (Ayarlar) |
| `wheel-personalize` | Kişiselleştirme |
| `wheel-startup` | Başlangıç uygulamaları |
| `wheel-storage` | Depolama |
| `wheel-taskmgr` | Görev Yöneticisi |
| `wheel-disks` | Disk Yönetimi |
| `wheel-services` | Hizmetler |
| `wheel-events` | Olay Görüntüleyici |
| `wheel-computer` | Bilgisayar Yönetimi |

Kendi eklediğin dosya ve klasörlerin simgesini pakette değil, kontrol paneli sayfasındaki simge düğmesiyle tek tek verirsin.

## İpuçları

- Öncelik sırası: öğeye elle seçilen simge > aktif paket > Windows simgesi.
- Çöp kutusu için iki ayrı resim çiz (`trash` ve `trash-full`); dock doluluk durumuna göre değiştirir.
- Hazır paketleri (Fly Windows 11, Fly 3B) "Dışa aktar" ile kaydedip içindeki `icons.json` ve resimlere bakabilirsin.
