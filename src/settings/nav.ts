// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import type { IconName } from '@/icons'

import { t } from '../i18n'
export type Tab = 'dock' | 'desk' | 'theme' | 'wallpaper' | 'icons' | 'studio' | 'cursors' | 'motion' | 'windows' | 'sound' | 'items' | 'wheel' | 'widgets' | 'toys' | 'tweaks' | 'general'

export interface TabInfo {
  id: Tab
  label: string
  icon: IconName
  /** One line under the page title. */
  blurb: string
}

/** The icon studio is part of every build: it makes single icons and whole icon packs. */
export const STUDIO = true

export const TAB_INFO: Record<Tab, TabInfo> = {
  dock: { id: 'dock', label: 'Dock', icon: 'dock', blurb: t('Yeri, simgeleri, etiketleri ve davranışı') },
  desk: { id: 'desk', label: t('Zemin ve raf'), icon: 'desk', blurb: t('Simgelerin durduğu raf: malzeme, derinlik, köşeler') },
  theme: { id: 'theme', label: t('Temalar'), icon: 'theme', blurb: t('Renkler, cam, yazı tipi ve eşlik eden raf ile arka plan') },
  wallpaper: { id: 'wallpaper', label: t('Duvar kâğıdı'), icon: 'image', blurb: t('Canlı arka planlar, resim, video ve slayt') },
  icons: { id: 'icons', label: t('Simge paketleri'), icon: 'pack', blurb: t('Programların simgelerini toplu değiştir') },
  studio: { id: 'studio', label: t('İkon stüdyosu'), icon: 'edit', blurb: t('Kart, renk ve derinlikle kendi simge paketini tasarla') },
  cursors: { id: 'cursors', label: t('İmleçler'), icon: 'cursor', blurb: t('Fare imleçlerini bir paketle değiştir') },
  motion: { id: 'motion', label: t('Animasyonlar'), icon: 'motion', blurb: t('Hız, hareket, açılış ve pencere efektleri') },
  windows: { id: 'windows', label: t('Dock pencereleri'), icon: 'window', blurb: t('Klasör, grup ve kontrol paneli penceresinin boyutu ve yeri') },
  sound: { id: 'sound', label: t('Sesler'), icon: 'sound', blurb: t('Tıklama, açılış ve pencere sesleri') },
  items: { id: 'items', label: t('Öğeler'), icon: 'items', blurb: t('Dock’taki programlar ve kısayolları') },
  wheel: { id: 'wheel', label: t('Kontrol paneli'), icon: 'controlpanel', blurb: t('Windows ayarlarına ve araçlarına hızlı erişim listesi') },
  widgets: { id: 'widgets', label: t('Widget’lar'), icon: 'widgets', blurb: t('Saat, takvim, hava durumu ve daha fazlası; temana uyumlu') },
  toys: { id: 'toys', label: t('Mini oyunlar'), icon: 'toys', blurb: t('Masaüstünde oynanan basketbol, futbol, sektirme ve pong') },
  tweaks: { id: 'tweaks', label: 'Tweaks', icon: 'tools', blurb: t('Güvenli, geri alınabilir Windows ayarları') },
  general: { id: 'general', label: t('Genel'), icon: 'general', blurb: t('Başlangıç, yedek ve hakkında') },
}

