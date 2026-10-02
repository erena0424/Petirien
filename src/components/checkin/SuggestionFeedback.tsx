import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Helpful } from './WatchPanel'

/**
 * Two small icons on every suggestion, like the ones under the bunny's replies: good, or not for me. What the person
 * picks is remembered, and the next suggestions lean toward what they liked and away from what they did not.
 * It says what it will do, and it never claims more than that.
 */
export function SuggestionFeedback({ title, onRate }: { title: string; onRate: (h: Extract<Helpful, 'yes' | 'no'>) => void }) {
  const [rated, setRated] = useState<'yes' | 'no' | null>(null)
  const choose = (h: 'yes' | 'no') => {
    setRated(h)
    onRate(h)
  }
  const btn = (active: boolean) =>
    cn(
      'inline-flex h-10 w-10 items-center justify-center rounded-lg border text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      active ? 'border-primary bg-accent' : 'border-input bg-card',
    )
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="pick-feedback">
      <button type="button" className={btn(rated === 'yes')} aria-pressed={rated === 'yes'} aria-label={`Good suggestion: ${title}`} onClick={() => choose('yes')}>
        <ThumbsUp aria-hidden className="h-4 w-4" />
      </button>
      <button type="button" className={btn(rated === 'no')} aria-pressed={rated === 'no'} aria-label={`Not for me: ${title}`} onClick={() => choose('no')}>
        <ThumbsDown aria-hidden className="h-4 w-4" />
      </button>
      {rated && (
        <p data-testid="pick-feedback-ack" role="status" className="text-sm text-muted-foreground">
          {rated === 'yes' ? "Thanks. I'll suggest more like this." : "Got it. I'll suggest fewer like this."}
        </p>
      )}
    </div>
  )
}
