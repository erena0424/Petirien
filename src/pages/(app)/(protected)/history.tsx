/**
 * Past check-ins. Everything here is private to the signed-in person: the
 * collections are owner-only and nobody else, including the app owner, can read them.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { Button, ConfirmModal } from '@/components/ui'
import { Bunny } from '@/components/Bunny'
import { formatCheckinDate } from '@/lib/format'
import { ENERGY, GOAL_LABELS, HELPFUL_LABELS, MOOD, label } from '@/lib/labels'

interface CheckinRow {
  mood: number
  energy: number
  minutes: number
  goal?: string
  note?: string
}
interface SuggestionRow {
  checkinId: string
  activityId: string
  title?: string
  status?: string
  helpful?: string
}

export default function HistoryPage() {
  const checkins = useQuery<CheckinRow>('checkins', { orderBy: 'createdAt', orderDir: 'desc' })
  const suggestions = useQuery<SuggestionRow>('suggestions', { orderBy: 'createdAt', orderDir: 'asc' })
  const removeCheckin = useMutations<CheckinRow>('checkins')
  const removeSuggestion = useMutations<SuggestionRow>('suggestions')
  const [deleting, setDeleting] = useState<string | null>(null)

  const byCheckin = new Map<string, typeof suggestions.records>()
  for (const s of suggestions.records) {
    const list = byCheckin.get(s.data.checkinId) ?? []
    list.push(s)
    byCheckin.set(s.data.checkinId, list)
  }

  async function confirmDelete() {
    const id = deleting
    setDeleting(null)
    if (!id) return
    for (const s of byCheckin.get(id) ?? []) await removeSuggestion.remove(s.recordId)
    await removeCheckin.remove(id)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Your check-ins</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Only you can see these. Delete any you don&apos;t want to keep.
      </p>

      <div className="mt-8">
        {checkins.status === 'loading' && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading your check-ins…
          </p>
        )}

        {checkins.status === 'error' && (
          <div role="alert" className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium text-foreground">We couldn&apos;t load your check-ins.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and reload the page.</p>
          </div>
        )}

        {checkins.status === 'ready' && checkins.records.length === 0 && (
          <div data-testid="history-empty" className="flex flex-col items-center py-12 text-center">
            <Bunny className="w-48 sm:w-60" />
            <p className="mt-4 text-lg font-semibold text-foreground">Nothing here yet</p>
            <p className="mt-1 max-w-xs text-muted-foreground">Your check-ins will show up here after you try one.</p>
            <Link
              to="/checkin"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Check in
            </Link>
          </div>
        )}

        {checkins.status === 'ready' && checkins.records.length > 0 && (
          <ul className="space-y-4" data-testid="history-list">
            {checkins.records.map((c) => {
              const ideas = byCheckin.get(c.recordId) ?? []
              const chips = [
                `Feeling ${label(MOOD, c.data.mood).toLowerCase()}`,
                `${label(ENERGY, c.data.energy)} energy`,
                `${c.data.minutes} min`,
                c.data.goal ? GOAL_LABELS[c.data.goal] : '',
              ].filter(Boolean)
              return (
                <li
                  key={c.recordId}
                  data-testid="history-item"
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">{formatCheckinDate(c.createdAt)}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleting(c.recordId)}
                      aria-label={`Delete check-in from ${formatCheckinDate(c.createdAt)}`}
                    >
                      Delete
                    </Button>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {chips.map((t) => (
                      <li key={t} className="rounded-full bg-secondary px-3 py-1 text-sm text-foreground">
                        {t}
                      </li>
                    ))}
                  </ul>

                  {c.data.note && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Your note: </span>
                      {c.data.note}
                    </p>
                  )}

                  {ideas.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-sm font-semibold text-foreground">Ideas I suggested</p>
                      <ul className="mt-2 space-y-1.5">
                        {ideas.map((s) => (
                          <li key={s.recordId} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                            <span className="text-foreground">{s.data.title || s.data.activityId}</span>
                            <span className="text-muted-foreground">
                              {s.data.helpful
                                ? HELPFUL_LABELS[s.data.helpful]
                                : s.data.status === 'rejected'
                                  ? 'Skipped'
                                  : s.data.status === 'opened'
                                    ? 'Watched'
                                    : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete this check-in?"
        description="This removes the check-in, your note, and the ideas I suggested. It can't be undone."
        confirmText="Delete"
      />
    </div>
  )
}
