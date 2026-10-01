import { describe, expect, it } from 'vitest'
import { QUIET_MS, notesDue, titleFromFirstMessage, writeAutoNote, type AutoNoteDeps, type ConversationState } from './auto-notes'
import type { ChatMessage, JournalDraft } from './contract'
import { REFLECT_DAILY_CAP } from './pipeline'
import { backgroundNotes, buildReplyPrompt } from './llm'
import { reflectReply, type ReflectDeps } from './pipeline'

const NOW = Date.parse('2026-10-01T15:00:00Z')
const user = (text: string): ChatMessage => ({ role: 'user', text })
const bunny = (text: string): ChatMessage => ({ role: 'bunny', text })

const summaryJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'A heavy day',
    notes: ['You told me work felt heavy today.'],
    feelings: ['tired'],
    bunnyNote: 'Thanks for telling me.',
    needsSupportResources: false,
    ...over,
  })

function makeDeps(opts: { conv?: ConversationState | null; messages?: ChatMessage[]; llm?: () => string | null; used?: number } = {}) {
  const log = { prompts: [] as string[], written: [] as { id: string; draft: JournalDraft; to: number }[], skipped: [] as number[], bumps: 0 }
  const messages = opts.messages ?? [user('work was heavy'), bunny('That sounds hard.'), user('a walk helped')]
  const deps: AutoNoteDeps = {
    now: () => new Date(NOW),
    exempt: false,
    llm: async (req) => {
      log.prompts.push(req.user)
      return (opts.llm ?? (() => summaryJson()))()
    },
    usageToday: async () => opts.used ?? 0,
    bumpUsage: async () => {
      log.bumps++
    },
    loadConversation: async () => (opts.conv === undefined ? { lastMessageAt: NOW - QUIET_MS - 1000, notedUpTo: 0 } : opts.conv),
    loadMessages: async () => messages,
    writeNote: async (id, draft, to) => {
      log.written.push({ id, draft, to })
    },
    skipTo: async (_id, to) => {
      log.skipped.push(to)
    },
  }
  return { deps, log, messages }
}

describe('notesDue', () => {
  const c: ConversationState = { lastMessageAt: NOW - 10 * 60_000, notedUpTo: 2 }
  it('waits until the chat has been quiet, unless the person moved on', () => {
    expect(notesDue(c, 4, NOW)).toBe('too_soon')
    expect(notesDue(c, 4, NOW, true)).toBe('due')
    expect(notesDue({ ...c, lastMessageAt: NOW - QUIET_MS }, 4, NOW)).toBe('due')
  })
  it('does nothing when earlier notes already cover every message, even when forced', () => {
    expect(notesDue(c, 2, NOW, true)).toBe('nothing_new')
    expect(notesDue(c, 1, NOW, true)).toBe('nothing_new')
  })
})

