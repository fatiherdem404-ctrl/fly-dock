import type { IconName } from '@/icons'

export type Tab = 'dock' | 'desk' | 'theme' | 'wallpaper' | 'icons' | 'studio' | 'cursors' | 'motion' | 'windows' | 'sound' | 'items' | 'wheel' | 'widgets' | 'toys' | 'tweaks' | 'general'

export interface TabInfo {
  id: Tab
  label: string
  icon: IconName
  /** One line under the page title. */
  blurb: string
}

/** The icon studio is a tool for building the default icon pack; it only exists in development builds. */
export const STUDIO = !!(import.meta.env.DEV || import.meta.env.VITE_STUDIO)

export const TAB_INFO: Record<Tab, TabInfo> = {
  dock: { id: 'dock', label: 'Dock', icon: 'dock', blurb: 'Yeri, simgeleri, etiketleri ve davranışı' },
  desk: { id: 'desk', label: 'Zemin ve raf', icon: 'desk', blurb: 'Simgelerin durduğu raf: malzeme, derinlik, köşeler' },
  theme: { id: 'theme', label: 'Temalar', icon: 'theme', blurb: 'Renkler, cam, yazı tipi ve eşlik eden raf ile arka plan' },
  wallpaper: { id: 'wallpaper', label: 'Duvar kâğıdı', icon: 'image', blurb: 'Canlı arka planlar, resim, video ve slayt' },
  icons: { id: 'icons', label: 'Simge paketleri', icon: 'pack', blurb: 'Programların simgelerini toplu değiştir' },
  studio: { id: 'studio', label: 'İkon stüdyosu', icon: 'edit', blurb: 'Geliştirme sürümüne özel: kart, renk ve derinlikle kendi simge paketini tasarla' },
  cursors: { id: 'cursors', label: 'İmleçler', icon: 'cursor', blurb: 'Fare imleçlerini bir paketle değiştir' },
  motion: { id: 'motion', label: 'Animasyonlar', icon: 'motion', blurb: 'Hız, hareket, açılış ve pencere efektleri' },
  windows: { id: 'windows', label: 'Dock pencereleri', icon: 'window', blurb: 'Klasör, grup ve kontrol paneli penceresinin boyutu ve yeri' },
  sound: { id: 'sound', label: 'Sesler', icon: 'sound', blurb: 'Tıklama, açılış ve pencere sesleri' },
  items: { id: 'items', label: 'Öğeler', icon: 'items', blurb: 'Dock’taki programlar ve kısayolları' },
  wheel: { id: 'wheel', label: 'Kontrol paneli', icon: 'controlpanel', blurb: 'Windows ayarlarına ve araçlarına hızlı erişim listesi' },
  widgets: { id: 'widgets', label: 'Widget’lar', icon: 'widgets', blurb: 'Saat, takvim, hava durumu ve daha fazlası; temana uyumlu' },
  toys: { id: 'toys', label: 'Mini oyunlar', icon: 'toys', blurb: 'Masaüstünde oynanan basketbol, futbol, sektirme ve pong' },
  tweaks: { id: 'tweaks', label: 'Tweaks', icon: 'tools', blurb: 'Güvenli, geri alınabilir Windows ayarları' },
  general: { id: 'general', label: 'Genel', icon: 'general', blurb: 'Başlangıç, yedek ve hakkında' },
}

export const NAV_GROUPS: { title: string; tabs: Tab[] }[] = [
  { title: 'Görünüm', tabs: ['dock', 'desk', 'theme', 'wallpaper', 'icons', ...(STUDIO ? (['studio'] as Tab[]) : []), 'cursors'] },
  { title: 'Davranış', tabs: ['motion', 'windows', 'sound'] },
  { title: 'İçerik', tabs: ['items', 'wheel', 'widgets', 'toys'] },
  { title: 'Sistem', tabs: ['tweaks', 'general'] },
]

/** Pages that show the live dock preview strip above them. */
export const PREVIEW_TABS: Tab[] = ['dock', 'desk', 'motion']

/** What the search box can jump to: a label, the page, and the sub-tab (a card group) that holds it. */
export interface SearchEntry {
  label: string
  tab: Tab
  sub?: string
  words?: string
}

const e = (label: string, tab: Tab, sub?: string, words = ''): SearchEntry => ({ label, tab, sub, words })

