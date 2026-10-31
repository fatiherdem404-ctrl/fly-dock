import { useEffect, useState } from 'react'
import { invoke, useActiveTheme, useEvent, useRemote } from '@/api'
import Icon from '@/icons'
import DockPreview from '@/components/DockPreview'
import { initSound } from '@/sound'
import type { DockSettings } from '@/shared/types'
import TitleBar from '@/settings/TitleBar'
import { NAV_GROUPS, PREVIEW_TABS, SearchEntry, Tab, TAB_INFO } from '@/settings/nav'
import type { Update } from '@/settings/ui'
import { DockTab } from '@/settings/pages/DockPage'
import { DeskTab } from '@/settings/pages/DeskPage'
import { MotionTab } from '@/settings/pages/MotionPage'
import { WindowsTab } from '@/settings/pages/WindowsPage'
import { ThemeTab } from '@/settings/pages/ThemesPage'
import { WallpaperTab } from '@/settings/pages/WallpaperPage'
import { SoundTab } from '@/settings/pages/SoundPage'
import { ItemsTab } from '@/settings/pages/ItemsPage'
import { WheelTab } from '@/settings/pages/WheelPage'
import { WidgetsTab } from '@/settings/pages/WidgetsPage'
import { TweaksTab } from '@/settings/pages/TweaksPage'
import { GeneralTab } from '@/settings/pages/GeneralPage'

const remembered = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private window: the choice just is not remembered */
  }
}

/** Which Pages id remembers the sub-tab of each page. */
function subKey(tab: Tab): string {
  return tab === 'theme' ? 'themes' : tab
}

/** The settings window: our own title bar, a grouped navigation that shrinks to icons, and one page at a time. */
export default function SettingsView() {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = remembered('settings.tab') as Tab | null
    return saved && saved in TAB_INFO ? saved : 'dock'
  })
  const [nonce, setNonce] = useState(0)
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [info] = useRemote('app:info', [])
  const [launchTick, setLaunchTick] = useState(0)
  const [maximized, setMaximized] = useState(false)
  const [showPreview, setShowPreview] = useState(() => remembered('settings.preview') !== 'off')

  useEffect(() => {
    initSound()
    invoke('settings:get').then(setSettings)
    invoke('window:is-maximized').then(setMaximized)
  }, [])
  useEvent('settings:changed', setSettings)
  useEvent('window:maximized', setMaximized)
  useActiveTheme(settings?.theme)

  const set: Update = (partial) => {
    setSettings((cur) => (cur ? { ...cur, ...partial } : cur))
    if ('launchAnimation' in partial) setLaunchTick((t) => t + 1)
    invoke('settings:update', partial)
  }
  const go = (next: Tab) => {
    setTab(next)
    remember('settings.tab', next)
  }
  const jump = (entry: SearchEntry) => {
    if (entry.sub) remember(`settings.sub.${subKey(entry.tab)}`, entry.sub)
    go(entry.tab)
    setNonce((n) => n + 1)
  }
  const togglePreview = () => {
    setShowPreview((on) => {
      remember('settings.preview', on ? 'off' : 'on')
      return !on
    })
  }

  if (!settings) return null
  const page = TAB_INFO[tab]
  return (
    <div className="st" data-tab={tab}>
      <TitleBar
        name={info?.name ?? 'Fly Dock'}
        pageLabel={page.label}
        pageIcon={page.icon}
        maximized={maximized}
        onControl={(action) => invoke('window:control', action)}
        onJump={jump}
      />
      <div className="st-body">
        <nav className="st-nav" role="tablist" aria-label="Ayar sayfaları">
          {NAV_GROUPS.map((group) => (
            <div className="st-nav__group" key={group.title}>
              <small>{group.title}</small>
              {group.tabs.map((id) => (
                <button key={id} role="tab" aria-selected={tab === id} className="st-tab" title={TAB_INFO[id].label} onClick={() => go(id)}>
                  <Icon name={TAB_INFO[id].icon} size={18} />
                  <span>{TAB_INFO[id].label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className="st-main">
          {PREVIEW_TABS.includes(tab) && (
            <div className={`st-preview${showPreview ? '' : ' st-preview--off'}`}>
              {showPreview && <DockPreview settings={settings} launchTick={launchTick} />}
              <button className="st-preview__tag" onClick={togglePreview} aria-pressed={showPreview}>
                <Icon name={showPreview ? 'eyeOff' : 'play'} size={13} />{showPreview ? 'Önizlemeyi gizle' : 'Canlı önizlemeyi göster'}
              </button>
            </div>
          )}
          <div className="st-page" key={`${tab}-${nonce}`}>
            <div className="st-page__head">
              <span className="st-page__icon"><Icon name={page.icon} size={22} /></span>
              <div>
                <h2>{page.label}</h2>
                <p>{page.blurb}</p>
              </div>
            </div>
            {tab === 'dock' && <DockTab s={settings} set={set} />}
            {tab === 'desk' && <DeskTab s={settings} set={set} />}
            {tab === 'motion' && <MotionTab s={settings} set={set} preview={() => setLaunchTick((t) => t + 1)} />}
            {tab === 'windows' && <WindowsTab s={settings} set={set} />}
            {tab === 'theme' && <ThemeTab s={settings} set={set} kind="theme" />}
            {tab === 'icons' && <ThemeTab s={settings} set={set} kind="icons" />}
            {tab === 'items' && <ItemsTab />}
            {tab === 'wheel' && <WheelTab />}
            {tab === 'tweaks' && <TweaksTab />}
            {tab === 'wallpaper' && <WallpaperTab s={settings} set={set} />}
            {tab === 'sound' && <SoundTab s={settings} set={set} />}
            {tab === 'widgets' && <WidgetsTab />}
            {tab === 'general' && <GeneralTab s={settings} set={set} />}
          </div>
        </main>
      </div>
    </div>
  )
}
