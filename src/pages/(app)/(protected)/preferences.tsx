/**
 * Preferences: what to avoid, what you like, how much time you usually have,
 * and a way to delete everything. All private to the signed-in person.
 */

import { PageHeader } from '@/components/PageHeader'
import { useEffect, useRef, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Button, ConfirmModal } from '@/components/ui'
import { CheckChips } from '@/components/CheckChips'
import { ChoiceGroup } from '@/components/ChoiceGroup'
import {
  AVOID_OPTIONS,
  LIKE_OPTIONS,
  MINUTE_CHOICES,
  avoidsTooMuch,
  normalizePreferences,
  type Preferences,
  type ScreenMode,
} from '@/lib/preferences'
import { SCREEN_CHOICES } from '@/components/checkin/CheckinForm'
import { usePlaceFeedback } from '@/lib/use-place-feedback'
import { daysUntilBack, type RatingInfo } from '../../../places/places'
import { usePreferences } from '@/lib/use-preferences'
import { STYLE_KEYS, STYLE_LABELS, describeStyle, type BunnyStyle, type StyleKey } from '../../../reflect/style'

type Minutes = number | 0

export default function PreferencesPage() {
  const { status, prefs, style, setStyle, ready, save } = usePreferences()
  const [draft, setDraft] = useState<Preferences>(prefs)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')

  // Fill the form once, when the stored preferences arrive.
  useEffect(() => {
    if (status === 'ready' && !loaded) {
      setDraft(prefs)
      setLoaded(true)
    }
  }, [status, prefs, loaded])

  const change = (next: Partial<Preferences>) => {
    setSaved('idle')
    setDraft((d) => normalizePreferences({ ...d, ...next }))
  }

  async function onSave() {
    setSaved('saving')
    setSaved((await save(draft)) ? 'done' : 'failed')
  }

  return (
    <div className="w-full">
      <PageHeader title="Preferences">
        Tell me what suits you, and I&apos;ll offer fewer things that don&apos;t.
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 [&>*]:max-w-3xl">

      {status === 'loading' && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Loading your preferences…
        </p>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-6 rounded-3xl border border-border bg-card p-5">
          <p className="font-medium text-foreground">We couldn&apos;t load your preferences.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and reload the page.</p>
        </div>
      )}

      {status === 'ready' && (
        <form
          className="mt-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            void onSave()
          }}
        >
          <CheckChips
            legend="I'd rather not have"
            hint="I won't suggest anything with these."
            options={AVOID_OPTIONS}
            selected={draft.avoid}
            onChange={(avoid) => change({ avoid })}
          />
          {avoidsTooMuch(draft.avoid) && (
            <p role="status" data-testid="avoid-warning" className="-mt-4 rounded-xl bg-accent p-3 text-sm text-foreground">
              That&apos;s a lot to avoid, so I may have very little to suggest. You can change this any time.
            </p>
          )}

          <CheckChips
            legend="I tend to like"
            hint={
              LIKE_OPTIONS.some((o) => draft.avoid.includes(o.tag))
                ? 'These nudge what I show first. Greyed-out ones are things you chose to avoid above.'
                : 'These nudge what I show first.'
            }
            options={LIKE_OPTIONS}
            selected={draft.likedTags}
            onChange={(likedTags) => change({ likedTags })}
            disabledTags={draft.avoid}
          />

          <ChoiceGroup<Minutes>
            legend="How much time do you usually have?"
            hint="I'll start the check-in with this. You can still change it."
            value={(draft.defaultMinutes ?? 0) as Minutes}
            onChange={(m) => change({ defaultMinutes: m === 0 ? null : m })}
            options={[{ value: 0, label: 'No usual' }, ...MINUTE_CHOICES.map((m) => ({ value: m, label: `${m} min` }))]}
          />

          <ChoiceGroup<ScreenMode>
            legend="Screen or no screen?"
            hint="Not sure shows a mix: a video where it helps, and plain ideas. I'll start the check-in with this."
            value={draft.screen}
            onChange={(screen) => change({ screen })}
            options={SCREEN_CHOICES}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!ready} loading={saved === 'saving'}>
              Save preferences
            </Button>
            {saved === 'done' && (
              <p role="status" data-testid="prefs-saved" className="text-sm font-medium text-foreground">
                Saved. I&apos;ll use these from now on.
              </p>
            )}
            {saved === 'failed' && (
              <p role="alert" className="text-sm text-foreground">
                That didn&apos;t save. Please try again.
              </p>
            )}
          </div>
        </form>
      )}

      {status === 'ready' && <BunnyStyleSettings style={style} ready={ready} onChange={setStyle} />}

      <RatedPlaces />
      <DeleteEverything />
      </div>
    </div>
  )
}

