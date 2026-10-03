import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui'
import { AutoTextarea } from './AutoTextarea'
import { useBunnyChat } from '@/lib/bunny-chat'
import { MAX_MESSAGES, MAX_MESSAGE_CHARS } from '../reflect/contract'
import { Bunny } from './Bunny'
import { Blob } from './Sparkle'
import { OfferLink } from './OfferLink'
import { ReplyFeedback } from './ReplyFeedback'
import { SupportCard } from './SupportCard'

/** The conversation as a texting-style log, with the text box. Used on the Messages page. */
export function BunnyThread() {
  const chat = useBunnyChat()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [chat.thread.length, chat.sending])

  const atLimit = chat.thread.length >= MAX_MESSAGES - 2
  const lastIsPerson = chat.thread[chat.thread.length - 1]?.role === 'user'
  const lastIndex = chat.thread.length - 1

  if (chat.support) {
    return (
      <section aria-label="Conversation" data-testid="chat-support" className="space-y-4">
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section aria-label="Conversation" data-testid="chat" className="flex min-h-0 flex-1 flex-col gap-3">
        {chat.thread.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
              <Blob className="absolute inset-0" />
              <Bunny className="relative w-32 sm:w-44" />
            </div>
            <p className="max-w-md rounded-3xl bg-secondary px-5 py-3 text-lg leading-relaxed text-foreground">Hi. Tell me whatever is on your mind, big or small.</p>
          </div>
        ) : (
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" aria-label="Messages" data-testid="chat-log">
            {chat.thread.map((m, i) => (
              <li key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex items-start gap-2'}>
                {m.role === 'bunny' && (
                  <span aria-hidden className="relative hidden h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary sm:flex">
                    <Bunny animated={false} className="w-9" />
                  </span>
                )}
                <div className={m.role === 'user' ? 'max-w-[85%]' : 'flex max-w-[85%] flex-col items-start gap-1'}>
                  <p
                    data-testid={m.role === 'user' ? 'chat-user' : 'chat-bunny'}
                    className={
                      m.role === 'user'
                        ? 'whitespace-pre-wrap rounded-3xl rounded-br-lg bg-primary px-5 py-3 text-lg leading-relaxed text-primary-foreground'
                        : 'whitespace-pre-wrap rounded-3xl rounded-bl-lg bg-secondary px-5 py-3 text-lg leading-relaxed text-foreground'
                    }
                  >
                    {m.text}
                  </p>
                  {m.role === 'bunny' && i === lastIndex && !chat.sending && !chat.error && <ReplyFeedback replyKey={`${i}:${m.text}`} />}
                </div>
              </li>
            ))}
            {chat.sending && (
              <li className="flex items-end gap-2" role="status" data-testid="chat-thinking">
                <p className="rounded-3xl rounded-bl-lg bg-secondary px-5 py-3 text-base text-muted-foreground">The bunny is thinking…</p>
              </li>
            )}
            <div ref={endRef} />
          </ol>
        )}

        <OfferLink />

        {chat.error && (
          <div role="alert" data-testid="chat-error" className="rounded-xl bg-accent p-3 text-sm text-foreground">
            <p>{chat.error}</p>
            {lastIsPerson && !chat.sending && (
              <Button className="mt-2" size="sm" variant="outline" onClick={() => void chat.retry()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {atLimit ? (
          <p className="text-sm text-foreground">
            This conversation is getting long. Start a new one whenever you like; the bunny will turn this one into a journal entry.
          </p>
        ) : (
          <form
            className="flex items-end gap-2 rounded-3xl border border-input bg-card p-2 focus-within:ring-[3px] focus-within:ring-ring/40"
            onSubmit={(e) => {
              e.preventDefault()
              const t = text
              setText('')
              void chat.send(t)
            }}
          >
            <div className="flex-1">
              <label htmlFor="chat-input" className="sr-only">
                Tell the bunny something
              </label>
              <AutoTextarea
                id="chat-input"
                value={text}
                maxLength={MAX_MESSAGE_CHARS}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const t = text
                    setText('')
                    void chat.send(t)
                  }
                }}
                className="border-0 bg-transparent text-lg shadow-none focus-visible:border-0 focus-visible:ring-0"
                placeholder="Tell the bunny something…"
              />
            </div>
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Send" disabled={chat.sending || !text.trim()}>
              <Send aria-hidden className="h-4 w-4" />
            </Button>
          </form>
        )}

        {chat.thread.length === 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={chat.isPrivate}
              onChange={(e) => chat.setPrivate(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Don&apos;t save this chat
          </label>
        )}
        {chat.isPrivate && chat.thread.length > 0 && (
          <p data-testid="chat-private-note" className="text-xs text-muted-foreground">
            This chat is not being saved. It disappears when you leave or start a new one.
          </p>
        )}
        {chat.saveFailed && chat.thread.length > 0 && (
          <p data-testid="chat-save-failed" role="alert" className="text-xs text-foreground">
            I couldn't save this chat, so it will disappear when you leave.
          </p>
        )}
      </section>
    </div>
  )
}
