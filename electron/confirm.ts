// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
// The app's own question windows, in the dock's theme, used instead of system message boxes: a yes/no confirmation
// and a one-line text prompt (rename). The question is a plain value object; the answer comes back as an id plus
// true/false and, for a prompt, the text, nothing else crosses over.
import { BrowserWindow, screen } from 'electron'
import crypto from 'node:crypto'
import { baseWebPreferences, loadRoute, OFFSCREEN } from './windows'
import { focusStack } from './stackWindow'
import type { ConfirmRequest } from '../src/shared/types'

interface Answer {
  ok: boolean
  text: string
}

let current: { id: string; win: BrowserWindow; settle: (answer: Answer) => void } | null = null

const WIDTH = 508 // 460 plus room around the card for its shadow
const HEIGHT = 298

export function confirmIsOpen(): boolean {
  return !!current
}

function ask(request: ConfirmRequest): Promise<Answer> {
  current?.settle({ ok: false, text: '' })
  return new Promise((resolve) => {
    const id = crypto.randomBytes(6).toString('hex')
    const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    const win = new BrowserWindow({
      x: Math.round(x + (width - WIDTH) / 2) - OFFSCREEN, y: Math.round(y + (height - HEIGHT) / 2 - 40), width: WIDTH, height: request.input ? HEIGHT + 30 : HEIGHT,
      frame: false, transparent: true, hasShadow: false, resizable: false, minimizable: false, maximizable: false, skipTaskbar: true,
      alwaysOnTop: true, show: false, webPreferences: baseWebPreferences(),
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMenuBarVisibility(false)
    let done = false
    const settle = (answer: Answer) => {
      if (done) return
      done = true
      if (current?.id === id) current = null
      if (!win.isDestroyed()) win.destroy()
      // a question asked from a dock window hands the focus back to it
      if (!current) focusStack()
      resolve(answer)
    }
    current = { id, win, settle }
    win.on('closed', () => settle({ ok: false, text: '' }))
    loadRoute(win, `/confirm?id=${id}&q=${encodeURIComponent(JSON.stringify(request))}`)
    win.once('ready-to-show', () => {
      win.show()
      win.focus()
    })
  })
}

/** Shows the question and resolves true only when the user chose the confirm button. Closing it counts as no. */
export async function askConfirm(request: ConfirmRequest): Promise<boolean> {
  return (await ask({ ...request, input: undefined })).ok
}

/** Asks for one line of text; null when the user cancels. */
export async function askInput(request: ConfirmRequest & { value: string }): Promise<string | null> {
  const { value, ...rest } = request
  const answer = await ask({ ...rest, input: { value } })
  return answer.ok ? answer.text : null
}

export function answerConfirm(id: string, answer: boolean, text = '') {
  if (current?.id === id) current.settle({ ok: answer === true, text: String(text).slice(0, 260) })
}
