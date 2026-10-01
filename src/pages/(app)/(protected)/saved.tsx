/**
 * Saved videos: your own library, reachable without a check-in.
 * Private to the signed-in person. Stored YouTube details are refreshed
 * (or withheld) to stay inside YouTube's 30-day rule; see lib/saved.ts.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ConfirmModal, Textarea } from '@/components/ui'
import { Bunny } from '@/components/Bunny'
import { ChoiceGroup } from '@/components/ChoiceGroup'
import { Instructions } from '@/components/checkin/Instructions'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { callAction } from '@/lib/actions-client'
import { formatDuration } from '@/lib/format'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  categoryOf,
  displayMeta,
  needsRefresh,
  type SavedData,
} from '@/lib/saved'
import { useSavedVideos } from '@/lib/use-saved'
import { watchUrl, type PlayerErrorKind } from '@/lib/youtube'
import { getActivity } from '../../../catalog'

type Filter = 'all' | (typeof CATEGORY_ORDER)[number]

const REFRESH_KEY = 'petirien.savedRefreshTried'

export default function SavedPage() {
  const saved = useSavedVideos()
  const [filter, setFilter] = useState<Filter>('all')
  const [removing, setRemoving] = useState<string | null>(null)

  // Try to refresh stale details once per browser session. Best effort: a failure changes nothing.
  useEffect(() => {
    if (saved.status !== 'ready') return
    if (!saved.records.some((r) => needsRefresh(r.data))) return
    try {
      if (sessionStorage.getItem(REFRESH_KEY)) return
      sessionStorage.setItem(REFRESH_KEY, '1')
    } catch {
      /* storage unavailable: try anyway, once per mount */
    }
    void callAction('refreshSaved')
  }, [saved.status, saved.records])

  const visible = saved.records.filter((r) => filter === 'all' || categoryOf(r.data.activityId) === filter)
  const presentCategories = CATEGORY_ORDER.filter((c) => saved.records.some((r) => categoryOf(r.data.activityId) === c))
  const anyWithheld = saved.records.some((r) => displayMeta(r.data).withheld)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved videos</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Things you liked, ready whenever you are. No check-in needed.
      </p>

      <div className="mt-8">
        {saved.status === 'loading' && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading your saved videos…
          </p>
        )}

        {saved.status === 'error' && (
          <div role="alert" className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium text-foreground">We couldn&apos;t load your saved videos.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and reload the page.</p>
          </div>
        )}

        {saved.status === 'ready' && saved.records.length === 0 && (
          <div data-testid="saved-empty" className="flex flex-col items-center py-12 text-center">
            <Bunny className="w-48 sm:w-60" />
            <p className="mt-4 text-lg font-semibold text-foreground">Nothing saved yet</p>
            <p className="mt-1 max-w-xs text-muted-foreground">
              When an idea looks good, tap Save and it will wait for you here.
            </p>
            <Link
              to="/checkin"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Check in
            </Link>
          </div>
        )}

        {saved.status === 'ready' && saved.records.length > 0 && (
          <>
            {presentCategories.length > 1 && (
              <div className="mb-6">
                <ChoiceGroup<Filter>
                  legend="Show"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    ...presentCategories.map((c) => ({ value: c as Filter, label: CATEGORY_LABELS[c] })),
                  ]}
                />
              </div>
            )}

            {anyWithheld && (
              <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-foreground" data-testid="withheld-note">
                Some video details are hidden until they can be refreshed from YouTube. Your notes and saved videos are safe.
              </p>
            )}

            <ul className="space-y-4" data-testid="saved-list">
              {visible.map((r) => (
                <SavedCard
                  key={r.recordId}
                  recordId={r.recordId}
                  data={r.data}
                  onRemove={() => setRemoving(r.recordId)}
                  onNote={(note) => void saved.setNote(r.recordId, note)}
                  onAvailability={(a) => void saved.setAvailability(r.recordId, a)}
                />
              ))}
            </ul>
            {visible.length === 0 && <p className="text-muted-foreground">Nothing saved in this group yet.</p>}
          </>
        )}
      </div>

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const id = removing
          setRemoving(null)
          const rec = saved.records.find((r) => r.recordId === id)
          if (rec) void saved.unsave(rec.data.videoId)
        }}
        title="Remove this saved video?"
        description="It will be removed from your saved videos, along with your note."
        confirmText="Remove"
      />
    </div>
  )
}

interface CardProps {
  recordId: string
  data: SavedData
  onRemove: () => void
  onNote: (note: string) => void
  onAvailability: (a: 'no_embed' | 'gone') => void
}

function SavedCard({ recordId, data, onRemove, onNote, onAvailability }: CardProps) {
  const meta = displayMeta(data)
  const [playing, setPlaying] = useState(false)
  const [note, setNote] = useState(data.userNote ?? '')
  const activity = data.activityId ? getActivity(data.activityId) : undefined
  const length = formatDuration(meta.durationSec)
  const gone = data.availability === 'gone'
  const noEmbed = data.availability === 'no_embed'

  function unavailable(kind: PlayerErrorKind) {
    if (kind === 'unavailable') onAvailability('gone')
    else if (kind === 'embed_blocked') onAvailability('no_embed')
  }

  return (
    <li data-testid="saved-item" className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-4 p-4">
        {meta.thumbnail && (
          <img src={meta.thumbnail} alt="" loading="lazy" className="hidden h-20 w-36 shrink-0 rounded-lg bg-muted object-cover sm:block" />
        )}
        <div className="min-w-0 flex-1">
          {activity && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{activity.title}</p>
          )}
          <h2 className="mt-1 text-base font-semibold leading-snug text-foreground">{meta.title}</h2>
          {(length || meta.channel) && (
            <p className="mt-1 text-xs text-muted-foreground">{[length, meta.channel].filter(Boolean).join(' · ')}</p>
          )}
          {gone && (
            <p data-testid="badge-gone" className="mt-2 inline-block rounded-full bg-accent px-3 py-1 text-sm text-foreground">
              No longer on YouTube
            </p>
          )}
          {noEmbed && (
            <p data-testid="badge-no-embed" className="mt-2 inline-block rounded-full bg-accent px-3 py-1 text-sm text-foreground">
              Can&apos;t play here. Opens on YouTube.
            </p>
          )}
        </div>
      </div>

      {playing && !gone && !noEmbed && (
        <div className="px-4 pb-4">
          <YouTubePlayer videoId={data.videoId} onEnded={() => setPlaying(false)} onUnavailable={unavailable} />
        </div>
      )}

      {activity && (
        <div className="px-4 pb-2">
          <Instructions activityId={activity.id} />
        </div>
      )}

      <div className="px-4 pb-4">
        <label htmlFor={`note-${recordId}`} className="text-sm font-medium text-foreground">
          Your note
        </label>
        <Textarea
          id={`note-${recordId}`}
          value={note}
          rows={2}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (data.userNote ?? '') && onNote(note)}
          placeholder="Why you saved it, or how to make it easier"
          className="mt-1 border-input bg-card"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-4 py-3">
        {!gone && !noEmbed && (
          <Button onClick={() => setPlaying((p) => !p)} aria-label={`${playing ? 'Close' : 'Watch'}: ${meta.title}`}>
            {playing ? 'Close' : 'Watch'}
          </Button>
        )}
        {!gone && (
          <a
            href={watchUrl(data.videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Open on YouTube
          </a>
        )}
        <Button variant="ghost" onClick={onRemove} aria-label={`Remove from saved: ${meta.title}`}>
          Remove
        </Button>
      </div>
    </li>
  )
}
