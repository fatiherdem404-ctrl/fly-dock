// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Must be the first import of the main process: it reads the saved language straight from the settings file, before the
// store (whose defaults are already translated) and every other module build their texts.
import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getLang, resolveLang, setLang } from '../src/i18n'

let saved: string | undefined
try {
  const raw = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'config.json'), 'utf8')) as { settings?: { language?: string } }
  saved = raw.settings?.language
} catch { /* first run or unreadable file: follow the system */ }

setLang(resolveLang(saved, Intl.DateTimeFormat().resolvedOptions().locale))

ipcMain.on('i18n:lang', (e) => { e.returnValue = getLang() })
