import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import { useHomeIdeas } from '@/lib/use-home-ideas'
import { useSavedVideos } from '@/lib/use-saved'
import { watchUrl, type PlayerErrorKind } from '@/lib/youtube'
import type { HomeIdea } from '../contract'
import { chooseHomeActivities } from '../recommend/home-pick'
import { Instructions } from './checkin/Instructions'
import { SaveButton } from './SaveButton'
import { YouTubePlayer } from './YouTubePlayer'

/**
 * Ideas for right now, on Home, for everyone, including someone who has never saved or checked in. Each has its
 * picture showing from the start; watching, saving and the steps are one tap away.
 */
export function HomeIdeas() {
  const state = useHomeIdeas()
  const saved = useSavedVideos()
  if (state.kind === 'error') return null // Home still has its written suggestion; nothing to apologise for here
  if (state.kind === 'signedOut') return <GenericIdeas />
  return (
    <section aria-labelledby="ideas-heading" data-testid="home-ideas" className="mt-10">
      <h2 id="ideas-heading" className="text-lg font-bold text-foreground">
        Ideas for right now
      </h2>
      {state.kind === 'loading' ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Finding a couple of things for you…
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {state.ideas.map((idea) => (
            <IdeaCard
              key={idea.activityId}
              idea={idea}
              saved={!!idea.video && saved.isSaved(idea.video.videoId)}
              canSave={saved.ready}
              onToggleSave={() => {
                if (!idea.video) return
                if (saved.isSaved(idea.video.videoId)) void saved.unsave(idea.video.videoId)
                else void saved.save(idea.video, idea.activityId)
              }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * For visitors who are not signed in: the same kind of ideas Home would offer, as plain ideas with their steps (no video
 * search, so nothing is spent), so the site shows what it offers before anyone signs in.
 */
function GenericIdeas() {
  const ideas: HomeIdea[] = chooseHomeActivities(new Date()).map((a) => ({ activityId: a.id, activityTitle: a.title, video: null, reason: a.blurb }))
  if (ideas.length === 0) return null
  return (
    <section aria-labelledby="ideas-heading" data-testid="home-ideas" className="mt-10">
      <h2 id="ideas-heading" className="text-lg font-bold text-foreground">
        Ideas for right now
      </h2>
      <ul className="mt-3 space-y-4">
        {ideas.map((idea) => (
          <IdeaCard key={idea.activityId} idea={idea} saved={false} canSave={false} onToggleSave={() => undefined} />
        ))}
      </ul>
      <p data-testid="home-ideas-signin" className="mt-3 text-sm text-muted-foreground">
        Sign in and I&apos;ll find a video for each of these, and suggest places near you.
      </p>
    </section>
  )
}

function IdeaCard({ idea, saved, canSave, onToggleSave }: { idea: HomeIdea; saved: boolean; canSave: boolean; onToggleSave: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState<PlayerErrorKind | null>(null)
  const v = idea.video
  const length = v ? formatDuration(v.durationSec) : ''

  function unavailable(kind: PlayerErrorKind) {
    if (kind === 'unavailable' || kind === 'embed_blocked') setBlocked(kind)
  }

  return (
    <li data-testid="home-idea" className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-4 p-4">
        {v && (
          <img src={v.thumbnail} alt="" loading="lazy" data-testid="home-idea-thumb" className="h-16 w-28 shrink-0 rounded-lg bg-muted object-cover sm:h-20 sm:w-36" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{idea.activityTitle}</p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{v ? v.title : idea.activityTitle}</h3>
          {v && <p className="mt-1 text-xs text-muted-foreground">{[length, v.channel].filter(Boolean).join(' · ')}</p>}
          <p className="mt-2 text-sm leading-relaxed text-foreground">{idea.reason}</p>
        </div>
      </div>
      {v && playing && !blocked && (
        <div className="px-4 pb-4">
          <YouTubePlayer videoId={v.videoId} onEnded={() => setPlaying(false)} onUnavailable={unavailable} />
        </div>
      )}
      {blocked && (
        <p className="px-4 pb-3 text-sm text-foreground">
          {blocked === 'unavailable' ? 'That video is no longer on YouTube.' : "It can't play here, but it opens on YouTube."}
        </p>
      )}
      <div className="px-4 pb-2">
        <Instructions activityId={idea.activityId} />
      </div>
      {v && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-4 py-3">
          {!blocked && (
            <Button onClick={() => setPlaying((p) => !p)} aria-label={`${playing ? 'Close' : 'Watch'}: ${v.title}`}>
              <Play aria-hidden className="h-4 w-4" />
              {playing ? 'Close' : 'Watch'}
            </Button>
          )}
          {blocked !== 'unavailable' && (
            <a
              href={watchUrl(v.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Open on YouTube
            </a>
          )}
          <SaveButton saved={saved} onToggle={onToggleSave} label={v.title} disabled={!canSave} />
        </div>
      )}
    </li>
  )
}