interface Counts {
  checkins: number
  suggestions: number
  saved: number
}

function ratingLabel(info: RatingInfo): string {
  if (info.rating === 'yes') return 'Good'
  if (info.rating === 'never') return 'Never suggest'
  const days = daysUntilBack(info, Date.now())
  return days > 0 ? `Not right now (back in about ${days} day${days === 1 ? '' : 's'})` : 'Not right now (back in the mix)'
}

/** Places the person marked good or not for them, so it is clear what is remembered and easy to undo. */
function RatedPlaces() {
  const feedback = usePlaceFeedback()
  if (feedback.status !== 'ready' || feedback.records.length === 0) return null
  return (
    <section className="mt-10" aria-labelledby="places-heading" data-testid="rated-places">
      <h2 id="places-heading" className="text-xl font-bold text-foreground">
        Places you rated
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A place you marked good comes up now and then, alongside new ones. &ldquo;Not right now&rdquo; leaves a place out for a couple of weeks, and &ldquo;never&rdquo; keeps it out. Remove one to undo it.
      </p>
      <ul className="mt-3 space-y-2">
        {feedback.records.map((r) => (
          <li key={r.recordId} data-testid="rated-place" className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2">
            <span className="min-w-0 text-sm text-foreground">
              <span className="font-semibold">{r.data.name || 'A place'}</span>
              <span className="text-muted-foreground"> · {ratingLabel({ rating: r.data.rating, at: typeof r.data.ratedAt === 'number' ? r.data.ratedAt : Date.parse(r.createdAt) || 0 })}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => void feedback.remove(r.recordId)} aria-label={`Remove rating: ${r.data.name || 'place'}`}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Removes the person's check-ins, suggestions, saved videos, and preferences. */
function DeleteEverything() {
  const checkins = useQuery<Record<string, unknown>>('checkins')
  const suggestions = useQuery<Record<string, unknown>>('suggestions')
  const saved = useQuery<Record<string, unknown>>('savedVideos')
  const ideas = useQuery<Record<string, unknown>>('savedIdeas')
  const journal = useQuery<Record<string, unknown>>('journalEntries')
  const conversations = useQuery<Record<string, unknown>>('conversations')
  const messages = useQuery<Record<string, unknown>>('messages')
  const prefs = useQuery<Record<string, unknown>>('preferences')
  const placeRatings = useQuery<Record<string, unknown>>('placeFeedback')
  const mCheckins = useMutations<Record<string, unknown>>('checkins')
  const mSuggestions = useMutations<Record<string, unknown>>('suggestions')
  const mSaved = useMutations<Record<string, unknown>>('savedVideos')
  const mIdeas = useMutations<Record<string, unknown>>('savedIdeas')
  const mJournal = useMutations<Record<string, unknown>>('journalEntries')
  const mConversations = useMutations<Record<string, unknown>>('conversations')
  const mMessages = useMutations<Record<string, unknown>>('messages')
  const mPrefs = useMutations<Record<string, unknown>>('preferences')
  const mPlaces = useMutations<Record<string, unknown>>('placeFeedback')

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'idle' | 'done' | 'failed'>('idle')

  const counts: Counts = { checkins: checkins.records.length, suggestions: suggestions.records.length, saved: saved.records.length + ideas.records.length }
  const total =
    counts.checkins +
    counts.suggestions +
    counts.saved +
    prefs.records.length +
    journal.records.length +
    conversations.records.length +
    messages.records.length +
    placeRatings.records.length

  async function run() {
    setOpen(false)
    setBusy(true)
    try {
      for (const r of suggestions.records) await mSuggestions.removeConfirmed(r.recordId)
      for (const r of checkins.records) await mCheckins.removeConfirmed(r.recordId)
      for (const r of saved.records) await mSaved.removeConfirmed(r.recordId)
      for (const r of ideas.records) await mIdeas.removeConfirmed(r.recordId)
      for (const r of journal.records) await mJournal.removeConfirmed(r.recordId)
      for (const r of messages.records) await mMessages.removeConfirmed(r.recordId)
      for (const r of conversations.records) await mConversations.removeConfirmed(r.recordId)
      for (const r of placeRatings.records) await mPlaces.removeConfirmed(r.recordId)
      for (const r of prefs.records) await mPrefs.removeConfirmed(r.recordId)
      setResult('done')
    } catch {
      setResult('failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-14 border-t border-border pt-8" aria-labelledby="delete-heading">
      <h2 id="delete-heading" className="text-xl font-bold text-foreground">
        Delete my data
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This removes all your check-ins and notes, your conversations with the bunny, its journal notes, the ideas I suggested, your saved videos and ideas, the places you marked good or not for you, and these preferences.
        It can&apos;t be undone. Your sign-in account itself is not deleted.
      </p>
      <Button
        className="mt-4"
        variant="outline"
        disabled={busy || total === 0}
        loading={busy}
        onClick={() => {
          setResult('idle')
          setOpen(true)
        }}
      >
        Delete everything
      </Button>
      {total === 0 && result !== 'done' && <p className="mt-2 text-sm text-muted-foreground">There&apos;s nothing to delete yet.</p>}
      {result === 'done' && (
        <p role="status" data-testid="delete-done" className="mt-3 text-sm font-medium text-foreground">
          Everything has been deleted.
        </p>
      )}
      {result === 'failed' && (
        <p role="alert" className="mt-3 text-sm text-foreground">
          Some things couldn&apos;t be deleted. Please try again.
        </p>
      )}

      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void run()}
        title="Delete everything?"
        description={`This will permanently delete ${counts.checkins} check-in${counts.checkins === 1 ? '' : 's'}, ${conversations.records.length} conversation${conversations.records.length === 1 ? '' : 's'}, ${journal.records.length} journal entr${journal.records.length === 1 ? 'y' : 'ies'}, ${counts.saved} saved item${counts.saved === 1 ? '' : 's'}, and your preferences.`}
        confirmText="Delete everything"
      />
    </section>
  )
}

/**
 * How the bunny talks with you. A tiny fixed set of choices: the bunny also picks
 * these up on its own when you say how you like it to talk, and this is where you
 * can see, change, or clear them. It never stores what you say here.
 */
function BunnyStyleSettings({
  style,
  ready,
  onChange,
}: {
  style: BunnyStyle
  ready: boolean
  onChange: (next: BunnyStyle) => Promise<boolean>
}) {
  const [saved, setSaved] = useState(false)
  // Quick taps must all stick: keep the latest choices here and save from them, never from a stale copy.
  const [local, setLocal] = useState<BunnyStyle>(style)
  const latest = useRef<BunnyStyle>(style)
  const pending = useRef(0)
  const learned = describeStyle(local)

  // Take in changes that arrive from the server (for example what the bunny picked up), unless a save is in flight.
  useEffect(() => {
    if (pending.current === 0) {
      latest.current = style
      setLocal(style)
    }
  }, [style])

  async function commit(next: BunnyStyle) {
    latest.current = next
    setLocal(next)
    setSaved(false)
    pending.current++
    const ok = await onChange(latest.current) // always the newest choices, even if earlier saves are still running
    pending.current--
    if (pending.current === 0) setSaved(ok)
  }

  async function set(key: StyleKey, value: string) {
    const next = { ...latest.current } as Record<string, string | undefined>
    if (value) next[key] = value
    else delete next[key]
    await commit(next as BunnyStyle)
  }

  return (
    <section className="mt-14 border-t border-border pt-8" aria-labelledby="style-heading" data-testid="bunny-style">
      <h2 id="style-heading" className="text-xl font-bold text-foreground">
        How the bunny talks with you
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The bunny picks this up by itself when you tell it how you like it to talk, like &ldquo;shorter please&rdquo;. It only
        remembers these style choices, never what you say. Change or clear any of them here.
      </p>
      <p data-testid="style-summary" className="mt-3 text-sm text-foreground">
        {learned.length ? `Right now: ${learned.join(', ')}.` : 'Nothing picked up yet.'}
      </p>

      <div className="mt-6 space-y-6">
        {STYLE_KEYS.map((key) => (
          <ChoiceGroup<string>
            key={key}
            legend={STYLE_LABELS[key].question}
            value={local[key] ?? ''}
            onChange={(v) => void set(key, v)}
            options={[{ value: '', label: 'No preference' }, ...Object.entries(STYLE_LABELS[key].options).map(([value, label]) => ({ value, label }))]}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={!ready || learned.length === 0} onClick={() => void commit({})}>
          Forget all of these
        </Button>
        {saved && (
          <p role="status" data-testid="style-saved" className="text-sm font-medium text-foreground">
            Saved.
          </p>
        )}
      </div>
    </section>
  )
}
