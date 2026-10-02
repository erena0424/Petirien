/**
 * One conversation with the bunny, shared by everything that shows it (the big
 * bunny on Home, the Messages tab, and later a floating bunny on every page).
 *
 * Saved chats are written to the database as they happen. A chat marked
 * "Don't save" lives only in this component and never creates a row. Crisis
 * words stop the conversation (the server checks every message before any model
 * call). Nothing here retries a model call by itself.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { callAction } from '@/lib/actions-client'
import { formatResetTime } from '@/lib/format'
import { notesDue, titleFromFirstMessage } from '../reflect/auto-notes'
import { minutesUntil, openerFor, type Plan } from '../plans/plan'
import { choiceFor } from './free-time'
import { MAX_MESSAGES, type ChatMessage, type ReplyResponse } from '../reflect/contract'

/** The most recent messages go to the model; the rest stay on screen and in storage. */
export const CONTEXT_MESSAGES = MAX_MESSAGES - 2

export interface ConversationRow {
  title?: string
  planId?: string
  planTitle?: string
  planStart?: string
  lastMessageAt: number
  notedUpTo?: number
  messageCount?: number
}

interface MessageRow {
  conversationId: string
  role: 'user' | 'bunny'
  text: string
  seq: number
}

/** Turns a failed or unusual reply into one calm line. Null means the reply was fine. */
export function replyProblem(res: ReplyResponse | null): string | null {
  if (!res) return "I couldn't reach the server. Check your connection and try again."
  if (res.status === 'error') return res.message
  if (res.status === 'capped') return `That's enough chatting for today. I'll be back around ${formatResetTime(res.resetsAt)}.`
  return null
}

interface BunnyChat {
  thread: ChatMessage[]
  /** The bunny's most recent words, or null before it has said anything. */
  latest: string | null
  sending: boolean
  error: string | null
  /** Crisis language was detected: show the support card and do not reply. */
  support: boolean
  conversationId: string | null
  isPrivate: boolean
  /** The chat is not private but could not be saved (storage was unreachable). */
  saveFailed: boolean
  /** Only possible before the first message. */
  setPrivate: (v: boolean) => void
  send: (text: string) => Promise<void>
  retry: () => Promise<void>
  newConversation: () => void
  /** Open a saved conversation, loading its stored messages. */
  open: (id: string) => void
  dismissSupport: () => void
  conversations: { recordId: string; data: ConversationRow; createdAt: string }[]
  conversationsReady: boolean
  deleteConversation: (id: string) => Promise<boolean>
  /** Up to three earlier saved conversations (not the open one), newest first, with the bunny's last words in each. */
  earlier: { id: string; title: string; text: string }[]
  /** The bunny thinks a small idea might help right now: where the optional "Find a small idea" link goes. Null when there is no offer. */
  offerHref: string | null
  /** Start a fresh conversation about a plan: the bunny's first line asks how the person feels about it. */
  startAbout: (plan: Plan) => Promise<void>
  /** Goes up each time something asks to bring the chat forward (opens the phone sheet, shows the hidden chat, focuses the text box). */
  focusTick: number
  requestFocus: () => void
  /** Ask for notes about the open conversation now. Resolves true when a note was written. */
  writeNotesNow: () => Promise<boolean>
}

const Ctx = createContext<BunnyChat | null>(null)

export function useBunnyChat(): BunnyChat {
  const v = useContext(Ctx)
  if (!v) throw new Error('useBunnyChat must be used inside <BunnyChatProvider>')
  return v
}

const NOTED_KEY = 'petirien.autoNoteTried'

