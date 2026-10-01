import type { ReactNode } from 'react'
import { Bunny } from './Bunny'

/** The companion's words, in a speech bubble next to the bunny. */
export function CompanionSays({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-3" data-testid="companion">
      <Bunny animated={false} className="w-24 shrink-0 sm:w-28" />
      <div className="relative rounded-2xl rounded-bl-md bg-accent px-4 py-3 text-base leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  )
}
