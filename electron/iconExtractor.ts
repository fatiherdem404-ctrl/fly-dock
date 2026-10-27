// Same reasoning as windowManager.ts: no compiled native addon. We shell out to
// PowerShell and use .NET's System.Drawing.Icon, which every Windows install already
// has — no node-gyp, no Python, no Visual Studio Build Tools.
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const CACHE_DIR = path.join(app.getPath('userData'), 'icon-cache')

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

function cacheKeyFor(filePath: string): string {
  const hash = crypto.createHash('sha1').update(filePath).digest('hex')
  return path.join(CACHE_DIR, `${hash}.png`)
}

function psQuote(value: string): string {
  // Escape for embedding inside a PowerShell double-quoted string.
  return value.replace(/"/g, '""')
}

async function extractViaPowerShell(exePath: string, outPngPath: string) {
  const script = `
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${psQuote(exePath)}")
if ($icon -ne $null) {
  $bitmap = $icon.ToBitmap()
  $bitmap.Save("${psQuote(outPngPath)}", [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  $icon.Dispose()
}
`
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true },
  )
}

/**
 * Resolves the icon (as a base64 data URL) for a dock item.
 * Priority: user override path > cached extraction > fresh extraction from the .exe.
 *
 * Note: ExtractAssociatedIcon returns the shell's default icon size (32x32 on most
 * systems). Good enough for a dock at typical sizes; if we need crisper icons at the
 * ~84px magnified size later, swap this for SHGetFileInfo with SHGFI_LARGEICON via
 * P/Invoke in the same script.
 */
export async function resolveIcon(targetPath: string, customIconPath?: string): Promise<string> {
  ensureCacheDir()

  if (customIconPath) {
    const buf = fs.readFileSync(customIconPath)
    const ext = path.extname(customIconPath).slice(1) || 'png'
    return `data:image/${ext};base64,${buf.toString('base64')}`
  }

  const cachePath = cacheKeyFor(targetPath)
  if (!fs.existsSync(cachePath)) {
    await extractViaPowerShell(targetPath, cachePath)
  }
  if (!fs.existsSync(cachePath)) {
    throw new Error(`Could not extract icon for ${targetPath}`)
  }

  const buf = fs.readFileSync(cachePath)
  return `data:image/png;base64,${buf.toString('base64')}`
}

export function clearIconCache() {
  if (fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true })
}
