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
    <section aria-labelledby="sample-heading" data-testid="preview" className="mt-10">
      <h2 id="sample-heading" className="text-lg font-bold text-foreground">
        Sample suggestions
      </h2>
      <p data-testid="sample-note" className="mt-1 text-sm text-muted-foreground">
        {choice
          ? `For ${label(ENERGY, choice.energy).toLowerCase()} energy and about ${choice.minutes} minutes. `
          : 'A few things you could try right now. '}
        These are samples, not tailored to you yet. Sign in and I&apos;ll choose with you in mind.
      </p>

      {asking && (
        <form onSubmit={show} data-testid="preview-form" className="mt-4 space-y-5 rounded-2xl border border-border bg-card p-4">
          <ChoiceGroup legend="How much energy do you have?" variant="scale" value={energy} onChange={setEnergy} options={ENERGY} />
          <ChoiceGroup legend="How much time do you have?" value={minutes} onChange={setMinutes} options={TIME_CHOICES.map((m) => ({ value: m, label: `${m} min` }))} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={energy === null || minutes === null}>
              Show me
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Skip
            </Button>
          </div>
        </form>
      )}

      <ul className="mt-4 space-y-4">
        {picks.video && <SampleVideo activityId={picks.video.activity.id} title={picks.video.activity.title} blurb={picks.video.activity.blurb} videoId={picks.video.videoId} onSave={save} />}
        {picks.ideas.map((a) => (
          <li key={a.id} data-testid="sample-idea" className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Idea</p>
              <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{a.blurb}</p>
            </div>
            <div className="px-4 pb-2">
              <Instructions activityId={a.id} />
            </div>
            <div className="border-t border-border bg-background/60 px-4 py-3">
              <Button variant="outline" onClick={() => save({ kind: 'idea', activityId: a.id })} aria-label={`Save: ${a.title}`}>
                Save
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div data-testid="preview-signin" className="mt-5 rounded-2xl bg-accent p-4">
        <p className="text-base font-semibold text-foreground">Save this and keep your reflections in one place.</p>
        <p className="mt-1 text-sm text-foreground">Sign in to save what you like, talk with the bunny, and have ideas picked with you in mind.</p>
        <Button className="mt-3 min-h-11" onClick={() => setSignIn(true)}>
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
    <li data-testid="sample-video" className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-4 p-4">
        <img src={thumbnailFor(videoId)} alt="" loading="lazy" data-testid="sample-video-thumb" className="h-16 w-28 shrink-0 rounded-lg bg-muted object-cover sm:h-20 sm:w-36" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guided video</p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{blurb}</p>
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
      <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-4 py-3">
        {!blocked && (
          <Button onClick={() => setPlaying((p) => !p)} aria-label={`${playing ? 'Close' : 'Watch'}: ${title}`}>
            <Play aria-hidden className="h-4 w-4" />
            {playing ? 'Close' : 'Watch'}
          </Button>
        )}
        {blocked !== 'unavailable' && (
          <a
            href={watchUrlFor(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Open on YouTube
          </a>
        )}
        <Button variant="outline" onClick={() => onSave({ kind: 'video', activityId, videoId })} aria-label={`Save: ${title}`}>
          Save
        </Button>
      </div>
    </li>
  )
}
