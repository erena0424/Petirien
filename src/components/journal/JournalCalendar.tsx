import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ENERGY, GOAL_LABELS, MOOD, label } from '@/lib/labels'
import type { CheckinRow } from '@/lib/use-checkins'
import { cn } from '@/lib/utils'
import type { Plan } from '../../plans/plan'
import { addDays, dayKey, fullDate, monthGrid, sameDay, weekDays, type View } from '../../journal/calendar'
import { chartRange } from '../../journal/mood'
import { HOUR_PX, MINUTES_PER_DAY, allDayOn, blockBox, eventsOn, layoutDay, timeRange } from '../../journal/layout'
import { JournalEntryCard, type JournalRecord } from './JournalEntryCard'
import type { ReflectOn } from '../ReflectionDialog'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export interface CheckinItem {
  recordId: string
  createdAt: string
  data: CheckinRow
}

interface Common {
  /** Journal entries by local day. */
  byDay: Map<string, JournalRecord[]>
  /** Check-ins (mood and energy) by local day. */
  checkins: Map<string, CheckinItem[]>
  /** Calendar events in view (empty until the person shows their calendar). */
  events: Plan[]
  /** Event ids that already have journal entries. */
  reflected: Set<string>
  anchor: Date
  onSelect: (d: Date) => void
  onOpenEvent: (p: Plan) => void
  onEdit: (plan: ReflectOn) => void
  onDelete: (recordId: string) => void
}

const countLabel = (n: number, noun: string) => (n === 0 ? `no ${noun}s` : n === 1 ? `1 ${noun}` : `${n} ${noun}s`)
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
/** "Feeling low, medium energy", the same words as the check-in form. */
export const feelingLine = (c: CheckinRow) => `Feeling ${label(MOOD, c.mood).toLowerCase()}, ${label(ENERGY, c.energy).toLowerCase()} energy`

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })

