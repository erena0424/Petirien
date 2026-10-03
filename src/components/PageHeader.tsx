import type { ReactNode } from 'react'

/**
 * The top of a signed-in page: a soft lavender band with the title and one line about the page. Calmer than the
 * landing page (no strong colour block) but the same shapes and type, so the app feels like one thing. The bunny is
 * already on every page, so it is not repeated here. `action` is for a page's main button.
 */
export function PageHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="w-full bg-secondary/70">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-8 sm:px-8 sm:py-10">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[color:var(--color-ink)] sm:text-4xl">{title}</h1>
          {children && <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">{children}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </header>
  )
}