export const NAV_GROUPS: { title: string; tabs: Tab[] }[] = [
  { title: t('Görünüm'), tabs: ['dock', 'desk', 'theme', 'wallpaper', 'icons', ...(STUDIO ? (['studio'] as Tab[]) : []), 'cursors'] },
  { title: t('Davranış'), tabs: ['motion', 'windows', 'sound'] },
  { title: t('İçerik'), tabs: ['items', 'wheel', 'widgets', 'toys'] },
  { title: t('Sistem'), tabs: ['tweaks', 'general'] },
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
  e(t('Dock konumu (alt, üst, sol, sağ)'), 'dock', t('Konum'), t('kenar yer position')),
  e(t('Kenardan uzaklık'), 'dock', t('Konum'), t('boşluk offset')),
  e(t('Yatay yer / hizalama'), 'dock', t('Konum'), t('ortala alignment')),
  e(t('Monitör seçimi'), 'dock', t('Konum'), t('ekran çoklu monitor display')),
  e(t('Simge boyutu'), 'dock', t('Simgeler'), t('icon size')),
  e(t('Fareyle büyüme'), 'dock', t('Simgeler ve büyüme'), t('magnification zoom büyüt')),
  e(t('Simge aralığı'), 'dock', t('Simgeler ve büyüme'), t('spacing boşluk')),
  e(t('Ayraç görünümü, kalınlık, renk'), 'dock', t('Ayraç'), t('separator çizgi')),
  e(t('Etiketler (ad yazıları)'), 'dock', t('Etiketler'), t('label yazı font')),
  e(t('Otomatik gizle'), 'dock', t('Davranış'), t('autohide gizle')),
  e(t('Simgeleri kilitle'), 'dock', t('Davranış'), 'lock'),
  e(t('Çalışan uygulamaları göster'), 'dock', t('Davranış'), 'running'),
  e(t('Dock katmanı (üstte, altta)'), 'dock', t('Davranış'), t('layer pencere üstünde')),
  e(t('Raf stili (ahşap, mermer, cam…)'), 'desk', t('Raf'), t('desk style malzeme')),
  e(t('Raf rengi, saydamlık, derinlik'), 'desk', t('Raf'), t('opacity depth 3b')),
  e(t('Raf dokusu, özel resim'), 'desk', t('Doku'), 'texture'),
  e(t('Köşe yuvarlaklığı'), 'desk', t('Şekil'), 'radius'),
  e(t('Raf boşlukları'), 'desk', t('Şekil'), 'padding'),
  e(t('Tema seç'), 'theme', t('Temalar'), t('renk cam dark light')),
  e(t('Tema oluştur'), 'theme', t('Tema oluştur'), t('builder renk seç dışa aktar')),
  e(t('Tema içe / dışa aktar'), 'theme', t('Temalar'), t('import export flypack')),
  e(t('Duvar kâğıdı modu'), 'wallpaper', t('Kaynak'), t('arka plan wallpaper')),
  e(t('Canlı arka plan'), 'wallpaper', t('Kaynak'), t('aurora yıldız dalga baloncuk video')),
  e(t('Klasörden slayt'), 'wallpaper', t('Kaynak'), t('spotlight değişen')),
  e(t('Duvar kâğıdı davranışı (pil, tam ekran)'), 'wallpaper', t('Davranış'), 'durdur'),
  e(t('Simge paketi seç'), 'icons', t('Paketler'), t('icon pack')),
  e(t('Simge paketi oluştur'), 'icons', t('Paket oluştur'), 'rocketdock'),
  e(t('İmleç paketi'), 'cursors', t('Paketler'), t('cursor fare mouse imleç ok el')),
  e(t('Hız ve hareket tipi'), 'motion', t('Hız'), 'speed'),
  e(t('Fare üzerine gelme animasyonu'), 'motion', t('Simge efektleri'), 'hover'),
  e(t('Uygulama başlatma animasyonu'), 'motion', t('Simge efektleri'), t('launch zıpla')),
  e(t('Çalışan uygulama göstergesi'), 'motion', t('Simge efektleri'), t('indicator nokta')),
  e(t('Dock giriş çıkış efekti'), 'motion', t('Dock ve pencereler'), 'show'),
  e(t('Pencere efekti (cin)'), 'motion', t('Dock ve pencereler'), 'genie'),
  e(t('Pencere boyutu'), 'windows', t('Pencereler'), 'size'),
  e(t('Pencere açılış konumu'), 'windows', t('Pencereler'), 'placement'),
  e(t('Sesleri aç, ses düzeyi, stil'), 'sound', t('Sesler'), 'volume'),
  e(t('Hangi olaylarda ses çalsın'), 'sound', t('Sesler'), ''),
  e(t('Sesleri dene'), 'sound', t('Dene'), 'test'),
  e(t('Dock’taki öğeler, kısayollar'), 'items', undefined, 'hotkey'),
  e(t('Kontrol paneli girdileri'), 'wheel', undefined, t('denetim masası çark ekle araçlar')),
  e(t('Widget ekle (analog saat, takvim, hava, not…)'), 'widgets', t('Ekle'), t('saat hava pil sistem medya not')),
  e(t('Basketbol, futbol, tenis, sektirme'), 'toys', t('Oyunlar'), t('oyun top pota gol seri skor serbest süreye karşı rekor')),
  e(t('Windows tweak’leri'), 'tweaks', undefined, t('gizli dosya uzantı klasik menü')),
  e(t('Windows ile başlat'), 'general', undefined, t('startup login')),
  e(t('Yedekle ve geri yükle'), 'general', undefined, 'backup'),
  e(t('Kısayol: dock’u göster / gizle'), 'general', undefined, 'hotkey'),
  e(t('Hakkında, sürüm'), 'general', undefined, t('sürüm destek')),
]
