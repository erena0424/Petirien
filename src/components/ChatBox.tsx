import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { callAction } from '@/lib/actions-client'
import { formatResetTime } from '@/lib/format'
import { useJournal } from '@/lib/use-journal'
import { MAX_MESSAGES, MAX_MESSAGE_CHARS, type ChatMessage, type JournalDraft, type ReplyResponse, type SummaryResponse } from '../reflect/contract'
import { Bunny } from './Bunny'
import { SupportCard } from './SupportCard'

const STARTERS = ["Something's on my mind", 'I had a good moment today', 'I just need to vent']

type Phase = 'chatting' | 'writing' | 'review' | 'saved' | 'support'

/** Turns an action failure into a calm line. The chat stays on screen so nothing is lost. */
function failure(res: ReplyResponse | SummaryResponse | null): string | null {
  if (!res) return "I couldn't reach the server. Check your connection and try again."
  if (res.status === 'error') return res.message
  if (res.status === 'capped') return `That's enough chatting for today. I'll be back around ${formatResetTime(res.resetsAt)}.`
  return null
}

/**
 * Talk to the bunny. Nothing is stored while chatting: the conversation lives
 * in this component only. Pressing "Save to my journal" asks the bunny to write
 * notes, shows them for review, and only a confirmed Save stores that summary.
 */
export function ChatBox() {
  const journal = useJournal()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draftText, setDraftText] = useState('')
  const [sending, setSending] = useState(false)
  const [phase, setPhase] = useState<Phase>('chatting')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<JournalDraft | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length, sending, phase])

  const userCount = messages.filter((m) => m.role === 'user').length
  const atLimit = messages.length >= MAX_MESSAGES - 2

  /** Ask the bunny to answer the conversation as it stands. */
  async function ask(conversation: ChatMessage[]) {
    setError(null)
    setSending(true)
    const res = await callAction<ReplyResponse>('reflectReply', { messages: conversation })
    setSending(false)
    if (res?.status === 'ok') setMessages([...conversation, { role: 'bunny', text: res.reply }])
    else if (res?.status === 'support') setPhase('support')
    else setError(failure(res))
  }

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || sending) return
    const next: ChatMessage[] = [...messages, { role: 'user', text: clean }]
    setMessages(next)
    setDraftText('')
    await ask(next)
  }

  async function wrapUp() {
    setPhase('writing')
    setError(null)
    const res = await callAction<SummaryResponse>('reflectSummary', { messages })
    if (res?.status === 'ok') {
      setDraft(res.draft)
      setPhase('review')
    } else if (res?.status === 'support') {
      setPhase('support')
    } else {
      setError(failure(res))
      setPhase('chatting')
    }
  }

  async function saveEntry() {
    if (!draft) return
    const ok = await journal.save(draft)
    if (ok) setPhase('saved')
    else setError("That didn't save. Please try again.")
  }

  function reset() {
    setMessages([])
    setDraft(null)
    setError(null)
    setDraftText('')
    setPhase('chatting')
  }

  if (phase === 'support') {
    return (
      <section aria-label="Talk to the bunny" data-testid="chat-support" className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground">
          I&apos;m glad you told me. It sounds like things may be really hard right now, and a real person can help in ways I can&apos;t.
        </p>
        <SupportCard heading="Talk to someone now" />
        <Button variant="ghost" onClick={reset}>
          Close
        </Button>
      </section>
    )
  }

  if (phase === 'saved') {
    return (
      <section aria-label="Talk to the bunny" data-testid="chat-saved" className="rounded-2xl bg-secondary p-5">
        <p className="text-base font-semibold text-foreground">Saved to your journal.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/journal" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Read it
          </Link>
          <Button variant="outline" onClick={reset}>
            Talk about something else
          </Button>
        </div>
      </section>
    )
  }

  if (phase === 'review' && draft) {
    return (
      <section aria-label="Notes from the bunny" data-testid="chat-review" className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">The bunny&apos;s notes</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">{draft.title}</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
            {draft.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {draft.feelings.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Feelings">
              {draft.feelings.map((f) => (
                <li key={f} className="rounded-full bg-secondary px-3 py-1 text-sm text-foreground">
                  {f}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm italic text-muted-foreground">{draft.bunnyNote}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-foreground">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveEntry()} disabled={!journal.ready}>
            Save to my journal
          </Button>
          <Button variant="outline" onClick={() => setPhase('chatting')}>
            Keep chatting
          </Button>
          <Button variant="ghost" onClick={reset}>
            Discard
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Talk to the bunny" data-testid="chat" className="space-y-4">
      {messages.length === 0 ? (
        <div>
          <div className="flex items-end gap-3">
            <Bunny animated={false} className="w-20 shrink-0" />
            <div className="rounded-2xl rounded-bl-md bg-accent px-4 py-3 text-base leading-relaxed text-foreground">
              Hi. I&apos;m the bunny. Tell me whatever is on your mind, big or small.
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Ways to start">
            {STARTERS.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => void send(s)} disabled={sending}>
                {s}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Conversation" data-testid="chat-log">
          {messages.map((m, i) => (
            <li key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex items-end gap-2'}>
              {m.role === 'bunny' && <Bunny animated={false} className="w-12 shrink-0" />}
              <p
                data-testid={m.role === 'user' ? 'chat-user' : 'chat-bunny'}
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base leading-relaxed text-primary-foreground'
                    : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-accent px-4 py-2.5 text-base leading-relaxed text-foreground'
                }
              >
                {m.text}
              </p>
            </li>
          ))}
          {sending && (
            <li className="flex items-end gap-2" role="status" data-testid="chat-thinking">
              <Bunny animated={false} className="w-12 shrink-0" />
              <p className="rounded-2xl rounded-bl-md bg-accent px-4 py-2.5 text-sm text-muted-foreground">The bunny is thinking…</p>
            </li>
          )}
          <div ref={endRef} />
        </ol>
      )}

      {error && (
        <div role="alert" data-testid="chat-error" className="rounded-xl bg-accent p-3 text-sm text-foreground">
          <p>{error}</p>
          {messages[messages.length - 1]?.role === 'user' && !sending && (
            <Button className="mt-2" size="sm" variant="outline" onClick={() => void ask(messages)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {phase === 'writing' ? (
        <p role="status" className="text-sm text-muted-foreground">
          The bunny is writing your notes…
        </p>
      ) : atLimit ? (
        <p className="text-sm text-foreground">This is a good place to wrap up. Save it to your journal, or start fresh.</p>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(draftText)
          }}
        >
          <div className="flex-1">
            <label htmlFor="chat-input" className="sr-only">
              Tell the bunny something
            </label>
            <Textarea
              id="chat-input"
              value={draftText}
              rows={2}
              maxLength={MAX_MESSAGE_CHARS}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draftText)
                }
              }}
              placeholder="Tell the bunny something…"
              className="border-input bg-card"
            />
          </div>
          <Button type="submit" size="icon" aria-label="Send" disabled={sending || !draftText.trim()}>
            <Send aria-hidden className="h-4 w-4" />
          </Button>
        </form>
      )}

      {userCount > 0 && phase === 'chatting' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void wrapUp()} disabled={sending}>
            Save to my journal
          </Button>
          <Button variant="ghost" onClick={reset} disabled={sending}>
            Start over
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground" data-testid="chat-note">
        The bunny is an AI, not a therapist. Nothing is saved unless you save the notes.{' '}
        <Link to="/privacy" className="underline underline-offset-4">
          How your data is used
        </Link>
      </p>
    </section>
  )
}
