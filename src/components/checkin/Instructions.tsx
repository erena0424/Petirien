import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getActivity } from '../../catalog'
import { cn } from '@/lib/utils'

interface Props {
  activityId: string
  /** Start expanded (used where the instructions are the main content). */
  defaultOpen?: boolean
}

/** "How to do it": what you need, a few short steps, and one reassuring line. Hand-written in the catalog. */
export function Instructions({ activityId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const activity = getActivity(activityId)
  if (!activity) return null

  return (
    <div data-testid="instructions">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        How to do it
        <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      <div id={panelId} hidden={!open} className="mt-2 rounded-xl bg-secondary p-4 text-sm text-foreground">
        <p>
          <span className="font-semibold">You&apos;ll need: </span>
          {activity.needs}
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          {activity.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-muted-foreground">{activity.tip}</p>
      </div>
    </div>
  )
}
