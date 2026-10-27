// Client for the C# helper process (helper/): newline-delimited JSON over stdin/stdout.
// Requests carry an id and get a {id,result|error} reply; everything else is an {event,data} push.
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

export interface HelperWindow {
  hwnd: number
  pid: number
  exePath: string
  title: string
  minimized: boolean
}

export interface WindowsSnapshot {
  windows: HelperWindow[]
  fullscreen: boolean
  foreground: number
}

export interface LinkInfo {
  target: string
  args: string
  icon: string
  workDir: string
}

interface Pending {
  resolve: (value: any) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

function helperPath(): string {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'helper') : path.join(app.getAppPath(), 'helper', 'bin')
  return path.join(base, 'dock-helper.exe')
}

class Helper extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private buffer = ''
  private stopped = false
  private restartDelay = 500

  start() {
    const exe = helperPath()
    if (!fs.existsSync(exe)) {
      console.error(`[helper] ${exe} not found — run "npm run helper:build"`)
      return
    }
    this.stopped = false
    const proc = spawn(exe, [], { windowsHide: true })
    this.proc = proc
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => this.onData(chunk))
    proc.stderr.on('data', (d) => console.error('[helper]', String(d).trim()))
    proc.on('exit', () => {
      this.proc = null
      for (const p of this.pending.values()) {
        clearTimeout(p.timer)
        p.reject(new Error('helper exited'))
      }
      this.pending.clear()
      if (!this.stopped) {
        setTimeout(() => this.start(), this.restartDelay)
        this.restartDelay = Math.min(this.restartDelay * 2, 10_000)
      }
    })
    this.call('setIgnorePid', { pid: process.pid }).catch(() => {})
  }

  stop() {
    this.stopped = true
    this.proc?.stdin.end()
    setTimeout(() => this.proc?.kill(), 500).unref()
  }

  private onData(chunk: string) {
    this.buffer += chunk
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (!line) continue
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.event) {
        if (msg.event === 'ready') this.restartDelay = 500
        this.emit(msg.event, msg.data)
      } else if (msg.id !== undefined) {
        const p = this.pending.get(msg.id)
        if (!p) continue
        this.pending.delete(msg.id)
        clearTimeout(p.timer)
        if (msg.error) p.reject(new Error(msg.error))
        else p.resolve(msg.result)
      }
    }
  }

  call<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.proc) return reject(new Error('helper not running'))
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`helper call ${method} timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.proc.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  }

  windows() {
    return this.call<WindowsSnapshot>('windows')
  }
  activate(hwnd: number) {
    return this.call('activate', { hwnd })
  }
  minimize(hwnd: number) {
    return this.call('minimize', { hwnd })
  }
  close(hwnd: number) {
    return this.call('close', { hwnd })
  }
  icon(targetPath: string, size: number) {
    return this.call<string | null>('icon', { path: targetPath, size })
  }
  resolveLink(linkPath: string) {
    return this.call<LinkInfo | null>('resolveLink', { path: linkPath })
  }
  trash() {
    return this.call<{ items: number; bytes: number }>('trash')
  }
  emptyTrash() {
    return this.call<boolean>('emptyTrash', {}, 120_000)
  }
  roundCorners(hwnd: number) {
    return this.call<boolean>('roundCorners', { hwnd })
  }
  mediaKey(key: 'playpause' | 'next' | 'prev' | 'stop') {
    return this.call('mediaKey', { key })
  }
}

export const helper = new Helper()
