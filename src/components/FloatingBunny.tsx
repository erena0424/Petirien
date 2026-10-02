import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Minus, Plus, Send, X } from 'lucide-react'
import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'
import {
  SIZES,
  clampFloat,
  isCollapsed,
  dragTo,
  fadeFor,
  visibleMessages,
  isPhone,
  keyMove,
  loadFloat,
  nextSize,
  saveFloat,
  shouldShowFloat,
  type FloatState,
} from '@/lib/float'
import { GREETING, partOfDay } from '@/lib/for-now'
import { MAX_MESSAGE_CHARS } from '../reflect/contract'
import { AutoTextarea } from './AutoTextarea'
import { Bunny } from './Bunny'
import { OfferLink } from './OfferLink'
import { ReplyFeedback } from './ReplyFeedback'
import { SupportCard } from './SupportCard'

const DRAG_THRESHOLD = 5
const STARTERS = ["Something's on my mind", 'I had a good moment today', 'I just need to vent']
// Words sit on the page with no box, so a soft halo in the page color keeps them readable over anything.
const HALO = '0 0 6px var(--color-background), 0 0 3px var(--color-background), 0 0 12px var(--color-background)'

function footerHeight(): number {
  return document.querySelector('footer')?.getBoundingClientRect().height ?? 0
}

/**
 * The bunny on every page except Messages (which shows the whole conversation).
 * On a computer: the bunny with its conversation to its right, the latest messages full size and older ones shrinking and fading away, text box right under the latest words.
 * On a phone: a small bunny with its latest words; tap to open a bottom sheet.
 *
 * It floats above the footer, so it can never cover "Need support now?". On a
 * phone it is docked in the corner and the panel opens as a bottom sheet.
 */
export function FloatingBunny() {
  const { pathname } = useLocation()
  if (!shouldShowFloat(pathname)) return null
  return <Floating />
}

