import { useState } from 'react'
import { Play } from 'lucide-react'
import { AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'
import { ENERGY, label } from '@/lib/labels'
import { TIME_CHOICES } from '@/lib/free-time'
import type { PlayerErrorKind } from '@/lib/youtube'
import { type PendingSave, loadChoice, savePending, saveChoice } from '../preview/pending'
import { DEFAULT_PREVIEW, previewPicks, thumbnailFor, watchUrlFor, type PreviewInput } from '../preview/preview'
import { ChoiceGroup } from './ChoiceGroup'
import { Instructions } from './checkin/Instructions'
import { YouTubePlayer } from './YouTubePlayer'

/**
 * Sample suggestions for someone who has not signed in: one playable video and two ideas with steps, ready to view the
 * moment the page loads, and tailored a little to the energy and time they choose. They are labelled as samples because
 * nothing here is personalized by the AI. Pressing Save remembers what they wanted and asks them to sign in, so signing
 * in does not start them over.
 */
export function PreviewSection({ asking, onClose }: { asking: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState<PreviewInput | null>(() => loadChoice())
  const [energy, setEnergy] = useState<number | null>(choice?.energy ?? null)
  const [minutes, setMinutes] = useState<number | null>(choice?.minutes ?? null)
  const [signIn, setSignIn] = useState(false)
  const picks = previewPicks(choice ?? DEFAULT_PREVIEW, new Date())

  function show(e: React.FormEvent) {
    e.preventDefault()
    if (energy === null || minutes === null) return
    const next = { energy, minutes }
    setChoice(next)
    saveChoice(next)
    onClose()
    // Bring the new suggestions into view, so it is clear something changed.
    setTimeout(() => document.getElementById('sample-heading')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }

  function save(pending: PendingSave) {
    savePending(pending)
    if (choice) saveChoice(choice)
    setSignIn(true)
  }

  return (
    <section aria-labelledby="sample-heading" data-testid="preview" className="mt-14">
      <h2 id="sample-heading" className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
        A few ideas to try
      </h2>
      <p data-testid="sample-note" className="mt-2 max-w-3xl text-base text-muted-foreground">
        {choice
          ? `For ${label(ENERGY, choice.energy).toLowerCase()} energy and about ${choice.minutes} minutes. `
          : 'Explore these sample activities. '}
        These are samples, not tailored to you yet. Sign in for suggestions based on your check-in and preferences.
      </p>

      {asking && (
        <form onSubmit={show} data-testid="preview-form" className="mt-4 space-y-5 rounded-3xl border border-border bg-card p-5">
          <ChoiceGroup legend="How much energy do you have?" variant="scale" value={energy} onChange={setEnergy} options={ENERGY} />
          <ChoiceGroup legend="How much time do you have?" value={minutes} onChange={setMinutes} options={TIME_CHOICES.map((m) => ({ value: m, label: `${m} min` }))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11 rounded-full px-6" disabled={energy === null || minutes === null}>
              Show me
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Skip
            </Button>
          </div>
        </form>
      )}

      <ul className="mt-5 grid gap-5 md:grid-cols-2">
        {picks.video && <SampleVideo activityId={picks.video.activity.id} title={picks.video.activity.title} blurb={picks.video.activity.blurb} videoId={picks.video.videoId} onSave={save} />}
        {picks.ideas.map((a) => (
          <li key={a.id} data-testid="sample-idea" className="overflow-hidden rounded-3xl border border-border border-t-4 border-t-[var(--color-apricot)] bg-card shadow-[var(--shadow-card)]">
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Idea</p>
              <h3 className="mt-1 font-display text-2xl font-semibold leading-snug text-foreground">{a.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-foreground">{a.blurb}</p>
            </div>
            <div className="px-4 pb-2">
              <Instructions activityId={a.id} />
            </div>
            <div className="px-4 pb-4 pt-1">
              <Button variant="outline" className="rounded-full" onClick={() => save({ kind: 'idea', activityId: a.id })} aria-label={`Save: ${a.title}`}>
                Save
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div data-testid="preview-signin" className="mt-8 rounded-3xl bg-secondary p-7 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
        <p className="font-display text-2xl font-semibold text-foreground">Save this and keep your reflections in one place.</p>
        <p className="mt-1 text-base text-foreground">Sign in to save what you like, talk with the bunny, and have ideas picked with you in mind.</p>
        </div>
        <Button className="mt-4 min-h-12 shrink-0 rounded-full px-8 text-base sm:mt-0" onClick={() => setSignIn(true)}>
          Sign in
        </Button>
      </div>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </section>
  )
}

function SampleVideo({ activityId, title, blurb, videoId, onSave }: { activityId: string; title: string; blurb: string; videoId: string; onSave: (p: PendingSave) => void }) {
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState<PlayerErrorKind | null>(null)
  return (
    <li data-testid="sample-video" className="overflow-hidden rounded-3xl border border-border border-t-4 border-t-[var(--color-apricot)] bg-card shadow-[var(--shadow-card)] md:col-span-2">
      <div className="sm:flex">
      <div className="relative sm:w-[46%] sm:shrink-0">
        <img src={thumbnailFor(videoId)} alt="" loading="lazy" data-testid="sample-video-thumb" className="aspect-video w-full bg-muted object-cover sm:h-full" />
        {!playing && (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card/95 text-primary shadow-lg">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </span>
          </span>
        )}
      </div>
      <div className="p-4 sm:flex-1 sm:self-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guided video</p>
        <h3 className="mt-1 font-display text-3xl font-semibold leading-snug text-foreground">{title}</h3>
        <p className="mt-2 text-lg leading-relaxed text-foreground">{blurb}</p>
      </div>
      </div>
      {playing && !blocked && (
        <div className="px-4 pb-4">
          <YouTubePlayer videoId={videoId} onEnded={() => setPlaying(false)} onUnavailable={(k) => (k === 'unavailable' || k === 'embed_blocked') && setBlocked(k)} />
        </div>
      )}
      {blocked && <p className="px-4 pb-3 text-sm text-foreground">{blocked === 'unavailable' ? 'That video is no longer on YouTube.' : "It can't play here, but it opens on YouTube."}</p>}
      <div className="px-4 pb-2">
        <Instructions activityId={activityId} />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-1">
        {!blocked && (
          <Button className="rounded-full px-6" onClick={() => setPlaying((p) => !p)} aria-label={`${playing ? 'Close' : 'Watch'}: ${title}`}>
            <Play aria-hidden className="h-4 w-4" />
            {playing ? 'Close' : 'Watch'}
          </Button>
        )}
        {blocked !== 'unavailable' && (
          <a
            href={watchUrlFor(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open on YouTube
          </a>
        )}
        <Button variant="outline" className="rounded-full" onClick={() => onSave({ kind: 'video', activityId, videoId })} aria-label={`Save: ${title}`}>
          Save
        </Button>
      </div>
    </li>
  )
}