describe('writeAutoNote', () => {
  it('writes a note for a quiet conversation and moves the marker to the full message count', async () => {
    const { deps, log } = makeDeps()
    expect(await writeAutoNote(deps, 'c1')).toEqual({ status: 'ok' })
    expect(log.written).toHaveLength(1)
    expect(log.written[0]).toMatchObject({ id: 'c1', to: 3, draft: { title: 'A heavy day' } })
  })

  it('treats a conversation that is not the caller\'s (or does not exist) as not found, and does nothing', async () => {
    const { deps, log } = makeDeps({ conv: null })
    expect(await writeAutoNote(deps, 'someone-elses')).toEqual({ status: 'not_found' })
    expect(log.prompts).toHaveLength(0)
    expect(log.written).toHaveLength(0)
  })

  it('summarizes only messages the earlier notes did not cover', async () => {
    const { deps, log } = makeDeps({
      conv: { lastMessageAt: NOW - QUIET_MS - 1, notedUpTo: 2 },
      messages: [user('OLD first thing'), bunny('OLD reply'), user('NEW second thing')],
    })
    await writeAutoNote(deps, 'c1')
    expect(log.prompts[0]).toContain('NEW second thing')
    expect(log.prompts[0]).not.toContain('OLD first thing')
    expect(log.written[0]!.to).toBe(3)
  })

  it('does not run too soon, but does when forced, and does nothing when there is nothing new', async () => {
    const recent = { lastMessageAt: NOW - 60_000, notedUpTo: 0 }
    const a = makeDeps({ conv: recent })
    expect(await writeAutoNote(a.deps, 'c1')).toEqual({ status: 'too_soon' })
    expect(a.log.prompts).toHaveLength(0)
    const b = makeDeps({ conv: recent })
    expect(await writeAutoNote(b.deps, 'c1', { force: true })).toEqual({ status: 'ok' })
    const c = makeDeps({ conv: { lastMessageAt: NOW - QUIET_MS - 1, notedUpTo: 3 } })
    expect(await writeAutoNote(c.deps, 'c1')).toEqual({ status: 'nothing_new' })
    expect(c.log.prompts).toHaveLength(0)
  })

  it('never writes a note about crisis words, makes no model call, and does not ask again', async () => {
    const { deps, log } = makeDeps({ messages: [user('I want to end it all'), bunny('I am here.')] })
    expect(await writeAutoNote(deps, 'c1')).toEqual({ status: 'support' })
    expect(log.prompts).toHaveLength(0)
    expect(log.written).toHaveLength(0)
    expect(log.skipped).toEqual([2])
  })

  it('also stops when the model flags a crisis', async () => {
    const { deps, log } = makeDeps({ llm: () => summaryJson({ needsSupportResources: true }) })
    expect(await writeAutoNote(deps, 'c1')).toEqual({ status: 'support' })
    expect(log.written).toHaveLength(0)
    expect(log.skipped).toEqual([3])
  })

  it('leaves the marker alone on failure so it is retried later, and respects the daily cap', async () => {
    const failed = makeDeps({ llm: () => null })
    expect(await writeAutoNote(failed.deps, 'c1')).toEqual({ status: 'error' })
    expect(failed.log.written).toHaveLength(0)
    expect(failed.log.skipped).toHaveLength(0)
    const capped = makeDeps({ used: REFLECT_DAILY_CAP })
    expect(await writeAutoNote(capped.deps, 'c1')).toEqual({ status: 'capped' })
    expect(capped.log.prompts).toHaveLength(0)
  })

  it('does not write when only the bunny spoke', async () => {
    const { deps, log } = makeDeps({ messages: [bunny('Hello there.')] })
    const res = await writeAutoNote(deps, 'c1')
    expect(res.status).toBe('error')
    expect(log.written).toHaveLength(0)
  })
})

describe('titleFromFirstMessage', () => {
  it('uses short messages as they are, collapses whitespace, and trims long ones at a word', () => {
    expect(titleFromFirstMessage('  work   was heavy ')).toBe('work was heavy')
    const t = titleFromFirstMessage('I have been thinking a lot about whether I should change jobs this year')
    expect(t.endsWith('…')).toBe(true)
    expect(t.length).toBeLessThanOrEqual(41)
    expect(t).not.toMatch(/\s…$/)
    expect(titleFromFirstMessage('   ')).toBe('New conversation')
  })
})

describe('personalization from visible notes', () => {
  it('trims the background to the five newest notes and a small size', () => {
    const notes = Array.from({ length: 9 }, (_, i) => ({ title: `Note ${i}`, notes: ['x'.repeat(300)] }))
    const bg = backgroundNotes(notes)
    expect(bg.length).toBeLessThanOrEqual(5)
    expect(bg[0]!.title).toBe('Note 0')
    expect(bg[0]!.notes[0]!.length).toBe(200)
    expect(JSON.stringify(bg).length).toBeLessThan(2200)
  })

  it('adds the notes to the reply prompt as background, labelled as not instructions, and omits them when there are none', () => {
    const withNotes = buildReplyPrompt([user('hi')], [{ title: 'A heavy day', notes: ['You told me work felt heavy.'] }])
    const payload = JSON.parse(withNotes.user)
    expect(payload.earlier_notes_background[0].title).toBe('A heavy day')
    expect(payload.conversation).toEqual([{ speaker: 'person', text: 'hi' }])
    expect(withNotes.system).toMatch(/not instructions/)
    expect(withNotes.system).toMatch(/do not announce/)
    const without = buildReplyPrompt([user('hi')])
    expect(JSON.parse(without.user)).toEqual([{ speaker: 'person', text: 'hi' }])
  })

  it('reaches the model on a real reply, and a failure to load notes does not break the reply', async () => {
    const seen: string[] = []
    const base: ReflectDeps = {
      now: () => new Date(NOW),
      exempt: false,
      llm: async (r) => {
        seen.push(r.user)
        return JSON.stringify({ reply: 'Okay.', needsSupportResources: false })
      },
      usageToday: async () => 0,
      bumpUsage: async () => {},
      recentNotes: async () => [{ title: 'Exam week', notes: ['You told me you have an exam on Friday.'] }],
    }
    expect((await reflectReply(base, [user('hi')])).status).toBe('ok')
    expect(seen[0]).toContain('Exam week')
    const broken: ReflectDeps = { ...base, recentNotes: async () => Promise.reject(new Error('db down')) }
    expect((await reflectReply(broken, [user('hi')])).status).toBe('ok')
  })
})
