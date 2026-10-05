/**
 * Journal: the bunny's notes from your chats and your own reflections on plans, on a calendar.
 * Month, Week and Day views place every entry on its date (a reflection on the day of its plan),
 * including entries that had nothing to do with a calendar event. Private to the signed-in person.
 */

import { PageHeader } from '@/components/PageHeader'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ConfirmModal, Button } from '@/components/ui'
import { Bunny } from '@/components/Bunny'
import { AddEventDialog } from '@/components/journal/AddEventDialog'
import { EntryDialog } from '@/components/journal/EntryDialog'
import { EventDialog } from '@/components/journal/EventDialog'
import { DayView, MonthView, WeekView, type CheckinItem } from '@/components/journal/JournalCalendar'
import { MoodChart } from '@/components/journal/MoodChart'
import { JournalEntryCard, type JournalRecord } from '@/components/journal/JournalEntryCard'
import { ReflectionDialog, type ReflectOn } from '@/components/ReflectionDialog'
import { useBunnyChat } from '@/lib/bunny-chat'
import { useCalendarRange } from '@/lib/use-calendar-range'
import { useCheckins } from '@/lib/use-checkins'
import { useJournal } from '@/lib/use-journal'
import { useMyPlans } from '@/lib/use-my-plans'
import type { Plan } from '../../../plans/plan'
import { reflectedIds } from '../../../journal/layout'
import { cn } from '@/lib/utils'
import { hhmm } from '../../../journal/slots'
import { VIEWS, dayKey, groupByDay, isView, rangeLabel, shift, startOfDay, type View } from '../../../journal/calendar'

const VIEW_KEY = 'petirien.journalView'
const VIEW_LABEL: Record<View, string> = { month: 'Month', week: 'Week', day: 'Day', list: 'List' }

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return isView(v) ? v : 'month'
  } catch {
    return 'month'
  }
}

