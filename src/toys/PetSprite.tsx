import type { PetKind } from './pet'

/** Colours of each animal. */
const LOOK: Record<PetKind, { body: string; dark: string; belly: string; ear: string; nose: string }> = {
  cat: { body: '#f0a35e', dark: '#c97d3c', belly: '#fff1de', ear: '#f4b3a6', nose: '#e5767f' },
  dog: { body: '#c99159', dark: '#8c5a32', belly: '#f1d9b5', ear: '#8c5a32', nose: '#2b2b2b' },
  rabbit: { body: '#f3f3f6', dark: '#cfcfdb', belly: '#ffffff', ear: '#f6b6c6', nose: '#e5767f' },
}

export const PET_NAMES: Record<PetKind, string> = { cat: 'Kedi', dog: 'Köpek', rabbit: 'Tavşan' }

/**
 * The pet drawn as a vector, facing right. Every part is its own group so the stylesheet can swing the legs, wag the tail
 * and change the pose from a data-state attribute on the wrapper (see toys.css); this component never re-renders for that.
 */
export default function PetSprite({ kind }: { kind: PetKind }) {
  const c = LOOK[kind]
  return (
    <svg viewBox="0 0 100 100" className={`pet-svg pet-svg--${kind}`} aria-hidden="true">
      <ellipse className="p-shadow" cx="46" cy="94" rx="30" ry="4" fill="rgba(0,0,0,0.22)" />
      <g className="p-tail">
        {kind === 'cat' && <path d="M22 66 C2 62 4 36 20 34" fill="none" stroke={c.body} strokeWidth="8" strokeLinecap="round" />}
        {kind === 'dog' && <path d="M22 62 C12 58 10 46 14 38" fill="none" stroke={c.dark} strokeWidth="8" strokeLinecap="round" />}
        {kind === 'rabbit' && <circle cx="19" cy="62" r="8" fill="#ffffff" stroke={c.dark} strokeWidth="1.5" />}
      </g>
      <g className="p-leg p-leg--b2"><rect x="24" y="68" width="9" height="25" rx="4.5" fill={c.dark} /></g>
      <g className="p-leg p-leg--f2"><rect x="60" y="68" width="9" height="25" rx="4.5" fill={c.dark} /></g>
      <g className="p-body">
        <ellipse cx="44" cy="62" rx="27" ry="17" fill={c.body} />
        <ellipse cx="46" cy="70" rx="18" ry="8" fill={c.belly} />
        {kind === 'cat' && <path d="M30 50 l4 8 M40 47 l3 9 M50 47 l1 9" stroke={c.dark} strokeWidth="2.5" strokeLinecap="round" />}
        {kind === 'dog' && <ellipse cx="34" cy="56" rx="9" ry="7" fill={c.dark} opacity="0.55" />}
      </g>
      <g className="p-leg p-leg--b1"><rect x="32" y="68" width="9" height="25" rx="4.5" fill={c.body} /></g>
      <g className="p-leg p-leg--f1"><rect x="68" y="68" width="9" height="25" rx="4.5" fill={c.body} /></g>
      <g className="p-head">
        {kind === 'cat' && (
          <>
            <path d="M62 34 L63 16 L74 29 Z" fill={c.body} />
            <path d="M78 29 L89 16 L90 34 Z" fill={c.body} />
            <path d="M65 29 L65.5 21 L71 28 Z" fill={c.ear} />
            <path d="M81 28 L86.5 21 L87 29 Z" fill={c.ear} />
          </>
        )}
        {kind === 'rabbit' && (
          <>
            <g className="p-ear p-ear--1"><ellipse cx="66" cy="14" rx="5.5" ry="17" fill={c.body} stroke={c.dark} strokeWidth="1.2" /><ellipse cx="66" cy="15" rx="2.6" ry="12" fill={c.ear} /></g>
            <g className="p-ear p-ear--2"><ellipse cx="82" cy="14" rx="5.5" ry="17" fill={c.body} stroke={c.dark} strokeWidth="1.2" /><ellipse cx="82" cy="15" rx="2.6" ry="12" fill={c.ear} /></g>
          </>
        )}
        <circle cx="74" cy="46" r="17" fill={c.body} />
        {kind === 'dog' && (
          <>
            <g className="p-ear p-ear--1"><ellipse cx="60" cy="40" rx="7" ry="13" fill={c.ear} transform="rotate(14 60 40)" /></g>
            <g className="p-ear p-ear--2"><ellipse cx="88" cy="40" rx="7" ry="13" fill={c.ear} transform="rotate(-14 88 40)" /></g>
            <ellipse cx="74" cy="53" rx="10" ry="8" fill={c.belly} />
          </>
        )}
        {kind !== 'dog' && <ellipse cx="74" cy="53" rx="8" ry="6" fill={c.belly} />}
        <g className="p-eyes">
          <g className="p-eye-open"><circle cx="67" cy="43" r="2.8" fill="#23232b" /><circle cx="81" cy="43" r="2.8" fill="#23232b" /><circle cx="68" cy="42" r="0.9" fill="#fff" /><circle cx="82" cy="42" r="0.9" fill="#fff" /></g>
          <g className="p-eye-closed"><path d="M63.5 44 q3.5 -4 7 0" stroke="#23232b" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M77.5 44 q3.5 -4 7 0" stroke="#23232b" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
        </g>
        <ellipse cx="74" cy="49" rx="2.6" ry="2" fill={c.nose} />
        <path d="M74 51 v2 M71 54 q3 2.4 6 0" stroke="#23232b" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {kind === 'cat' && <path d="M58 50 l-9 -2 M58 53 l-9 2 M90 50 l9 -2 M90 53 l9 2" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.9" />}
      </g>
    </svg>
  )
}
