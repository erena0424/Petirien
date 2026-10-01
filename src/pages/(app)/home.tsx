/**
 * Home: two doors, check in or look back. Shows the last check-in when there is one.
 */

import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Bunny } from '@/components/Bunny'
import { formatCheckinDate } from '@/lib/format'
import { ENERGY, MOOD, label } from '@/lib/labels'

interface CheckinRow {
  mood: number
  energy: number
  minutes: number
}

const primary =
  'inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const secondary =
  'inline-flex min-h-12 items-center rounded-xl border border-input bg-card px-6 text-base font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

export default function HomePage() {
  // Empty when signed out or when there is nothing yet.
  const last = useQuery<CheckinRow>('checkins', { orderBy: 'createdAt', orderDir: 'desc', limit: 1 })
  const latest = last.status === 'ready' ? last.records[0] : undefined

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-12">
      <Bunny size={150} className="-ml-2" />
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
        Not sure what would help? Let&apos;s find something small.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
        Tell me how you feel and how much time you have. I&apos;ll pick a few things worth your minutes, and there&apos;s
        no scrolling to do.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/checkin" className={primary}>
          Check in
        </Link>
        <Link to="/history" className={secondary}>
          Past check-ins
        </Link>
      </div>

      {latest && (
        <Link
          to="/history"
          data-testid="last-checkin"
          className="mt-10 block rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] hover:bg-secondary"
        >
          <p className="text-sm font-semibold text-foreground">Last time</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCheckinDate(latest.createdAt)} · feeling {label(MOOD, latest.data.mood).toLowerCase()}, {label(ENERGY, latest.data.energy).toLowerCase()} energy, {latest.data.minutes} min
          </p>
        </Link>
      )}
    </div>
  )
}