function Floating() {
  const { pathname } = useLocation()
  const chat = useBunnyChat()
  const { isSignedIn } = useAuthStatus()
  const [state, setState] = useState<FloatState>(loadFloat)
  const [open, setOpen] = useState(false) // the phone sheet only; on a computer the conversation is always shown
  const [text, setText] = useState('')
  const [signIn, setSignIn] = useState(false)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [footer, setFooter] = useState(0)
  const [dragging, setDragging] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const bunnyBtn = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; y: number; start: FloatState; moved: boolean } | null>(null)
  const wasOpen = useRef(false)
  const lastFocusTick = useRef(chat.focusTick)

  const phone = isPhone(viewport.width)
  const collapsed = isCollapsed(state, pathname)
  const size = SIZES[phone ? 's' : state.size]

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      setFooter(footerHeight())
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Keep it on screen whenever its size, the window or the open panel changes.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || phone) return
    const box = { width: el.offsetWidth, height: el.offsetHeight }
    const next = clampFloat(state, box, viewport, footer)
    if (next.right !== state.right || next.bottom !== state.bottom) setState(next)
  }, [state, open, viewport, footer, phone, chat.thread.length, chat.latest])

  useEffect(() => {
    saveFloat(state)
  }, [state])

  useEffect(() => {
    if (open && phone) document.getElementById('floating-input')?.focus()
    else if (wasOpen.current) bunnyBtn.current?.focus()
    wasOpen.current = open
  }, [open])

  // Something (a plan's "Talk about this", the Home button) asked to bring the chat forward.
  useEffect(() => {
    if (chat.focusTick === lastFocusTick.current) return
    lastFocusTick.current = chat.focusTick
    if (phone) setOpen(true)
    else setState((s) => (isCollapsed(s, pathname) ? { ...s, collapsed: false } : s))
    const t = setTimeout(() => document.getElementById('floating-input')?.focus(), 80)
    return () => clearTimeout(t)
  }, [chat.focusTick, phone, pathname])

  function onPointerDown(e: React.PointerEvent) {
    if (phone || e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, start: state, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    d.moved = true
    setDragging(true)
    setState(dragTo(d.start, dx, dy))
  }
  function onPointerUp() {
    setDragging(false)
    // A drag is not a tap: keep the click from toggling the panel.
    if (drag.current?.moved) setTimeout(() => (drag.current = null), 0)
    else drag.current = null
  }
  function onBunnyClick() {
    if (drag.current?.moved) return
    // Phone: open or close the sheet. Computer: hide the chat and leave just the bunny, or bring it back.
    if (phone) setOpen((o) => !o)
    else setState((s) => ({ ...s, collapsed: !isCollapsed(s, pathname) }))
  }
  function onBunnyKey(e: React.KeyboardEvent) {
    if (phone) return
    const next = keyMove(state, e.key)
    if (next) {
      e.preventDefault()
      setState(next)
    }
  }

  const submit = (t: string) => {
    if (!isSignedIn) return setSignIn(true)
    setText('')
    void chat.send(t)
  }

  // Before sign-in the bunny introduces itself and points to the preview, since it cannot chat yet.
  const greeting = isSignedIn
    ? `${GREETING[partOfDay(new Date())]} Say something, or let's find something small to do.`
    : "Hi, I'm the bunny. Try the quick preview on Home to see what I can offer, or sign in and we can talk."

  const words = chat.sending ? 'Hmm…' : (chat.latest ?? greeting)
  const lastBunnyIndex = (() => {
    for (let i = chat.thread.length - 1; i >= 0; i--) if (chat.thread[i]!.role === 'bunny') return i
    return -1
  })()
  const shown = chat.thread.slice(-6)

  const style: React.CSSProperties = phone
    ? { right: 8, bottom: footer + 8 }
    : { right: state.right, bottom: footer + state.bottom }

  return (
    <div
      ref={boxRef}
      data-testid="floating-bunny"
      style={style}
      className="pointer-events-none fixed z-40 flex max-w-[calc(100vw-16px)] flex-col items-start gap-2"
    >
      {phone && open && (
        <section
          role="dialog"
          aria-label="Chat with the bunny"
          data-testid="floating-panel"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          style={phone ? { position: 'fixed', left: 8, right: 8, bottom: footer + 8 } : { width: size.panel }}
          className={`pointer-events-auto flex max-h-[min(70vh,34rem)] flex-col rounded-2xl p-3 ${phone ? 'border border-border bg-card shadow-[var(--shadow-card)]' : ''}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <p style={phone ? undefined : { textShadow: HALO }} className="text-sm font-semibold text-foreground">Talk to the bunny</p>
            <Button size="icon" variant="ghost" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X aria-hidden className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
            {chat.support ? (
              <div data-testid="chat-support" className="space-y-3">
                <p className="text-sm leading-relaxed text-foreground">
                  I&apos;m glad you told me. It sounds like things may be really hard right now, and a real person can help in ways I can&apos;t.
                </p>
                <SupportCard heading="Talk to someone now" />
                <Button variant="ghost" onClick={chat.dismissSupport}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                {chat.thread.length === 0 ? (
                  <p data-testid="bunny-words" className="rounded-2xl bg-accent px-4 py-3 text-base leading-relaxed text-foreground">
                    {greeting}
                  </p>
                ) : (
                  <ul data-testid="floating-thread" className="space-y-2">
                    {shown.map((m, i) => {
                      const index = chat.thread.length - shown.length + i
                      const isLatest = index === lastBunnyIndex && !chat.sending
                      return (
                        <li
                          key={index}
                          data-testid={isLatest ? 'bunny-words' : undefined}
                          className={
                            m.role === 'user'
                              ? 'ml-8 rounded-2xl bg-primary px-4 py-2 text-base text-primary-foreground'
                              : 'rounded-2xl bg-accent px-4 py-3 text-base leading-relaxed text-foreground'
                          }
                        >
                          {m.text}
                          {isLatest && !chat.error && isSignedIn && (
                            <div className="mt-1">
                              <ReplyFeedback replyKey={`${chat.thread.length}:${m.text}`} />
                            </div>
                          )}
                        </li>
                      )
                    })}
                    {chat.sending && (
                      <li data-testid="bunny-words" className="rounded-2xl bg-accent px-4 py-3 text-base text-foreground">
                        Hmm…
                      </li>
                    )}
                  </ul>
                )}

                <OfferLink />

                {chat.error && (
                  <div role="alert" data-testid="chat-error" className="rounded-xl bg-accent p-3 text-sm text-foreground">
                    <p>{chat.error}</p>
                    {chat.thread[chat.thread.length - 1]?.role === 'user' && !chat.sending && (
                      <Button className="mt-2" size="sm" variant="outline" onClick={() => void chat.retry()}>
                        Try again
                      </Button>
                    )}
                  </div>
                )}

                {chat.thread.length === 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Ways to start">
                    {STARTERS.map((t) => (
                      <Button key={t} variant="outline" size="sm" onClick={() => submit(t)} disabled={chat.sending}>
                        {t}
                      </Button>
                    ))}
                  </div>
                )}

                {chat.earlier.length > 0 && (
                  <ul aria-label="Earlier conversations" data-testid="floating-earlier" className="space-y-1">
                    {chat.earlier.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => chat.open(c.id)}
                          className="w-full rounded-xl bg-secondary px-3 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
                        >
                          <span className="font-medium">{c.title}</span>
                          <span className="line-clamp-1 block">{c.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {!chat.support && (
            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) submit(text)
              }}
            >
              <label htmlFor="floating-input" className="sr-only">
                Tell the bunny something
              </label>
              <AutoTextarea
                id="floating-input"
                value={text}
                maxLines={5}
                maxLength={MAX_MESSAGE_CHARS}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (text.trim()) submit(text)
                  }
                }}
                placeholder="Tell the bunny something…"
                className="min-w-0 flex-1"
              />
              <Button type="submit" size="icon" aria-label="Send" disabled={chat.sending || !text.trim()}>
                <Send aria-hidden className="h-4 w-4" />
              </Button>
            </form>
          )}

          {!chat.support && (
            <div style={phone ? undefined : { textShadow: HALO }} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
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
                <span data-testid="chat-private-note" className="text-foreground">
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
          )}
          <p style={phone ? undefined : { textShadow: HALO }} className="text-xs text-foreground">The bunny is an AI, not a person or a therapist.</p>
        </section>
      )}

      <div className={`flex items-end gap-1 ${phone && open ? 'hidden' : ''}`}>
        {!phone && (
          <div className="pointer-events-auto flex flex-col gap-1 self-end" role="group" aria-label="Bunny size">
            <Button
              size="icon"
              variant="outline"
              aria-label="Bigger bunny"
              disabled={state.size === 'l'}
              onClick={() => setState((s) => ({ ...s, size: nextSize(s.size, 1) }))}
            >
              <Plus aria-hidden className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Smaller bunny"
              disabled={state.size === 's'}
              onClick={() => setState((s) => ({ ...s, size: nextSize(s.size, -1) }))}
            >
              <Minus aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        )}
        <button
          ref={bunnyBtn}
          type="button"
          data-testid="floating-toggle"
          aria-expanded={phone ? open : !collapsed}
          aria-label={phone ? (open ? 'Close chat with the bunny' : 'Open chat with the bunny') : (collapsed ? 'Show the chat with the bunny' : 'Hide the chat, keep just the bunny')}
          aria-describedby={phone ? undefined : 'floating-hint'}
          onClick={onBunnyClick}
          onKeyDown={onBunnyKey}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: size.bunny, touchAction: phone ? 'auto' : 'none' }}
          className={`pointer-events-auto shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${phone ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <Bunny size={300} className="h-auto w-full" />
        </button>
        {phone && !open && (
          <p
            data-testid="bunny-words"
            style={{ maxWidth: phone ? 'calc(100vw - 168px)' : 280 }}
            className="line-clamp-4 rounded-2xl bg-accent px-4 py-3 text-base leading-snug text-foreground"
          >
            {words}
          </p>
        )}
        {!phone && !collapsed && (
          <section
            aria-label="Chat with the bunny"
            data-testid="floating-panel"
            style={{ width: size.panel }}
            className="pointer-events-auto flex max-h-[70vh] flex-col justify-end gap-2 self-end"
          >
            {chat.support ? (
              <div data-testid="chat-support" className="space-y-3">
                <p className="rounded-2xl bg-accent px-4 py-3 text-base leading-relaxed text-foreground">
                  I&apos;m glad you told me. It sounds like things may be really hard right now, and a real person can help in ways I can&apos;t.
                </p>
                <SupportCard heading="Talk to someone now" />
                <Button variant="ghost" onClick={chat.dismissSupport}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <ul aria-live="polite" aria-label="Conversation" data-testid="floating-thread" className="flex flex-col justify-end gap-2 overflow-hidden">
                  {chat.thread.length === 0 && !chat.sending ? (
                    <li data-testid="bunny-words" className="rounded-2xl bg-accent px-4 py-3 text-lg leading-relaxed text-foreground">
                      {greeting}
                    </li>
                  ) : (
                    visibleMessages<{ role: 'user' | 'bunny' | 'thinking'; text: string; index: number }>([
                      ...chat.thread.map((m, index) => ({ ...m, index })),
                      ...(chat.sending ? [{ role: 'thinking' as const, text: 'Hmm…', index: chat.thread.length }] : []),
                    ]).map(({ item: m, age }) => {
                      const look = fadeFor(age)!
                      const isLatest = m.role === 'thinking' || (m.index === lastBunnyIndex && !chat.sending)
                      return (
                        <li
                          key={m.index}
                          data-testid={isLatest ? 'bunny-words' : undefined}
                          style={{ fontSize: `${look.size}rem`, opacity: look.opacity }}
                          className={`leading-relaxed text-foreground motion-safe:transition-all motion-safe:duration-300 rounded-2xl px-4 py-2 ${
                            m.role === 'user' ? 'ml-10 bg-primary text-primary-foreground' : 'bg-accent'
                          }`}
                        >
                          {m.text}
                          {isLatest && m.role === 'bunny' && !chat.error && isSignedIn && (
                            <div className="mt-1" style={{ fontSize: '1rem' }}>
                              <ReplyFeedback replyKey={`${chat.thread.length}:${m.text}`} />
                            </div>
                          )}
                        </li>
                      )
                    })
                  )}
                </ul>
                <OfferLink />

                {chat.error && (
                  <div role="alert" data-testid="chat-error" className="rounded-xl bg-accent p-3 text-sm text-foreground">
                    <p>{chat.error}</p>
                    {chat.thread[chat.thread.length - 1]?.role === 'user' && !chat.sending && (
                      <Button className="mt-2" size="sm" variant="outline" onClick={() => void chat.retry()}>
                        Try again
                      </Button>
                    )}
                  </div>
                )}

                {chat.thread.length === 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Ways to start">
                    {STARTERS.map((t) => (
                      <Button key={t} variant="outline" size="sm" onClick={() => submit(t)} disabled={chat.sending}>
                        {t}
                      </Button>
                    ))}
                  </div>
                )}

                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (text.trim()) submit(text)
                  }}
                >
                  <label htmlFor="floating-input" className="sr-only">
                    Tell the bunny something
                  </label>
                  <AutoTextarea
                    id="floating-input"
                    value={text}
                    maxLines={5}
                    maxLength={MAX_MESSAGE_CHARS}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (text.trim()) submit(text)
                      }
                    }}
                    placeholder="Tell the bunny something…"
                    className="min-w-0 flex-1"
                  />
                  <Button type="submit" size="icon" aria-label="Send" disabled={chat.sending || !text.trim()}>
                    <Send aria-hidden className="h-4 w-4" />
                  </Button>
                </form>

                <div style={{ textShadow: HALO }} className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-foreground">
                  {chat.thread.length === 0 ? (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={chat.isPrivate}
                        onChange={(e) => chat.setPrivate(e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      Don&apos;t save this chat
                    </label>
                  ) : (
                    <span data-testid="chat-private-note">
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
                <p style={{ textShadow: HALO }} className="text-xs text-foreground">
                  The bunny is an AI, not a person or a therapist.
                </p>
              </>
            )}
          </section>
        )}
        <span id="floating-hint" className="sr-only">
          Press Enter to hide or show the chat. Use the arrow keys to move the bunny.
        </span>
      </div>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </div>
  )
}
