import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'
import { GREETING, partOfDay } from '@/lib/for-now'
import { MAX_MESSAGE_CHARS } from '../reflect/contract'
import { Bunny } from './Bunny'
import { SupportCard } from './SupportCard'

const STARTERS = ["Something's on my mind", 'I had a good moment today', 'I just need to vent']

/**
 * The landing view: a very big bunny with its words. Before you talk it says
 * hello; once you do, it shows its latest reply. The full conversation is on
 * the Messages tab.
 */
export function BunnyHero() {
  const chat = useBunnyChat()
  const { isSignedIn } = useAuthStatus()
  const [text, setText] = useState('')
  const [signIn, setSignIn] = useState(false)

  const greeting = `${GREETING[partOfDay(new Date())]} Say something, or let's find something small to do.`
  const words = chat.sending ? 'Hmm…' : (chat.latest ?? greeting)

  if (chat.support) {
    return (
      <section aria-label="Talk to the bunny" data-testid="chat-support" className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground">
          I&apos;m glad you told me. It sounds like things may be really hard right now, and a real person can help in ways I can&apos;t.
        </p>
        <SupportCard heading="Talk to someone now" />
        <Button variant="ghost" onClick={chat.dismissSupport}>
          Close
        </Button>
      </section>
    )
  }

  const submit = (t: string) => {
    if (!isSignedIn) return setSignIn(true)
    setText('')
    void chat.send(t)
  }

  return (
    <section aria-label="Talk to the bunny" data-testid="chat" className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
      <Bunny className="w-64 shrink-0 sm:w-72" />
      <div className="w-full min-w-0 flex-1">
        <div
          data-testid="bunny-words"
          aria-live="polite"
          className="relative rounded-2xl bg-accent px-5 py-4 text-left text-lg leading-relaxed text-foreground"
        >
          {words}
        </div>

        {chat.error && (
          <div role="alert" data-testid="chat-error" className="mt-3 rounded-xl bg-accent p-3 text-left text-sm text-foreground">
            <p>{chat.error}</p>
            {chat.thread[chat.thread.length - 1]?.role === 'user' && !chat.sending && (
              <Button className="mt-2" size="sm" variant="outline" onClick={() => void chat.retry()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {chat.thread.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Ways to start">
            {STARTERS.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => submit(s)} disabled={chat.sending}>
                {s}
              </Button>
            ))}
          </div>
        )}

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) submit(text)
          }}
        >
          <label htmlFor="hero-input" className="sr-only">
            Tell the bunny something
          </label>
          <input
            id="hero-input"
            value={text}
            maxLength={MAX_MESSAGE_CHARS}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell the bunny something…"
            className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={chat.sending || !text.trim()}>
            <Send aria-hidden className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          {chat.thread.length === 0 ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-foreground">
              <input
                type="checkbox"
                checked={chat.isPrivate}
                onChange={(e) => chat.setPrivate(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Don&apos;t save this chat
            </label>
          ) : (
            <span data-testid="chat-private-note" className="text-xs text-muted-foreground">
              {chat.isPrivate
                ? 'This chat is not being saved.'
                : chat.saveFailed
                  ? "I couldn't save this chat, so it will disappear when you leave."
                  : 'Saved to Messages.'}
            </span>
          )}
          <Link to="/messages" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
            Open the whole conversation
          </Link>
        </div>
      </div>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </section>
  )
}
