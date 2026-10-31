import { useEffect, useState } from 'react'
import { invoke } from '@/api'
import Icon, { IconName } from '@/icons'
import { useTexture } from '@/useTexture'
import type { WheelEntry } from '@/shared/types'

/** Picture of a gear-menu entry: the user's own image, else the file's own icon for added items, else the built-in glyph. */
export default function WheelGlyph({ entry, size }: { entry: WheelEntry; size: number }) {
  const own = useTexture(entry.iconFile ?? '')
  const [shell, setShell] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setShell(null)
    if (entry.path && !entry.iconFile) invoke('icon:path', entry.path).then((s) => live && setShell(s))
    return () => {
      live = false
    }
  }, [entry.path, entry.iconFile])
  const picture = own?.url ?? shell ?? entry.packIcon ?? null
  return picture ? <img className="wheel-glyph" src={picture} alt="" draggable={false} style={{ width: size, height: size }} /> : <Icon name={entry.icon as IconName} size={size} />
}