/** One event as a row: time, name, a marker if it has a journal entry, and the one action. Used in the day's agenda. */
function EventRow({ plan, reflected, onOpen }: { plan: Plan; reflected: boolean; onOpen: (p: Plan) => void }) {
  return (
    <li>
      <button
        type="button"
        data-testid="agenda-event"
        onClick={() => onOpen(plan)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-foreground">{plan.title}</span>
          <span className="block text-sm text-muted-foreground">{timeRange(plan)}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-primary">{reflected ? 'In your journal' : 'Open'}</span>
      </button>
    </li>
  )
}

/** What is on the calendar for the day chosen, then the journal for the whole stretch on screen (month, week or day). */
export function DayAgenda({ byDay, events, reflected, anchor, view, onOpenEvent, onEdit, onDelete }: Omit<Common, 'onSelect'> & { view: View }) {
  const planned = eventsOn(events, anchor)
  const { from, to } = chartRange(view, anchor, new Date())
  // Every entry whose day falls in the range, newest day first and newest first within a day: like the List tab, for these days.
  const written = [...byDay.entries()]
    .filter(([key]) => key >= dayKey(from) && key < dayKey(to))
    .sort(([x], [y]) => (x < y ? 1 : -1))
    .flatMap(([, list]) => list)
  const noun = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'
  return (
    <div>
      {planned.length > 0 && (
        <section aria-labelledby="day-heading" className="mt-6">
          <h2 id="day-heading" className="text-lg font-bold text-foreground">
            {fullDate(anchor)}
          </h2>
          <ul className="mt-3 space-y-2" aria-label="On the calendar" data-testid="journal-day-events">
            {planned.map((p) => (
              <EventRow key={p.id} plan={p} reflected={reflected.has(p.id)} onOpen={onOpenEvent} />
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="entries-heading" data-testid="journal-day-entries" className="mt-6">
        <h2 id="entries-heading" className="text-lg font-bold text-foreground">
          Journal entries
        </h2>
        {written.length === 0 ? (
          <p data-testid="journal-day-empty" className="mt-2 text-sm text-muted-foreground">
            Nothing written this {noun}.
          </p>
        ) : (
          <ul className="mt-3 space-y-4" data-testid="journal-range-entries">
            {written.map((r) => (
              <JournalEntryCard key={r.recordId} record={r} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** A month like a paper calendar: event names in each day, dots for journal entries. Choose a day to read it below. */
export function MonthView(c: Common) {
  const grid = monthGrid(c.anchor)
  const today = new Date()
  return (
    <div>
      <table role="grid" aria-label="Month" data-testid="journal-month" className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 text-xs font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week) => (
            <tr key={dayKey(week[0]!)}>
              {week.map((d) => {
                const written = c.byDay.get(dayKey(d))?.length ?? 0
                const planned = eventsOn(c.events, d)
                const checked = c.checkins.get(dayKey(d))?.length ?? 0
                const inMonth = d.getMonth() === c.anchor.getMonth()
                const selected = sameDay(d, c.anchor)
                return (
                  <td key={dayKey(d)} className="p-0 align-top">
                    <button
                      type="button"
                      data-testid="journal-day"
                      data-date={dayKey(d)}
                      data-count={written}
                      data-events={planned.length}
                      data-checkins={checked}
                      aria-pressed={selected}
                      aria-label={`${fullDate(d)}, ${countLabel(written, 'journal entry').replace('journal entrys', 'journal entries')}, ${countLabel(planned.length, 'event')}, ${countLabel(checked, 'check-in')}`}
                      onClick={() => c.onSelect(d)}
                      className={cn(
                        'flex min-h-16 w-full flex-col items-stretch gap-0.5 rounded-xl border p-1 text-left text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-28',
                        selected ? 'border-primary bg-accent font-semibold text-foreground' : 'border-transparent hover:bg-secondary',
                        inMonth ? 'text-foreground' : 'text-muted-foreground opacity-60',
                        sameDay(d, today) && !selected && 'border-input',
                      )}
                    >
                      <span className="flex items-center justify-between px-0.5">
                        <span>{d.getDate()}</span>
                        <span aria-hidden className="flex gap-0.5">
                          {Array.from({ length: Math.min(written, 3) }, (_, i) => (
                            <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary" />
                          ))}
                          {checked > 0 && <span className="h-1.5 w-1.5 rounded-full border border-primary" data-testid="checkin-dot" />}
                        </span>
                      </span>
                      {/* Event names show on wider screens; on a phone a small bar says there is something. */}
                      <span className="hidden flex-col gap-0.5 sm:flex">
                        {planned.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className={cn(
                              'truncate rounded bg-secondary px-1 text-[11px] font-normal leading-4 text-foreground',
                              c.reflected.has(p.id) && 'border-l-2 border-primary',
                            )}
                          >
                            {p.allDay ? '' : `${clock(p.start).replace(/ ?[AP]M/i, '')} `}
                            {p.title}
                          </span>
                        ))}
                        {planned.length > 3 && <span className="px-1 text-[11px] font-normal text-muted-foreground">+{planned.length - 3} more</span>}
                      </span>
                      {planned.length > 0 && <span aria-hidden className="mx-0.5 mt-auto h-1 rounded bg-secondary sm:hidden" />}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <DayAgenda {...c} view="month" />
    </div>
  )
}

/** The hours of one or more days, like iCal: events sit at their times, side by side when they overlap. */
function TimeGrid({ days, c, minWidth }: { days: Date[]; c: Common; minWidth: number }) {
  const scroller = useRef<HTMLDivElement>(null)
  const today = new Date()
  const now = today.getHours() * 60 + today.getMinutes()
  const firstKey = dayKey(days[0]!)

  // Start the view at the first thing of the day (or 7 AM), not at midnight.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const starts = days.flatMap((d) => layoutDay(c.events, d).map((b) => b.startMin))
    const first = starts.length ? Math.min(...starts) : 7 * 60
    el.scrollTop = Math.max(0, (Math.min(first, 18 * 60) - 30) * (HOUR_PX / 60))
  }, [firstKey, days.length, c.events.length])

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div style={{ minWidth }}>
        {/* Day names and the all-day strip stay put while the hours scroll. */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => {
            const allDay = allDayOn(c.events, d)
            return (
              <div key={dayKey(d)} className="min-w-0 border-l border-border px-1 pb-1 pt-1.5">
                <button
                  type="button"
                  onClick={() => c.onSelect(d)}
                  className={cn(
                    'flex min-h-10 w-full flex-col items-center rounded-lg text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    sameDay(d, today) && 'bg-accent font-semibold',
                  )}
                >
                  <span className="text-xs text-muted-foreground">{d.toLocaleDateString([], { weekday: 'short' })}</span>
                  <span className="text-foreground">{d.getDate()}</span>
                </button>
                {allDay.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="allday-event"
                    onClick={() => c.onOpenEvent(p)}
                    className="mt-1 block w-full truncate rounded bg-secondary px-1.5 py-0.5 text-left text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div ref={scroller} data-testid="time-grid" className="max-h-[34rem] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
            <div className="relative" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="absolute right-1 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: h * HOUR_PX, display: h === 0 ? 'none' : undefined }}>
                  {hourLabel(h)}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const blocks = layoutDay(c.events, d)
              const written = (c.byDay.get(dayKey(d)) ?? []).filter((r) => !r.data.eventId || !c.events.some((p) => p.id === r.data.eventId))
              return (
                <div key={dayKey(d)} data-testid="time-column" data-date={dayKey(d)} className="relative min-w-0 border-l border-border" style={{ height: 24 * HOUR_PX }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} aria-hidden className="absolute inset-x-0 border-t border-border/70" style={{ top: h * HOUR_PX }} />
                  ))}
                  {sameDay(d, today) && (
                    <div aria-hidden data-testid="now-line" className="absolute inset-x-0 z-10 border-t-2 border-primary" style={{ top: (now / MINUTES_PER_DAY) * 24 * HOUR_PX }} />
                  )}
                  {blocks.map((b) => {
                    const box = blockBox(b)
                    return (
                      <button
                        key={b.plan.id}
                        type="button"
                        data-testid="event-block"
                        data-start-min={b.startMin}
                        data-end-min={b.endMin}
                        data-lane={b.lane}
                        data-lanes={b.lanes}
                        onClick={() => c.onOpenEvent(b.plan)}
                        aria-label={`${b.plan.title}, ${timeRange(b.plan)}${c.reflected.has(b.plan.id) ? ', in your journal' : ''}`}
                        style={{ top: box.top, height: box.height, left: box.left, width: box.width }}
                        className={cn(
                          'absolute overflow-hidden rounded-lg border bg-accent px-1.5 py-1 text-left text-xs leading-tight text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          c.reflected.has(b.plan.id) ? 'border-primary' : 'border-border',
                        )}
                      >
                        <span className="block truncate font-semibold">{b.plan.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{clock(b.plan.start)}</span>
                      </button>
                    )
                  })}
                  {(c.checkins.get(dayKey(d)) ?? []).map((ck) => {
                    const t = new Date(ck.createdAt)
                    const min = t.getHours() * 60 + t.getMinutes()
                    return (
                      <button
                        key={ck.recordId}
                        type="button"
                        data-testid="checkin-marker"
                        onClick={() => c.onSelect(d)}
                        aria-label={`Check-in: ${feelingLine(ck.data)}, ${clock(ck.createdAt)}`}
                        style={{ top: (min / 60) * HOUR_PX }}
                        className="absolute left-0.5 z-20 max-w-[60%] truncate rounded-full border border-dashed border-primary bg-card px-2 py-0.5 text-[11px] text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {label(MOOD, ck.data.mood)} · {label(ENERGY, ck.data.energy)}
                      </button>
                    )
                  })}
                  {written.map((r) => {
                    const t = new Date(r.createdAt)
                    const min = t.getHours() * 60 + t.getMinutes()
                    return (
                      <button
                        key={r.recordId}
                        type="button"
                        data-testid="journal-marker"
                        onClick={() => c.onSelect(d)}
                        aria-label={`Journal: ${r.data.title}, ${clock(r.createdAt)}`}
                        style={{ top: (min / 60) * HOUR_PX }}
                        className="absolute right-0.5 z-20 max-w-[85%] truncate rounded-full border border-primary bg-card px-2 py-0.5 text-[11px] text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {r.data.title}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Seven days with hours, Sunday to Saturday. */
export function WeekView(c: Common) {
  return (
    <div data-testid="journal-week">
      <TimeGrid days={weekDays(c.anchor)} c={c} minWidth={720} />
      <DayAgenda {...c} view="week" />
    </div>
  )
}

/** One day with hours, arrows to the day before and after, and everything written that day below. */
export function DayView(c: Common) {
  return (
    <div data-testid="journal-dayview">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="min-h-10" onClick={() => c.onSelect(addDays(c.anchor, -1))} aria-label="Previous day">
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Previous day
        </Button>
        <Button variant="ghost" size="sm" className="min-h-10" onClick={() => c.onSelect(addDays(c.anchor, 1))} aria-label="Next day">
          Next day
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Button>
      </div>
      <TimeGrid days={[c.anchor]} c={c} minWidth={0} />
      <DayAgenda {...c} view="day" />
    </div>
  )
}
