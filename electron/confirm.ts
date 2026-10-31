// The app's own confirmation window, in the dock's theme, used instead of a system message box. The question is
// a plain value object; the answer comes back as an id plus true/false, nothing else crosses over.
import { BrowserWindow, screen } from 'electron'
import crypto from 'node:crypto'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import type { ConfirmRequest } from '../src/shared/types'

let current: { id: string; win: BrowserWindow; settle: (answer: boolean) => void } | null = null

const WIDTH = 460
const HEIGHT = 250

/** Shows the question and resolves true only when the user chose the confirm button. Closing it counts as no. */
export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  current?.settle(false)
  return new Promise((resolve) => {
    const id = crypto.randomBytes(6).toString('hex')
    const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    const win = new BrowserWindow({
      x: Math.round(x + (width - WIDTH) / 2) - OFFSCREEN, y: Math.round(y + (height - HEIGHT) / 2 - 40), width: WIDTH, height: HEIGHT,
      frame: false, transparent: true, hasShadow: false, resizable: false, minimizable: false, maximizable: false, skipTaskbar: true,
      alwaysOnTop: true, show: false, webPreferences: baseWebPreferences(),
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMenuBarVisibility(false)
    let done = false
    const settle = (answer: boolean) => {
      if (done) return
      done = true
      if (current?.id === id) current = null
      if (!win.isDestroyed()) win.destroy()
      resolve(answer)
    }
    current = { id, win, settle }
    win.on('closed', () => settle(false))
    loadRoute(win, `/confirm?id=${id}&q=${encodeURIComponent(JSON.stringify(request))}`)
    win.once('ready-to-show', () => {
      win.show()
      win.focus()
    })
  })
}

export function answerConfirm(id: string, answer: boolean) {
  if (current?.id === id) current.settle(answer === true)
}
