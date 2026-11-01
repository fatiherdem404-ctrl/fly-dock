// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke } from '@/api'

import { t } from '../i18n'
const PREV = <path d="M7 5v14M19 5l-9 7 9 7z" />
const NEXT = <path d="M17 5v14M5 5l9 7-9 7z" />
const PLAY = <path d="M8 5l11 7-11 7z" />

function Btn({ label, onClick, big, children }: { label: string; onClick: () => void; big?: boolean; children: React.ReactNode }) {
  return (
    <button className={big ? 'wg-media__btn wg-media__btn--big' : 'wg-media__btn'} aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
    </button>
  )
}

/** What the media player is playing (read from its window title) and previous / play-pause / next. */
export default function MediaWidget() {
  const [playing, setPlaying] = useState<{ app: string; title: string } | null>(null)
  useEffect(() => {
    const load = () => invoke('widgets:now-playing').then(setPlaying)
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="wg-media">
      <div className="wg-media__art" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></svg>
      </div>
      <div className="wg-media__text">
        <b>{playing?.title || (playing ? playing.app : t('Çalan bir şey yok'))}</b>
        <span>{playing ? playing.app : t('Spotify, VLC ve benzeri oynatıcılar')}</span>
      </div>
      <div className="wg-media__buttons">
        <Btn label={t('Önceki')} onClick={() => invoke('widgets:media', 'prev')}>{PREV}</Btn>
        <Btn label={t('Oynat / duraklat')} big onClick={() => invoke('widgets:media', 'playpause')}>{PLAY}</Btn>
        <Btn label={t('Sonraki')} onClick={() => invoke('widgets:media', 'next')}>{NEXT}</Btn>
      </div>
    </div>
  )
}
