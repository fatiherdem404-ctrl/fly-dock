import type { CSSProperties, ReactNode } from 'react'

// One consistent 24px stroke icon set, drawn with currentColor so it follows the theme.
const PATHS: Record<string, ReactNode> = {
  dock: (<><rect x="3" y="15" width="18" height="5" rx="2" /><rect x="6" y="8" width="3.5" height="4.5" rx="1" /><rect x="10.3" y="5.5" width="3.5" height="7" rx="1" /><rect x="14.5" y="8" width="3.5" height="4.5" rx="1" /></>),
  desk: (<><path d="M3 16l3-8h12l3 8z" /><path d="M3 16v4h18v-4" /></>),
  motion: <path d="M3 12c3-8 6-8 9 0s6 8 9 0" />,
  window: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></>),
  theme: (<><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity=".35" /></>),
  pack: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  items: (<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
  widgets: (<><rect x="3" y="3" width="8" height="10" rx="2" /><rect x="13" y="3" width="8" height="6" rx="2" /><rect x="13" y="11" width="8" height="10" rx="2" /><rect x="3" y="15" width="8" height="6" rx="2" /></>),
  general: (<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
  open: (<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>),
  close: (<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>),
  pin: (<><path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 13v7" /></>),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  stack: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></>),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
  power: (<><path d="M12 3v9" /><path d="M6.3 6.5a8 8 0 1 0 11.4 0" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 6.2A9 9 0 0 1 22 12a14 14 0 0 1-3 3.6M6.5 7.5A14 14 0 0 0 2 12s3.5 7 10 7a9 9 0 0 0 3.5-.7" /></>),
  location: (<><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  keyboard: (<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>),
  refresh: (<><path d="M20 5v5h-5" /><path d="M20 10a8 8 0 1 0 1 4" /></>),
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9l5-5 5 5M5 20h14" />,
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  bug: (<><rect x="8" y="8" width="8" height="11" rx="4" /><path d="M9 8a3 3 0 0 1 6 0M4 12h4M16 12h4M5 6l3 3M19 6l-3 3M5 19l3-3M19 19l-3-3" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  play: <path d="M7 4l13 8-13 8z" />,
  check: <path d="M5 12l5 5 9-10" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  group: (<><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>),
}

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
