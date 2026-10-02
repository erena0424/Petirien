import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui'
import { useCalendarFit } from '@/lib/use-calendar'

/**
 * Optional: fit the time choice to the signed-in person's own Google Calendar.
 * Nothing is saved and event details are never shown, kept, or sent to the AI.
 */
export function CalendarFit({ onMinutes }: { onMinutes: (minutes: number) => void }) {
  const { state, check } = useCalendarFit(onMinutes)
  const busy = state.kind === 'loading'

  return (
    <div data-testid="calendar-fit" className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Fit it to your day</p>
      <p className="mt-1 text-sm text-muted-foreground">
        I can look at when your next event starts and pick a time for you. I only read start times. I don&apos;t save anything or tell the AI what your events are.
      </p>

      {state.kind === 'connect' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">First, connect your Google Calendar. It opens in a new tab.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={state.authUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="calendar-connect"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Connect Google Calendar
            </a>
            <Button type="button" variant="outline" onClick={() => void check()}>
              I&apos;ve connected, check again
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-3" onClick={() => void check()} disabled={busy}>
          <CalendarClock aria-hidden className="h-4 w-4" />
          {busy ? 'Looking at your calendar…' : 'Use my calendar'}
        </Button>
      )}

      <div aria-live="polite">
        {state.kind === 'result' && (
          <p data-testid="calendar-result" className="mt-3 text-sm text-foreground">
            {state.text}
          </p>
        )}
        {state.kind === 'error' && (
          <p data-testid="calendar-error" className="mt-3 text-sm text-foreground">
            {state.message}
          </p>
        )}
      </div>
    </div>
  )
}
