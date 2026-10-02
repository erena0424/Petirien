/** Small decorative shapes around the bunny: a star, a four-point sparkle and a cloud. Never carry meaning. */

const base = { 'aria-hidden': true as const, focusable: false as const }

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="var(--color-butter)" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 2c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z" fill="var(--color-primary)" opacity="0.85" />
    </svg>
  )
}

export function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} {...base}>
      <path d="M16 28a10 10 0 01-1.5-19.9A14 14 0 0141 9a9 9 0 013 17.9V28z" fill="var(--color-sky)" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

/** The big soft shape the bunny sits on. */
export function Blob({ className }: { className?: string }) {
  return <div aria-hidden className={`rounded-[46%_54%_52%_48%/52%_46%_54%_48%] bg-gradient-to-br from-[var(--color-backdrop-soft)] to-[var(--color-backdrop)] ${className ?? ''}`} />
}
