import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import type { Pick } from '../../contract'
import { YouTubePlayer } from '../YouTubePlayer'
import { Instructions } from './Instructions'

export type Helpful = 'yes' | 'somewhat' | 'no'

interface Props {
  pick: Pick
  onBack: () => void
  onStartOver: () => void
  onFeedback: (helpful: Helpful) => void
}

type Phase = 'playing' | 'feedback' | 'thanks' | 'unavailable'

const OPTIONS: { value: Helpful; label: string }[] = [
  { value: 'yes', label: 'Yes, useful' },
  { value: 'somewhat', label: 'A little' },
  { value: 'no', label: 'Not really' },
]

/**
 * Player, then a feedback card. Feedback asks whether the idea was useful,
 * never whether the person feels better.
 */
export function WatchPanel({ pick, onBack, onStartOver, onFeedback }: Props) {
  const [phase, setPhase] = useState<Phase>('playing')

  return (
    <section aria-label="Watching" className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Other ideas
      </button>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{pick.activityTitle}</p>
        <h2 className="mt-1 text-lg font-semibold leading-snug text-foreground">{pick.video.title}</h2>
      </div>

      {(phase === 'playing' || phase === 'unavailable') && (
        // Stays mounted when the video cannot play: the player shows its own
        // explanation and, where it helps, an "Open on YouTube" link.
        <YouTubePlayer
          videoId={pick.video.videoId}
          onEnded={() => setPhase('feedback')}
          onUnavailable={() => setPhase('unavailable')}
        />
      )}

      {phase === 'playing' && (
        <>
          <p className="text-xs text-muted-foreground">
            Plays in YouTube&apos;s player, which may suggest other videos. Come back here whenever you like.
          </p>
          <Button variant="outline" onClick={() => setPhase('feedback')}>
            I&apos;m done
          </Button>
        </>
      )}

      {phase === 'unavailable' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onBack}>Pick another idea</Button>
        </div>
      )}

      {(phase === 'playing' || phase === 'unavailable') && <Instructions activityId={pick.activityId} />}

      {phase === 'feedback' && (
        <div data-testid="feedback-card" className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold text-foreground">Was this useful?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your answer helps me suggest better next time.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <Button
                key={o.value}
                variant="outline"
                onClick={() => {
                  onFeedback(o.value)
                  setPhase('thanks')
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPhase('thanks')}
            className="mt-4 min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip
          </button>
        </div>
      )}

      {phase === 'thanks' && (
        <div data-testid="thanks-card" className="rounded-2xl border border-border bg-secondary p-5">
          <p className="text-sm text-foreground">Thanks for letting me know. Take as long as you need.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onBack}>Back to ideas</Button>
            <Button variant="ghost" onClick={onStartOver}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
