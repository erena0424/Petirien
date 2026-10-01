import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui'
import { AutoTextarea } from './AutoTextarea'
import { useBunnyChat } from '@/lib/bunny-chat'
import { MAX_MESSAGES, MAX_MESSAGE_CHARS } from '../reflect/contract'
import { Bunny } from './Bunny'
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
    <section aria-label="Conversation" data-testid="chat" className="flex flex-col gap-4">
      {chat.thread.length === 0 ? (
        <div className="flex items-end gap-3">
          <Bunny animated={false} className="w-20 shrink-0" />
          <p className="rounded-2xl rounded-bl-md bg-accent px-4 py-3 text-base leading-relaxed text-foreground">
            Hi. Tell me whatever is on your mind, big or small.
          </p>
        </div>
      ) : (
        <ol className="max-h-[55vh] space-y-3 overflow-y-auto pr-1" aria-label="Messages" data-testid="chat-log">
          {chat.thread.map((m, i) => (
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
          {chat.sending && (
            <li className="flex items-end gap-2" role="status" data-testid="chat-thinking">
              <Bunny animated={false} className="w-12 shrink-0" />
              <p className="rounded-2xl rounded-bl-md bg-accent px-4 py-2.5 text-sm text-muted-foreground">The bunny is thinking…</p>
            </li>
          )}
          <div ref={endRef} />
        </ol>
      )}

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
        <p className="text-sm text-foreground">This conversation is getting long. Start a new one whenever you like; the bunny will write notes about this one.</p>
      ) : (
        <form
          className="flex items-end gap-2"
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
              placeholder="Tell the bunny something…"
            />
          </div>
          <Button type="submit" size="icon" aria-label="Send" disabled={chat.sending || !text.trim()}>
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
  )
}
