// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useState } from 'react'
import { invoke, useActiveTheme } from '@/api'
import Icon from '@/icons'
import IconLibrary from '@/components/IconLibrary'
import { initSound, playSound } from '@/sound'
import type { DockSettings } from '@/shared/types'

import { t } from '../i18n'
/** The icon picker window: the whole icon library, a preview, and Apply / Default. Opened for one dock item or gear entry. */
export default function IconPickView() {
  const target = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('target') ?? ''
  const [settings, setSettings] = useState<DockSettings | null>(null)
  const [info, setInfo] = useState<{ name: string; current: string | null; custom: boolean } | null>(null)
  const [chosen, setChosen] = useState<{ path: string; preview?: string } | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    initSound()
    invoke('settings:get').then(setSettings)
    invoke('iconpick:info', target).then(setInfo)
    setTimeout(() => playSound('windowOpen'), 60)
  }, [target])
  useActiveTheme(settings?.theme)

  const close = () => {
    playSound('windowClose')
    setTimeout(() => invoke('iconpick:close'), 80)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pick = (file: string, preview?: string) => {
    setChosen({ path: file, preview })
    if (!preview) invoke('library:thumb', file).then((p) => p && setPreviews((cur) => ({ ...cur, [file]: p })))
  }
  const apply = async (file: string | null) => {
    const result = await invoke('iconpick:apply', target, file)
    if (!result.ok) return setMessage(result.message)
    playSound('accept')
    close()
  }
  const shown = chosen ? chosen.preview ?? previews[chosen.path] ?? null : info?.current ?? null

  return (
    <div className="confirm-shell">
      <div className="iconpick" role="dialog" aria-label={t('Simge seç')}>
        <header className="iconpick__head">
          <span className="iconpick__preview">{shown ? <img src={shown} alt="" /> : <Icon name="image" size={26} />}</span>
          <div className="iconpick__title">
            <h2>{info?.name ?? ''}</h2>
            <p>{chosen ? t('Seçtiğin simge aşağıda önizleniyor. Uygula de.') : t('Aşağıdaki listeden bir simge seç.')}</p>
          </div>
          <button className="confirm__btn" onClick={close} aria-label={t('Kapat')}>{t('Kapat')}</button>
        </header>
        <div className="iconpick__body">
          <IconLibrary onPick={pick} selected={chosen?.path} />
        </div>
        {message && <div className="st-message st-message--error" style={{ margin: '0 18px 8px' }}>{message}</div>}
        <footer className="iconpick__foot">
          <button className="confirm__btn" disabled={!info?.custom} onClick={() => apply(null)}>{t('Varsayılan simge')}</button>
          <button className="confirm__btn confirm__btn--ok" disabled={!chosen} onClick={() => chosen && apply(chosen.path)}>{t('Uygula')}</button>
        </footer>
      </div>
    </div>
  )
}
