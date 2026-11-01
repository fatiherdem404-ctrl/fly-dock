// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { InvokeMap, InvokeChannel, EventMap, EventChannel } from '../src/shared/types'

const api = {
  invoke: <C extends InvokeChannel>(channel: C, ...args: InvokeMap[C]['args']): Promise<InvokeMap[C]['result']> =>
    ipcRenderer.invoke(channel, ...args),

  on: <C extends EventChannel>(channel: C, cb: (payload: EventMap[C]) => void) => {
    const listener = (_e: unknown, payload: EventMap[C]) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  /** Real file-system path of a File from a drop event (File.path is gone in modern Electron). */
  pathFor: (file: File) => webUtils.getPathForFile(file),

  /** The language of this app run ('tr' or 'en'), asked once, synchronously, so texts are right from the first line. */
  lang: ipcRenderer.sendSync('i18n:lang') as string,
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
