import { useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'
import type { usePlans } from '@/lib/use-plans'
import { statusOf, whenText } from '../plans/plan'

interface Props {
  /** The plans (from the calendar and typed by hand), loaded once by the page so everything on it agrees. */
  plans: ReturnType<typeof usePlans>
}

const smallBtn = 'min-h-10 px-3 text-sm'

/**
 * A short list of today's and tomorrow's plans, each with "Talk about this" (before)
 * or "Reflect" (after). Plans come from the person's own Google Calendar, or they
 * type one. This is not an agenda: it shows a handful of things and nothing else.
 */
export function PlansCard({ plans }: Props) {
  const { isSignedIn, isLoaded } = useAuthStatus()
  const [signIn, setSignIn] = useState(false)
  const chat = useBunnyChat()
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState('')
  const now = new Date()
  if (isLoaded && !isSignedIn) {
    return (
      <section data-testid="plans" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-bold text-foreground">
          Coming up in your day
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see what&apos;s coming up on your calendar and to reflect on it with the bunny.</p>
        <Button variant="outline" className="mt-2 min-h-11" onClick={() => setSignIn(true)}>
          Sign in
        </Button>
        {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
      </section>
    )
  }
  const all = [...plans.calendarPlans, ...plans.typed].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const loading = plans.state.kind === 'loading'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (plans.addTyped(title, time)) {
      setTitle('')
      setTime('')
      setFormError('')
      setAdding(false)
    } else setFormError('Add what it is, and a time like 14:30 if you like.')
  }

  return (
    <section data-testid="plans" aria-labelledby="plans-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plans-heading" className="text-lg font-bold text-foreground">
          Coming up in your day
        </h2>
        <div className="flex gap-2">
          {plans.state.kind === 'ready' && (
            <Button variant="ghost" size="sm" onClick={() => void plans.load()} disabled={loading} aria-label="Refresh plans from your calendar">
              <RefreshCw aria-hidden className="h-4 w-4" />
              Refresh
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            Share a plan
          </Button>
        </div>
      </div>

      {plans.state.kind === 'idle' && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Want to talk about what&apos;s coming up? Connect your Google Calendar and I can show it, or share a plan yourself.
          </p>
          <Button variant="outline" className="mt-2" onClick={() => void plans.load()}>
            <CalendarDays aria-hidden className="h-4 w-4" />
            Show my plans
          </Button>
        </div>
      )}

      {loading && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Looking at your calendar…
        </p>
      )}

      {plans.state.kind === 'connect' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-foreground">First, connect your Google Calendar. It opens in a new tab.</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={plans.state.authUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="plans-connect"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Connect Google Calendar
            </a>
            <Button variant="outline" onClick={() => void plans.load()}>
              I&apos;ve connected, check again
            </Button>
          </div>
        </div>
      )}

      {plans.state.kind === 'error' && (
        <p data-testid="plans-error" className="mt-3 text-sm text-foreground">
          {plans.state.message}
        </p>
      )}

      {adding && (
        <form onSubmit={submit} className="mt-3 space-y-2" aria-label="Share a plan">
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              What is it?
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              Time (optional)
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 block min-h-11 rounded-xl border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </label>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-foreground">
              {formError}
            </p>
          )}
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      )}

      {all.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="plans-list">
          {all.map((p) => {
            const status = statusOf(p, now)
            const done = status === 'done'
            return (
              <li key={p.id} data-testid="plan" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold text-foreground">{p.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {status === 'now' && !p.allDay ? 'Happening now' : done ? 'Finished' : whenText(p, now)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button variant={done ? 'default' : 'outline'} className={smallBtn} onClick={() => void chat.startAbout(p)} aria-label={`${done ? 'How was it for you?' : 'Want to talk about this?'} ${p.title}`}>
                    {done ? 'How was it for you?' : 'Want to talk about this?'}
                  </Button>
                  {p.manual && (
                    <Button variant="ghost" className={smallBtn} onClick={() => plans.removeTyped(p.id)} aria-label={`Remove: ${p.title}`}>
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {plans.state.kind === 'ready' && all.length === 0 && (
        <p data-testid="plans-empty" className="mt-3 text-sm text-muted-foreground">
          Nothing on your calendar for today or tomorrow. You can still share a plan.
        </p>
      )}
    </section>
  )
}
