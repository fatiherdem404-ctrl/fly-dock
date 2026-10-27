// No native addon here on purpose — node-window-manager requires node-gyp (Python +
// Visual Studio Build Tools) to compile, which is a lot of friction for a dock app.
// Windows already ships everything we need via PowerShell + .NET, so we shell out
// to small inline scripts instead. Slightly slower per-call (~150-300ms process spawn)
// but zero install friction, and 1.5s polling easily absorbs that cost.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface RunningApp {
  windowId: number // HWND, as a plain number
  processId: number
  exePath: string
  title: string
  isMinimized: boolean
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { maxBuffer: 10 * 1024 * 1024, windowsHide: true },
  )
  return stdout
}

const LIST_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DockNative {
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne "" } | ForEach-Object {
  [PSCustomObject]@{
    windowId = [int64]$_.MainWindowHandle
    processId = $_.Id
    exePath = $_.Path
    title = $_.MainWindowTitle
    isMinimized = [DockNative]::IsIconic($_.MainWindowHandle)
  }
} | ConvertTo-Json -Compress
`

/** Snapshot of every visible top-level window — used to render running-app indicators. */
export async function listRunningApps(): Promise<RunningApp[]> {
  const out = await runPowerShell(LIST_SCRIPT)
  if (!out.trim()) return []

  let parsed: any
  try {
    parsed = JSON.parse(out)
  } catch {
    return [] // transient PowerShell hiccup — next poll will retry
  }
  const raw = Array.isArray(parsed) ? parsed : [parsed]

  const seen = new Set<string>()
  const apps: RunningApp[] = []
  for (const r of raw) {
    if (!r?.exePath || seen.has(r.exePath)) continue
    seen.add(r.exePath)
    apps.push({
      windowId: r.windowId,
      processId: r.processId,
      exePath: r.exePath,
      title: r.title,
      isMinimized: !!r.isMinimized,
    })
  }
  return apps
}

export async function activateWindow(windowId: number) {
  await runPowerShell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DockActivate {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
[DockActivate]::ShowWindow([IntPtr]${windowId}, 9) | Out-Null
[DockActivate]::SetForegroundWindow([IntPtr]${windowId}) | Out-Null
`)
}

export async function minimizeWindow(windowId: number) {
  await runPowerShell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DockMinimize {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
[DockMinimize]::ShowWindow([IntPtr]${windowId}, 6) | Out-Null
`)
}

/** Diff-based polling watcher — PowerShell has no cheap native event hook we can subscribe to. */
export function watchRunningApps(onChange: (apps: RunningApp[]) => void, intervalMs = 1500) {
  let stopped = false
  let lastSignature = ''

  const tick = async () => {
    if (stopped) return
    try {
      const apps = await listRunningApps()
      const signature = apps.map((a) => `${a.exePath}:${a.isMinimized}`).join('|')
      if (signature !== lastSignature) {
        lastSignature = signature
        onChange(apps)
      }
    } catch (err) {
      console.error('watchRunningApps poll failed', err)
    }
    if (!stopped) setTimeout(tick, intervalMs)
  }

  tick()
  return () => {
    stopped = true
  }
}
