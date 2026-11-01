// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
import { useEffect, useRef, useState } from 'react'
import type { WidgetOptions } from '@/shared/widgets'

/** A sticky note: the text is saved with the widget a moment after you stop typing. */
export default function NoteWidget({ options, onOption }: { options: WidgetOptions; onOption?: (k: string, v: string | number | boolean) => void }) {
  const [text, setText] = useState(String(options.text ?? ''))
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const change = (value: string) => {
    setText(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onOption?.('text', value), 500)
  }
  return (
    <div className="wg-note">
      <div className="wg-note__bar"><i /><span>Not</span></div>
      <textarea
        value={text}
        readOnly={!onOption}
        placeholder="Buraya bir not yaz…"
        spellCheck={false}
        maxLength={4000}
        onChange={(e) => change(e.target.value)}
      />
    </div>
  )
}
