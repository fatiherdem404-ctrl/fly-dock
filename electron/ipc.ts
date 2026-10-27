// Typed wrappers around ipcMain / webContents.send, driven by InvokeMap and EventMap in src/shared/types.ts.
import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { InvokeMap, InvokeChannel, EventMap, EventChannel } from '../src/shared/types'

export function handle<C extends InvokeChannel>(
  channel: C,
  fn: (event: IpcMainInvokeEvent, ...args: InvokeMap[C]['args']) => InvokeMap[C]['result'] | Promise<InvokeMap[C]['result']>,
) {
  ipcMain.handle(channel, (e, ...args) => fn(e, ...(args as InvokeMap[C]['args'])))
}

export function broadcast<C extends EventChannel>(channel: C, payload: EventMap[C]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
