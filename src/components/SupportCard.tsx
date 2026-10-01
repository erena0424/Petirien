import { SUPPORT_INTRO, SUPPORT_RESOURCES } from '@/lib/support'

/** Static support resources. Used for the crisis path and the footer dialog. */
/** `bare` drops the card chrome when it already sits inside a dialog. */
export function SupportCard({ heading = 'Support is available right now', bare = false }: { heading?: string; bare?: boolean }) {
  return (
    <section
      aria-label="Support resources"
      data-testid="support-card"
      className={bare ? undefined : 'rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]'}
    >
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{SUPPORT_INTRO}</p>

      <ul className="mt-4 space-y-4">
        {SUPPORT_RESOURCES.map((r) => (
          <li key={r.id} className="rounded-xl bg-secondary p-4">
            <h3 className="text-sm font-semibold text-foreground">{r.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.actions.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {a.label}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
