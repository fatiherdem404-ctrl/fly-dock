interface SeparatorProps {
  size: number
  orientation: 'vertical' | 'horizontal'
  transition: string
}

export default function Separator({ size, orientation, transition }: SeparatorProps) {
  const style =
    orientation === 'vertical'
      ? { width: size, transition: `width 120ms ${transition}` }
      : { height: size, transition: `height 120ms ${transition}` }

  return <div className={`dock-separator dock-separator--${orientation}`} style={style} />
}
