import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayKey, monthGrid } from '@/lib/calendar'

interface Props {
  /** Local day (YYYY-MM-DD) to number of check-ins. */
  days: Map<string, number>
  now?: Date
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * A month of days you checked in. Done days show a check mark and a filled
 * circle, so meaning never depends on color alone. Missed days are plain:
 * nothing here ever says you fell behind.
 */
export function MonthCalendar({ days, now = new Date() }: Props) {
  const [offset, setOffset] = useState(0)
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const grid = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view.getFullYear(), view.getMonth()])
  const today = dayKey(now)
  const title = view.toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div data-testid="calendar">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setOffset((o) => o - 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={offset >= 0}
            onClick={() => setOffset((o) => o + 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={`Check-ins in ${title}`} className="mt-2">
        <div role="row" className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d, i) => (
            <div key={d} role="columnheader" aria-label={WEEKDAY_FULL[i]} className="py-1">
              {d}
            </div>
          ))}
        </div>
        {grid.map((week) => (
          <div role="row" key={week[0]!.key} className="grid grid-cols-7">
            {week.map((c) => {
              const count = c.inMonth ? (days.get(c.key) ?? 0) : 0
              const done = count > 0
              return (
                <div
                  key={c.key}
                  role="gridcell"
                  data-done={done || undefined}
                  aria-label={c.inMonth ? `${c.key}${done ? ', you checked in' : ''}${c.key === today ? ', today' : ''}` : undefined}
                  className="flex items-center justify-center py-1"
                >
                  {c.inMonth && (
                    <span
                      className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded-full text-sm',
                        done ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
                        c.key === today && !done && 'border-2 border-primary',
                        c.key === today && done && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                      )}
                    >
                      {done ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : c.day}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
