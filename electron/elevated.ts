// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// Starts one job of the helper in administrator mode. The Windows confirmation prompt (UAC) is shown by Windows
// itself; this app never sees a password and never runs elevated. Only the fixed job ids below are accepted.
import { execFile } from 'node:child_process'
import { helperPath } from './helper'
import { HEADLESS } from './windows'
import type { ElevatedRunner } from './tweaks'

const JOBS = new Set(['shortcut-arrow', 'hibernate', 'restore-point'])

export const runElevated: ElevatedRunner = (op, job) =>
  new Promise((resolve) => {
    if (HEADLESS) return resolve({ ok: false, message: 'dry run' })
    if ((op !== 'apply' && op !== 'revert') || !JOBS.has(job)) return resolve({ ok: false, message: 'unknown job' })
    const exe = helperPath().replace(/'/g, "''")
    const script = `$p = Start-Process -FilePath '${exe}' -ArgumentList '--elevated','${op}','${job}' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 120_000 }, (error) => {
      if (!error) return resolve({ ok: true, message: 'done' })
      // PowerShell exits 1 without a helper exit code when the prompt was dismissed
      const code = (error as { code?: number }).code
      resolve({ ok: false, message: code === 5 ? 'refused' : code === 2 ? 'unknown job' : 'cancelled' })
    })
  })
