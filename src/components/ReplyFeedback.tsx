import { useEffect, useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui'
import { usePreferences } from '@/lib/use-preferences'
import { REASONS, THANKS_ACK, applyFeedback, type FeedbackReason } from '../reflect/feedback'
import type { BunnyStyle } from '../reflect/style'

type Phase = 'idle' | 'reasons' | 'done'

/**
 * Two small icons under the bunny's latest reply. A thumbs-up just says thanks.
 * A thumbs-down shows four reasons; one tap changes how the bunny talks and
 * says what changed, with an Undo. Resets whenever the reply changes.
 */
export function ReplyFeedback({ replyKey }: { replyKey: string }) {
  const prefs = usePreferences()
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [undo, setUndo] = useState<BunnyStyle | null>(null)

  useEffect(() => {
    setPhase('idle')
    setMessage('')
    setUndo(null)
  }, [replyKey])

  async function choose(reason: FeedbackReason) {
    const result = applyFeedback(reason, prefs.style)
    setMessage(result.ack)
    setUndo(result.next ? result.previous : null)
    setPhase('done')
    if (result.next) await prefs.setStyle(result.next)
  }

  async function undoIt() {
    if (!undo) return
    await prefs.setStyle(undo)
    setMessage('Okay, back to how it was.')
    setUndo(null)
  }

  if (phase === 'done') {
    return (
      <p role="status" data-testid="feedback-ack" className="flex flex-wrap items-center gap-2 text-sm text-foreground">
        {message}
        {undo && (
          <button type="button" onClick={() => void undoIt()} className="font-medium text-primary underline underline-offset-4">
            Undo
          </button>
        )}
      </p>
    )
  }

  if (phase === 'reasons') {
    return (
      <div data-testid="feedback-reasons" className="space-y-2">
        <p className="text-sm text-muted-foreground">What was off?</p>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <Button key={r.id} variant="outline" size="sm" disabled={!prefs.ready} onClick={() => void choose(r.id)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1" data-testid="feedback-icons">
      <button
        type="button"
        aria-label="This reply was good"
        onClick={() => {
          setMessage(THANKS_ACK)
          setUndo(null)
          setPhase('done')
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ThumbsUp aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="This reply wasn't quite right"
        onClick={() => setPhase('reasons')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ThumbsDown aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
