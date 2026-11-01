// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Power menu: a full-screen overlay with lock, sleep, restart, shut down and sign out. Every action is a fixed
// command; the real Windows lock screen is used for "lock" (LockWorkStation), nothing pretends to be it.
import { BrowserWindow, screen } from 'electron'
import { execFile } from 'node:child_process'
import { helper } from './helper'
import { baseWebPreferences, loadRoute, HEADLESS, OFFSCREEN, blurSupported } from './windows'
import type { PowerAction } from '../src/shared/types'

import { t } from '../src/i18n'
let overlay: BrowserWindow | null = null

export function closePowerMenu() {
  overlay?.destroy()
  overlay = null
}

export function showPowerMenu() {
  closePowerMenu()
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.bounds
  const win = new BrowserWindow({
    x: x - OFFSCREEN, y, width, height,
    frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false,
    // real blur of whatever is behind, where Windows 11 offers it; otherwise a dark scrim drawn by the page
    ...(blurSupported ? { backgroundMaterial: 'acrylic' as const, backgroundColor: '#00000000' } : { transparent: true }),
    webPreferences: baseWebPreferences(),
  })
  overlay = win
  win.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(win, `/power?blur=${blurSupported ? 1 : 0}`)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  win.on('closed', () => {
    if (overlay === win) overlay = null
  })
}

function run(file: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => execFile(file, args, { windowsHide: true }, (err) => resolve(!err)))
}

/** Runs one power action. Test runs never touch the machine. */
export async function runPowerAction(action: PowerAction): Promise<{ ok: boolean; message: string }> {
  if (HEADLESS) return { ok: true, message: `dry run: ${action}` }
  closePowerMenu()
  switch (action) {
    case 'lock':
      return { ok: await helper.lock().catch(() => false), message: action }
    case 'sleep':
      return { ok: await helper.sleep().catch(() => false), message: action }
    case 'restart':
      return { ok: await run('shutdown.exe', ['/r', '/t', '0']), message: action }
    case 'shutdown':
      return { ok: await run('shutdown.exe', ['/s', '/t', '0']), message: action }
    case 'logout':
      return { ok: await run('shutdown.exe', ['/l']), message: action }
    default:
      return { ok: false, message: 'unknown action' }
  }
}
