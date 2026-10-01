import { cn } from '@/lib/utils'

interface Props {
  /** Pixel size (square). */
  size?: number
  /** Animated by default; people who prefer reduced motion always get the still frame. */
  animated?: boolean
  className?: string
}

/** The companion. Decorative: the words beside it carry the meaning. */
export function Bunny({ size = 96, animated = true, className }: Props) {
  const common = {
    width: size,
    height: size,
    alt: '',
    'aria-hidden': true as const,
    draggable: false,
    className: cn('select-none', className),
  }
  if (!animated) return <img src="/bunny-still.png" {...common} />
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/bunny-still.png" />
      <img src="/bunny.gif" {...common} />
    </picture>
  )
}
