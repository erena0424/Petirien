/**
 * Preferences: what to avoid, what you like, how much time you usually have,
 * and a way to delete everything. All private to the signed-in person.
 */

import { useEffect, useState } from 'react'
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
} from '@/lib/preferences'
import { usePreferences } from '@/lib/use-preferences'

type Minutes = number | 0

export default function PreferencesPage() {
  const { status, prefs, ready, save } = usePreferences()
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
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Preferences</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Tell me what suits you, and I&apos;ll offer fewer things that don&apos;t.
      </p>

      {status === 'loading' && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Loading your preferences…
        </p>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-6 rounded-2xl border border-border bg-card p-5">
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

          <ChoiceGroup<'auto' | 'none'>
            legend="How do you usually want ideas?"
            hint="Videos only show up where they help, like guided meditation or stretching."
            value={draft.screenFree ? 'none' : 'auto'}
            onChange={(v) => change({ screenFree: v === 'none' })}
            options={[
              { value: 'auto', label: 'Videos where they help' },
              { value: 'none', label: 'No screen, just ideas' },
            ]}
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

      <DeleteEverything />
    </div>
  )
}

interface Counts {
  checkins: number
  suggestions: number
  saved: number
}

/** Removes the person's check-ins, suggestions, saved videos, and preferences. */
function DeleteEverything() {
  const checkins = useQuery<Record<string, unknown>>('checkins')
  const suggestions = useQuery<Record<string, unknown>>('suggestions')
  const saved = useQuery<Record<string, unknown>>('savedVideos')
  const ideas = useQuery<Record<string, unknown>>('savedIdeas')
  const prefs = useQuery<Record<string, unknown>>('preferences')
  const mCheckins = useMutations<Record<string, unknown>>('checkins')
  const mSuggestions = useMutations<Record<string, unknown>>('suggestions')
  const mSaved = useMutations<Record<string, unknown>>('savedVideos')
  const mIdeas = useMutations<Record<string, unknown>>('savedIdeas')
  const mPrefs = useMutations<Record<string, unknown>>('preferences')

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'idle' | 'done' | 'failed'>('idle')

  const counts: Counts = { checkins: checkins.records.length, suggestions: suggestions.records.length, saved: saved.records.length + ideas.records.length }
  const total = counts.checkins + counts.suggestions + counts.saved + prefs.records.length

  async function run() {
    setOpen(false)
    setBusy(true)
    try {
      for (const r of suggestions.records) await mSuggestions.removeConfirmed(r.recordId)
      for (const r of checkins.records) await mCheckins.removeConfirmed(r.recordId)
      for (const r of saved.records) await mSaved.removeConfirmed(r.recordId)
      for (const r of ideas.records) await mIdeas.removeConfirmed(r.recordId)
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
      <h2 id="delete-heading" className="text-lg font-semibold text-foreground">
        Delete my data
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This removes all your check-ins and notes, the ideas I suggested, your saved videos and ideas, and these preferences.
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
        description={`This will permanently delete ${counts.checkins} check-in${counts.checkins === 1 ? '' : 's'}, ${counts.saved} saved item${counts.saved === 1 ? '' : 's'}, and your preferences.`}
        confirmText="Delete everything"
      />
    </section>
  )
}