/** Shows the calendar on the Journal: a button until it is connected, then a quiet status line. */
function CalendarBar({ state, onLoad }: { state: ReturnType<typeof useCalendarRange>['state']; onLoad: () => void }) {
  if (state.kind === 'ready') return null
  return (
    <div data-testid="calendar-bar" className="mt-3 rounded-3xl bg-accent px-4 py-3 text-sm text-foreground">
      {state.kind === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>See your Google Calendar here, so you can reflect on any event with the bunny, even ones you haven&apos;t written about.</p>
          <Button variant="outline" className="min-h-10" onClick={onLoad}>
            Show my calendar
          </Button>
        </div>
      )}
      {state.kind === 'loading' && <p role="status">Looking at your calendar…</p>}
      {state.kind === 'connect' && (
        <div className="flex flex-wrap items-center gap-3">
          <p>First, connect your Google Calendar. It opens in a new tab.</p>
          <a
            href={state.authUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="calendar-connect"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Connect Google Calendar
          </a>
          <Button variant="outline" className="min-h-10" onClick={onLoad}>
            I&apos;ve connected, check again
          </Button>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3" role="alert" data-testid="calendar-error">
          <p>{state.message}</p>
          <Button variant="outline" className="min-h-10" onClick={onLoad}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}

export default function JournalPage() {
  const journal = useJournal()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<ReflectOn | null>(null)
  const [view, setViewState] = useState<View>(savedView)
  const [openEvent, setOpenEvent] = useState<Plan | null>(null)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  // An event being added: where it starts, from a click or drag on the calendar (or empty, for typing it in).
  const [draft, setDraft] = useState<{ date: string; time: string; endTime: string } | null>(null)
  const lastDraft = useRef({ date: '', time: '', endTime: '' })
  if (draft) lastDraft.current = draft
  const mine = useMyPlans()
  const chat = useBunnyChat()
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))

  const records = journal.records as JournalRecord[]
  const calendar = useCalendarRange(view, anchor)
  const checkinData = useCheckins()
  const checkinRecords = checkinData.records as CheckinItem[]
  const checkins = useMemo(() => {
    const m = new Map<string, CheckinItem[]>()
    for (const r of checkinRecords) {
      const t = Date.parse(r.createdAt)
      if (!Number.isFinite(t)) continue
      const k = dayKey(new Date(t))
      m.set(k, [...(m.get(k) ?? []), r])
    }
    for (const [k, list] of m) m.set(k, [...list].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)))
    return m
  }, [checkinRecords])
  const reflected = useMemo(() => reflectedIds(records.map((r) => r.data)), [records])
  const byDay = useMemo(() => groupByDay(records.map((r) => ({ ...r, kind: r.data.kind, eventStart: r.data.eventStart }))), [records])

  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* storage unavailable: the view just is not remembered */
    }
  }
  // Choosing a day in the month or the week opens that day.
  const select = (d: Date) => {
    setAnchor(startOfDay(d))
    if (view !== 'list') setView('day')
  }
  const openEntry = openEntryId ? records.find((r) => r.recordId === openEntryId) ?? null : null
  const common = {
    byDay,
    checkins,
    events: [...calendar.events, ...mine.plans],
    reflected,
    anchor,
    onSelect: select,
    onOpenEvent: setOpenEvent,
    onOpenEntry: (r: JournalRecord) => setOpenEntryId(r.recordId),
    onCreate: (s: { date: Date; startMin: number; endMin: number }) => setDraft({ date: dayKey(s.date), time: hhmm(s.startMin), endTime: hhmm(s.endMin) }),
    onEdit: setEditing,
    onDelete: setDeleting,
  }

  return (
    <div className="w-full">
      <PageHeader title="Journal">
        The bunny&apos;s notes from when you talked, and your own reflections on your plans, on the day they belong to. Only you can see them. Your chats are
        saved in Chat unless you chose not to save them.
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">

      <div className="mt-8">
        {journal.status === 'loading' && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading your journal…
          </p>
        )}

        {journal.status === 'error' && (
          <div role="alert" className="rounded-3xl border border-border bg-card p-5">
            <p className="font-medium text-foreground">We couldn&apos;t load your journal.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and reload the page.</p>
          </div>
        )}

        {journal.status === 'ready' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="View" className="inline-flex rounded-xl border border-border bg-card p-1">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    data-testid={`journal-view-${v}`}
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      'min-h-10 rounded-lg px-4 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      view === v ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground hover:bg-secondary',
                    )}
                  >
                    {VIEW_LABEL[v]}
                  </button>
                ))}
              </div>

              <p className="max-w-xs text-sm text-muted-foreground" data-testid="add-event-hint">
                {view === 'week' || view === 'day' ? 'Click or drag on the calendar to add an event.' : 'Open a day, then click or drag on the calendar to add an event.'}{' '}
                <button type="button" data-testid="add-event" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setDraft({ date: dayKey(anchor), time: '', endTime: '' })}>
                  Or type one in.
                </button>
              </p>

              {view !== 'list' && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="min-h-10" onClick={() => setAnchor((a) => shift(view, a, -1))} aria-label={`Previous ${view}`}>
                    <ChevronLeft aria-hidden className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-10" onClick={() => setAnchor(startOfDay(new Date()))}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-10" onClick={() => setAnchor((a) => shift(view, a, 1))} aria-label={`Next ${view}`}>
                    <ChevronRight aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <h2 data-testid="journal-range" aria-live="polite" className="mt-5 text-xl font-bold text-foreground">
              {rangeLabel(view, anchor)}
            </h2>

            {view !== 'list' && <CalendarBar state={calendar.state} onLoad={() => void calendar.load()} />}

            <div className="mt-4">
              {view === 'month' && <MonthView {...common} />}
              {view === 'week' && <WeekView {...common} />}
              {view === 'day' && <DayView {...common} />}
              {view === 'list' && records.length === 0 && (
                <div data-testid="journal-empty" className="flex flex-col items-center py-12 text-center">
                  <Bunny className="w-48 sm:w-60" />
                  <p className="mt-4 text-lg font-semibold text-foreground">Nothing here yet</p>
                  <p className="mt-1 max-w-xs text-muted-foreground">Reflect on something with the bunny, and the notes will be here.</p>
                  <Link
                    to="/home"
                    className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Talk to the bunny
                  </Link>
                </div>
              )}
              {view === 'list' && records.length > 0 && (
                <ul className="space-y-4" data-testid="journal-list">
                  {records.map((r) => (
                    <JournalEntryCard key={r.recordId} record={r} onEdit={setEditing} onDelete={setDeleting} />
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8">
              <MoodChart rows={checkinRecords} view={view} anchor={anchor} />
            </div>
          </>
        )}
      </div>

      <EventDialog
        plan={openEvent}
        entries={openEvent ? records.filter((r) => r.data.eventId === openEvent.id) : []}
        onClose={() => setOpenEvent(null)}
        onReflect={(p) => void chat.startAbout(p)}
        onRemove={(p) => mine.remove(p.id)}
      />
      <AddEventDialog open={draft !== null} onClose={() => setDraft(null)} defaultDate={lastDraft.current.date} defaultTime={lastDraft.current.time} defaultEndTime={lastDraft.current.endTime} onAdd={mine.add} />
      <EntryDialog
        record={openEntry}
        onClose={() => setOpenEntryId(null)}
        onEdit={(p) => {
          setOpenEntryId(null)
          setEditing(p)
        }}
        onDelete={(id) => {
          setOpenEntryId(null)
          setDeleting(id)
        }}
      />
      <ReflectionDialog plan={editing} onClose={() => setEditing(null)} />
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const id = deleting
          setDeleting(null)
          if (id) void journal.remove(id)
        }}
        title="Delete this entry?"
        description="This removes the entry. It can't be undone."
        confirmText="Delete"
      />
      </div>
    </div>
  )
}
