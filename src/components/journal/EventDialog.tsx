import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui'
import { formatCheckinDate } from '@/lib/format'
import type { Plan } from '../../plans/plan'
import { fullDate } from '../../journal/calendar'
import { timeRange } from '../../journal/layout'
import type { JournalRecord } from './JournalEntryCard'

/**
 * A calendar event, opened from the Journal calendar: when it was, what you have already written about it,
 * and the one action, a conversation with the bunny about it. Events with nothing written are here too,
 * so any of them can be reflected on later.
 */
export function EventDialog({
  plan,
  entries,
  onClose,
  onReflect,
  onRemove,
}: {
  plan: Plan | null
  entries: JournalRecord[]
  onClose: () => void
  onReflect: (plan: Plan) => void
  /** Remove an event the person added themselves. Calendar events cannot be removed here. */
  onRemove?: (plan: Plan) => void
}) {
  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="event-dialog">
        <DialogTitle>{plan?.title ?? ''}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {plan ? `${fullDate(new Date(plan.start))} · ${timeRange(plan)}` : ''}
        </DialogDescription>

        {plan && (
          <div className="space-y-4">
            {entries.length > 0 ? (
              <div data-testid="event-entries">
                <p className="text-sm font-medium text-foreground">In your journal</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {entries.map((r) => (
                    <li key={r.recordId} className="rounded-lg bg-accent px-3 py-2">
                      <span className="font-semibold">{r.data.title}</span>
                      <span className="block text-xs text-muted-foreground">{formatCheckinDate(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p data-testid="event-empty" className="text-sm text-muted-foreground">
                Nothing in your journal about this yet.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                onClick={() => {
                  onClose()
                  onReflect(plan)
                }}
              >
                Reflect on this
              </Button>
              {plan.manual && onRemove && (
                <Button
                  variant="ghost"
                  className="min-h-11"
                  data-testid="remove-event"
                  onClick={() => {
                    onRemove(plan)
                    onClose()
                  }}
                >
                  Remove this event
                </Button>
              )}
              <Button variant="ghost" className="min-h-11" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