export const SEARCH_INDEX: SearchEntry[] = [
  e('Dock konumu (alt, üst, sol, sağ)', 'dock', 'Konum', 'kenar yer position'),
  e('Kenardan uzaklık', 'dock', 'Konum', 'boşluk offset'),
  e('Yatay yer / hizalama', 'dock', 'Konum', 'ortala alignment'),
  e('Monitör seçimi', 'dock', 'Konum', 'ekran çoklu monitor display'),
  e('Simge boyutu', 'dock', 'Simgeler', 'icon size'),
  e('Fareyle büyüme', 'dock', 'Simgeler ve büyüme', 'magnification zoom büyüt'),
  e('Simge aralığı', 'dock', 'Simgeler ve büyüme', 'spacing boşluk'),
  e('Ayraç görünümü, kalınlık, renk', 'dock', 'Ayraç', 'separator çizgi'),
  e('Etiketler (ad yazıları)', 'dock', 'Etiketler', 'label yazı font'),
  e('Otomatik gizle', 'dock', 'Davranış', 'autohide gizle'),
  e('Simgeleri kilitle', 'dock', 'Davranış', 'lock'),
  e('Çalışan uygulamaları göster', 'dock', 'Davranış', 'running'),
  e('Dock katmanı (üstte, altta)', 'dock', 'Davranış', 'layer pencere üstünde'),
  e('Raf stili (ahşap, mermer, cam…)', 'desk', 'Raf', 'desk style malzeme'),
  e('Raf rengi, saydamlık, derinlik', 'desk', 'Raf', 'opacity depth 3b'),
  e('Raf dokusu, özel resim', 'desk', 'Doku', 'texture'),
  e('Köşe yuvarlaklığı', 'desk', 'Şekil', 'radius'),
  e('Raf boşlukları', 'desk', 'Şekil', 'padding'),
  e('Tema seç', 'theme', 'Temalar', 'renk cam dark light'),
  e('Tema oluştur', 'theme', 'Tema oluştur', 'builder renk seç dışa aktar'),
  e('Tema içe / dışa aktar', 'theme', 'Temalar', 'import export flypack'),
  e('Duvar kâğıdı modu', 'wallpaper', 'Kaynak', 'arka plan wallpaper'),
  e('Canlı arka plan', 'wallpaper', 'Kaynak', 'aurora yıldız dalga baloncuk video'),
  e('Klasörden slayt', 'wallpaper', 'Kaynak', 'spotlight değişen'),
  e('Duvar kâğıdı davranışı (pil, tam ekran)', 'wallpaper', 'Davranış', 'durdur'),
  e('Simge paketi seç', 'icons', 'Paketler', 'icon pack'),
  e('Simge paketi oluştur', 'icons', 'Paket oluştur', 'rocketdock'),
  e('İmleç paketi', 'cursors', 'Paketler', 'cursor fare mouse imleç ok el'),
  e('Hız ve hareket tipi', 'motion', 'Hız', 'speed'),
  e('Fare üzerine gelme animasyonu', 'motion', 'Simge efektleri', 'hover'),
  e('Uygulama başlatma animasyonu', 'motion', 'Simge efektleri', 'launch zıpla'),
  e('Çalışan uygulama göstergesi', 'motion', 'Simge efektleri', 'indicator nokta'),
  e('Dock giriş çıkış efekti', 'motion', 'Dock ve pencereler', 'show'),
  e('Pencere efekti (cin)', 'motion', 'Dock ve pencereler', 'genie'),
  e('Pencere boyutu', 'windows', 'Pencereler', 'size'),
  e('Pencere açılış konumu', 'windows', 'Pencereler', 'placement'),
  e('Sesleri aç, ses düzeyi, stil', 'sound', 'Sesler', 'volume'),
  e('Hangi olaylarda ses çalsın', 'sound', 'Sesler', ''),
  e('Sesleri dene', 'sound', 'Dene', 'test'),
  e('Dock’taki öğeler, kısayollar', 'items', undefined, 'hotkey'),
  e('Kontrol paneli girdileri', 'wheel', undefined, 'denetim masası çark ekle araçlar'),
  e('Widget ekle (analog saat, takvim, hava, not…)', 'widgets', 'Ekle', 'saat hava pil sistem medya not'),
  e('Basketbol, futbol, tenis, sektirme', 'toys', 'Oyunlar', 'oyun top pota gol seri skor serbest süreye karşı rekor'),
  e('Windows tweak’leri', 'tweaks', undefined, 'gizli dosya uzantı klasik menü'),
  e('Windows ile başlat', 'general', undefined, 'startup login'),
  e('Yedekle ve geri yükle', 'general', undefined, 'backup'),
  e('Kısayol: dock’u göster / gizle', 'general', undefined, 'hotkey'),
  e('Hakkında, Ko-fi desteği', 'general', undefined, 'sürüm destek'),
]
