import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type Props = Omit<ComponentProps<'textarea'>, 'rows'> & {
  /** Tallest it grows, in lines, before it scrolls. */
  maxLines?: number
}

/**
 * A text box that grows as you type (one line to `maxLines`), then scrolls, and
 * shrinks back after sending. Enter and Shift+Enter handling is left to the caller.
 */
export function AutoTextarea({ className, maxLines = 8, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24
    const pad = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom)
    const max = line * maxLines + pad
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }, [value, maxLines])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(
        'block w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  )
}