export function BunnyChatProvider({ children }: { children: ReactNode }) {
  const convQuery = useQuery<ConversationRow>('conversations', { orderBy: 'lastMessageAt', orderDir: 'desc' })
  const convMut = useMutations<ConversationRow>('conversations')
  const msgMut = useMutations<MessageRow>('messages')
  const msgMutRef = useRef(msgMut)
  const convMutRef = useRef(convMut)
  msgMutRef.current = msgMut
  convMutRef.current = convMut

  // Message ids per conversation are read from the database when a delete is requested.
  const allMessages = useQuery<MessageRow>('messages', { orderBy: 'seq', orderDir: 'asc' })
  const messageIdsRef = useRef((id: string): { recordId: string }[] => [])
  messageIdsRef.current = (id: string) => allMessages.records.filter((m) => m.data.conversationId === id).map((m) => ({ recordId: m.recordId }))
  const messagesRef = useRef((id: string): ChatMessage[] => [])
  messagesRef.current = (id: string) =>
    allMessages.records.filter((m) => m.data.conversationId === id).map((m) => ({ role: m.data.role, text: m.data.text }))


  const [thread, setThread] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [support, setSupport] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const creating = useRef<Promise<string | null> | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [offerHref, setOfferHref] = useState<string | null>(null)
  const aboutPlan = useRef<Plan | null>(null)
  const requestFocus = useCallback(() => setFocusTick((n) => n + 1), [])

  // Writes are only accepted once the connection is ready. Typing right after the page
  // loads must wait for it, or the chat would quietly not be saved.
  const readyRef = useRef(false)
  readyRef.current = convMut.ready && msgMut.ready
  const waitUntilReady = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < 160 && !readyRef.current; i++) await new Promise((r) => setTimeout(r, 50))
    return readyRef.current
  }, [])

  /** Create the stored conversation on the first saved message (once, even if sends overlap). */
  const ensureConversation = useCallback(async (firstText: string): Promise<string | null> => {
    if (conversationId) return conversationId
    if (!creating.current) {
      creating.current = convMutRef.current
        .createConfirmed({ title: titleFromFirstMessage(firstText), lastMessageAt: Date.now(), notedUpTo: 0, messageCount: 0 })
        .then((id) => {
          setConversationId(id)
          return id
        })
        .catch(() => null) // the data layer shows the reason; the chat carries on unsaved
    }
    return creating.current
  }, [conversationId])

  const persist = useCallback(async (id: string | null, msg: ChatMessage, seq: number) => {
    if (!id) return
    try {
      await msgMutRef.current.createConfirmed({ conversationId: id, role: msg.role, text: msg.text, seq })
      await convMutRef.current.putConfirmed(id, { lastMessageAt: Date.now(), messageCount: seq + 1 })
    } catch {
      /* shown as a toast by the data layer */
    }
  }, [])

  const ask = useCallback(
    async (conversation: ChatMessage[], id: string | null) => {
      setError(null)
      setOfferHref(null)
      setSending(true)
      const res = await callAction<ReplyResponse>('reflectReply', { messages: conversation.slice(-CONTEXT_MESSAGES) })
      setSending(false)
      if (res?.status === 'ok') {
        const bunny: ChatMessage = { role: 'bunny', text: res.reply }
        setThread([...conversation, bunny])
        if (res.offer) {
          // Prefill the time from how long until the plan, so the idea fits; no plan means the form's usual default.
          const m = aboutPlan.current ? minutesUntil(aboutPlan.current, new Date()) : null
          setOfferHref(m === null ? '/checkin' : `/checkin?minutes=${choiceFor(m)}`)
        }
        await persist(id, bunny, conversation.length)
      } else if (res?.status === 'support') {
        setSupport(true)
      } else {
        setError(replyProblem(res))
      }
    },
    [persist],
  )

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || sending || support) return
      const message: ChatMessage = { role: 'user', text: clean }
      const next = [...thread, message]
      setThread(next)
      let id: string | null = null
      if (!isPrivate) {
        id = (await waitUntilReady()) ? await ensureConversation(clean) : null
        setSaveFailed(id === null)
      }
      await persist(id, message, next.length - 1)
      await ask(next, id)
    },
    [thread, sending, support, isPrivate, waitUntilReady, ensureConversation, persist, ask],
  )

  const retry = useCallback(async () => {
    if (thread[thread.length - 1]?.role !== 'user' || sending) return
    await ask(thread, conversationId)
  }, [thread, sending, conversationId, ask])

  const noteSoon = useCallback((id: string | null, force: boolean) => {
    if (!id) return
    void callAction('summarizeConversation', { conversationId: id, force })
  }, [])

  const reset = useCallback(() => {
    creating.current = null
    aboutPlan.current = null
    setOfferHref(null)
    setThread([])
    setConversationId(null)
    setIsPrivate(false)
    setError(null)
    setSupport(false)
    setSaveFailed(false)
  }, [])

  const newConversation = useCallback(() => {
    // The person is moving on: write notes for the conversation they are leaving.
    noteSoon(conversationId, true)
    reset()
  }, [conversationId, noteSoon, reset])

  const startAbout = useCallback(
    async (plan: Plan) => {
      noteSoon(conversationId, true) // like starting a new conversation: write notes for the one being left
      reset()
      const opener: ChatMessage = { role: 'bunny', text: openerFor(plan, new Date()) }
      setThread([opener])
      aboutPlan.current = plan
      // Saved like any chat. send() waits on this same promise, so a quick reply cannot create a second conversation.
      creating.current = (async () => {
        if (!(await waitUntilReady())) {
          setSaveFailed(true)
          return null
        }
        try {
          const id = await convMutRef.current.createConfirmed({
            title: titleFromFirstMessage(plan.title),
            lastMessageAt: Date.now(),
            notedUpTo: 0,
            messageCount: 0,
            planId: plan.id,
            planTitle: plan.title,
            planStart: plan.start,
          })
          setConversationId(id)
          await persist(id, opener, 0)
          return id
        } catch {
          setSaveFailed(true)
          return null
        }
      })()
      setFocusTick((n) => n + 1)
    },
    [conversationId, noteSoon, reset, waitUntilReady, persist],
  )

  const open = useCallback(
    (id: string) => {
      if (id === conversationId) return
      noteSoon(conversationId, true)
      creating.current = Promise.resolve(id)
      setConversationId(id)
      setThread(messagesRef.current(id))
      setIsPrivate(false)
      setError(null)
      setSupport(false)
    },
    [conversationId, noteSoon],
  )

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // Remove the conversation's own messages one by one; the notes in the Journal stay.
        const stored = messageIdsRef.current(id)
        for (const m of stored) await msgMutRef.current.removeConfirmed(m.recordId)
        await convMutRef.current.removeConfirmed(id)
        if (id === conversationId) reset()
        return true
      } catch {
        return false
      }
    },
    [conversationId, reset],
  )

  const writeNotesNow = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false
    const res = await callAction<{ status: string }>('summarizeConversation', { conversationId, force: true })
    return res?.status === 'ok'
  }, [conversationId])

  // Automatic notes: once per page load, for the oldest chat that has gone quiet and has un-noted messages.
  useEffect(() => {
    if (convQuery.status !== 'ready') return
    const now = Date.now()
    const due = [...convQuery.records]
      .reverse()
      .find((c) => c.recordId !== conversationId && notesDue({ lastMessageAt: c.data.lastMessageAt, notedUpTo: c.data.notedUpTo ?? 0 }, c.data.messageCount ?? 0, now) === 'due')
    if (!due) return
    const key = `${due.recordId}:${due.data.messageCount ?? 0}`
    try {
      if (sessionStorage.getItem(NOTED_KEY) === key) return
      sessionStorage.setItem(NOTED_KEY, key)
    } catch {
      /* storage unavailable: try once per mount */
    }
    void callAction('summarizeConversation', { conversationId: due.recordId })
  }, [convQuery.status, convQuery.records, conversationId])

  const latest = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) if (thread[i]!.role === 'bunny') return thread[i]!.text
    return null
  }, [thread])

  const earlier = useMemo(() => {
    const out: { id: string; title: string; text: string }[] = []
    for (const c of convQuery.records) {
      if (c.recordId === conversationId) continue
      const mine = allMessages.records.filter((m) => m.data.conversationId === c.recordId)
      const last = [...mine].reverse().find((m) => m.data.role === 'bunny') ?? mine[mine.length - 1]
      if (!last) continue
      out.push({ id: c.recordId, title: c.data.title || 'Earlier chat', text: last.data.text })
      if (out.length === 3) break
    }
    return out
  }, [convQuery.records, allMessages.records, conversationId])

  const value: BunnyChat = {
    thread,
    latest,
    sending,
    error,
    support,
    conversationId,
    isPrivate,
    saveFailed,
    setPrivate: (v) => {
      if (thread.length === 0) setIsPrivate(v)
    },
    send,
    retry,
    newConversation,
    open,
    dismissSupport: reset,
    conversations: convQuery.records.map((r) => ({ recordId: r.recordId, data: r.data, createdAt: r.createdAt })),
    conversationsReady: convQuery.status === 'ready',
    deleteConversation,
    earlier,
    offerHref,
    startAbout,
    focusTick,
    requestFocus,
    writeNotesNow,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

