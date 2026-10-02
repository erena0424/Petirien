import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@/components/ui'
import { useJournal } from '@/lib/use-journal'
import { FEELINGS, MAX_REFLECTION_CHARS, PROMPTS, nextPrompt, readReflection, type Feeling } from '../plans/reflection'
import { detectCrisis } from '../recommend/safety'
import { Bunny } from './Bunny'
import { SupportCard } from './SupportCard'

export interface ReflectOn {
  id: string
  title: string
  start: string
}

/**
 * A small space to write about a plan afterwards. One gentle question at a time (skip it, swap it, or just
 * write freely), an optional feeling word, and the text. Saved in the Journal, one reflection per plan;
 * opening it again edits what was written. No model is involved.
 */
export function ReflectionDialog({ plan, onClose }: { plan: ReflectOn | null; onClose: () => void }) {
  const journal = useJournal()
  const existing = plan ? journal.reflectionFor(plan.id) : undefined
  const [prompt, setPrompt] = useState(0)
  const [text, setText] = useState('')
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [state, setState] = useState<'editing' | 'saving' | 'saved' | 'failed'>('editing')
  const [support, setSupport] = useState(false)
  const startedFor = useRef<string | null>(null)

  // Start from what was saved (or empty) once per opened plan, after the Journal has loaded so a saved
  // reflection is known. It must not run again when the row we just saved appears, or it would wipe the "Saved" message.
  useEffect(() => {
    if (!plan) {
      startedFor.current = null
      return
    }
    if (journal.status !== 'ready' || startedFor.current === plan.id) return
    startedFor.current = plan.id
    const saved = existing ? readReflection(existing.data) : { text: '', feeling: null }
    setText(saved.text)
    setFeeling(saved.feeling)
    setPrompt(0)
    setState('editing')
    setSupport(false)
  }, [plan, journal.status, existing])

  async function save() {
    if (!plan) return
    setState('saving')
    const ok = await journal.saveReflection(plan, { text, feeling })
    setState(ok ? 'saved' : 'failed')
    // Nothing here reaches a model, but a person in distress still gets the way to real help.
    setSupport(ok && detectCrisis(text))
  }

  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="reflection-dialog">
        <DialogTitle>{existing ? 'Your reflection' : 'Reflect'}{plan ? `: ${plan.title}` : ''}</DialogTitle>
        <DialogDescription className="sr-only">Write about how this plan went. It is saved in your Journal, and only you can see it.</DialogDescription>

        {state === 'saved' ? (
          <div className="space-y-3" data-testid="reflection-saved">
            <p className="text-base text-foreground">Saved in your Journal. You can come back and change it any time.</p>
            {support && <SupportCard heading="Talk to someone now" />}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onClose}>Done</Button>
              <Link to="/journal" className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary" onClick={onClose}>
                Open the Journal
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <Bunny animated={false} className="w-16 shrink-0" />
              <div className="min-w-0 flex-1 rounded-2xl bg-accent px-4 py-3">
                <p data-testid="reflection-prompt" className="text-lg font-semibold text-foreground">
                  {PROMPTS[prompt]}
                </p>
                <button type="button" onClick={() => setPrompt(nextPrompt)} className="mt-1 min-h-10 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Try a different question
                </button>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">How are you feeling about it? (optional)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={feeling === f}
                    onClick={() => setFeeling((cur) => (cur === f ? null : f))}
                    className={`min-h-10 rounded-full border px-4 text-sm ${feeling === f ? 'border-primary bg-accent font-semibold text-foreground' : 'border-input bg-card text-foreground hover:bg-secondary'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="reflection-text" className="sr-only">
                Your reflection
              </label>
              <Textarea
                id="reflection-text"
                value={text}
                rows={5}
                maxLength={MAX_REFLECTION_CHARS}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write whatever comes, or leave it blank."
                className="border-input bg-card"
              />
            </div>

            {state === 'failed' && (
              <p role="alert" data-testid="reflection-failed" className="text-sm text-foreground">
                I couldn&apos;t save that. What you wrote is still here, so you can try again.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={state === 'saving' || !journal.ready || (!text.trim() && !feeling)}>
                {state === 'saving' ? 'Saving…' : existing ? 'Save changes' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
