import { useState } from 'react'
import { Button } from '@/components/ui'
import { usePreferences } from '@/lib/use-preferences'

const ASKED_KEY = 'petirien.askedScreen'

/** True until the person has been asked (once, ever, on this browser) or has already chosen a screen preference. */
export function shouldAskScreen(screenPref: string): boolean {
  if (screenPref !== 'auto') return false
  try {
    return localStorage.getItem(ASKED_KEY) !== '1'
  } catch {
    return false // when we cannot remember asking, we do not ask
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    /* storage unavailable: we will not ask without being able to remember */
  }
}

/**
 * A preference asked for at the moment it matters, not in a questionnaire up front: right after someone says a video was not
 * for them, once, we ask whether they would rather have ideas without a screen. Either answer is fine and the question
 * never comes back; the choice lives in Preferences, where it can be changed.
 */
export function ScreenQuestion({ onDone }: { onDone: () => void }) {
  const prefs = usePreferences()
  const [answer, setAnswer] = useState<'none' | 'keep' | null>(null)

  async function choose(a: 'none' | 'keep') {
    markAsked()
    setAnswer(a)
    if (a === 'none') await prefs.save({ ...prefs.prefs, screen: 'none' })
  }

  if (answer) {
    return (
      <p data-testid="screen-question-ack" role="status" className="mt-3 text-sm text-foreground">
        {answer === 'none' ? "Okay, I'll start with ideas that don't need a screen. You can change this in Preferences." : 'Okay, I will keep videos in the mix.'}{' '}
        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={onDone}>
          Close
        </button>
      </p>
    )
  }
  return (
    <div data-testid="screen-question" className="mt-3 rounded-xl bg-accent p-3">
      <p className="text-sm font-medium text-foreground">Would you rather have ideas that don&apos;t need a screen?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" className="min-h-10" disabled={!prefs.ready} onClick={() => void choose('none')}>
          Yes, mostly ideas
        </Button>
        <Button size="sm" variant="outline" className="min-h-10" onClick={() => void choose('keep')}>
          No, videos are fine
        </Button>
      </div>
    </div>
  )
}
