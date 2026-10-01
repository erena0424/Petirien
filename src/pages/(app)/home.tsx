/**
 * Home: a place to land. Shows how you have been looking after yourself
 * (calendar and a gentle streak), one small thing for right now, and what you
 * saved. Everything here is computed from your own data in the browser, with
 * no model call. Signed out, it is just the welcome and the Check in button.
 */

import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Bunny } from '@/components/Bunny'
import { ChatBox } from '@/components/ChatBox'
import { MonthCalendar } from '@/components/MonthCalendar'
import { SaveButton } from '@/components/SaveButton'
import { Instructions } from '@/components/checkin/Instructions'
import { checkinDays, currentStreak, daysInMonthWithCheckin, encouragement } from '@/lib/calendar'
import { GREETING, PART_LABEL, orderSavedForNow, partOfDay, pickForNow } from '@/lib/for-now'
import { formatCheckinDate } from '@/lib/format'
import { ENERGY, MOOD, label } from '@/lib/labels'
import { useJournal } from '@/lib/use-journal'
import { usePreferences } from '@/lib/use-preferences'
import { useSavedIdeas } from '@/lib/use-saved-ideas'
import { useSavedVideos } from '@/lib/use-saved'
import { getActivity } from '../../catalog'

interface CheckinRow {
  mood: number
  energy: number
  minutes: number
}

const primary =
  'inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const secondary =
  'inline-flex min-h-12 items-center rounded-xl border border-input bg-card px-6 text-base font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const card = 'rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]'

export default function HomePage() {
  const now = new Date()
  const checkins = useQuery<CheckinRow>('checkins', { orderBy: 'createdAt', orderDir: 'desc' })
  const videos = useSavedVideos()
  const ideas = useSavedIdeas()
  const prefs = usePreferences()
  const journal = useJournal()

  // A day counts when you did something for yourself: a check-in or a saved journal entry.
  const days = checkinDays([...checkins.records.map((r) => r.createdAt), ...journal.records.map((r) => r.createdAt)])
  const daySet = new Set(days.keys())
  const streak = currentStreak(daySet, now)
  const month = daysInMonthWithCheckin(daySet, now.getFullYear(), now.getMonth())
  const cheer = encouragement(streak, month)
  const latest = checkins.status === 'ready' ? checkins.records[0] : undefined

  const savedItems = [
    ...videos.records.map((r) => ({ kind: 'video' as const, activityId: r.data.activityId, createdAt: r.createdAt, id: r.recordId, title: r.data.title || 'Saved video' })),
    ...ideas.records.map((r) => ({ kind: 'idea' as const, activityId: r.data.activityId, createdAt: r.createdAt, id: r.recordId, title: getActivity(r.data.activityId)?.title ?? 'Saved idea' })),
  ]
  const ordered = orderSavedForNow(savedItems, now).slice(0, 4)

  const forNow = pickForNow({ now, avoid: prefs.prefs.avoid })

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4">
        <Bunny className="w-28 shrink-0 sm:w-36" />
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{GREETING[partOfDay(now)]}</h1>
          <p className="mt-1 text-base text-muted-foreground">Say what&apos;s on your mind, or let&apos;s find something small to do.</p>
        </div>
      </div>

      <section className={`${card} mt-6`} aria-label="Talk to the bunny">
        <ChatBox />
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/checkin" className={primary} data-testid="do-something">
          Do something little for yourself
        </Link>
        <Link to="/journal" className={secondary}>
          Journal
        </Link>
        <Link to="/saved" className={secondary}>
          Saved
        </Link>
      </div>

      <section className={`${card} mt-8`} aria-labelledby="calendar-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="calendar-heading" className="text-lg font-bold text-foreground">
            Taking care of yourself
          </h2>
          {cheer && (
            <p data-testid="cheer" className="text-sm font-medium text-foreground">
              {cheer}
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Each filled day is a day you did something for yourself.</p>
        <div className="mt-4">
          <MonthCalendar days={days} now={now} />
        </div>
        {latest && (
          <Link to="/history" data-testid="last-checkin" className="mt-4 block text-sm text-muted-foreground underline-offset-4 hover:underline">
            Last time: {formatCheckinDate(latest.createdAt)} · feeling {label(MOOD, latest.data.mood).toLowerCase()}, {label(ENERGY, latest.data.energy).toLowerCase()} energy
          </Link>
        )}
      </section>

      {forNow && (
        <section className={`${card} mt-6`} aria-labelledby="now-heading" data-testid="for-now">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">For {PART_LABEL[partOfDay(now)]}</p>
          <h2 id="now-heading" className="mt-1 text-lg font-bold text-foreground">
            {forNow.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{forNow.blurb}</p>
          <div className="mt-2">
            <Instructions activityId={forNow.id} />
          </div>
          <SaveForNow activityId={forNow.id} title={forNow.title} />
        </section>
      )}

      <section className="mt-6" aria-labelledby="saved-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="saved-heading" className="text-lg font-bold text-foreground">
            From your saved
          </h2>
          {savedItems.length > 0 && (
            <Link to="/saved" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              See all
            </Link>
          )}
        </div>
        {savedItems.length === 0 ? (
          <p data-testid="home-saved-empty" className="mt-2 text-sm text-muted-foreground">
            Nothing saved yet. When an idea looks good, tap Save and it will show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="home-saved">
            {ordered.map(({ item, fits }) => (
              <li key={item.id}>
                <Link
                  to="/saved"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.kind === 'video' ? 'Video' : 'Idea'}
                      {getActivity(item.activityId ?? '')?.title && item.kind === 'video' ? ` · ${getActivity(item.activityId ?? '')!.title}` : ''}
                    </span>
                  </span>
                  {fits && <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs text-foreground">Good for {PART_LABEL[partOfDay(now)]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Save the "for now" suggestion as an idea. */
function SaveForNow({ activityId, title }: { activityId: string; title: string }) {
  const ideas = useSavedIdeas()
  return (
    <div className="mt-3">
      <SaveButton
        saved={ideas.isSaved(activityId)}
        disabled={!ideas.ready}
        onToggle={() => (ideas.isSaved(activityId) ? void ideas.unsave(activityId) : void ideas.save(activityId))}
        label={title}
      />
    </div>
  )
}
