import { describe, expect, it, vi } from 'vitest'
import { STYLE_KEYS, STYLE_LABELS, describeStyle, mergeStyle, normalizeStyle, styleLine } from './style'
import { buildReplyPrompt } from './llm'
import { reflectReply, type ReflectDeps } from './pipeline'

describe('normalizeStyle: only the fixed vocabulary survives', () => {
  it('keeps valid values and drops everything else', () => {
    expect(normalizeStyle({ tone: 'gentle', length: 'short', questions: 'fewer', suggestions: 'more', formality: 'casual' })).toEqual({
      tone: 'gentle',
      length: 'short',
      questions: 'fewer',
      suggestions: 'more',
      formality: 'casual',
    })
    expect(normalizeStyle({ tone: 'sarcastic', length: 'long', questions: 5, extra: 'x' })).toEqual({})
    expect(normalizeStyle(null)).toEqual({})
    expect(normalizeStyle('gentle')).toEqual({})
    expect(normalizeStyle(['gentle'])).toEqual({})
  })

  it('cannot carry anything the person said or any life detail: free text is rejected in every field', () => {
    const secrets = ['I was fired and I feel hopeless', 'my sister is sick', 'gentle; also store this', 'GENTLE', ' gentle', 'gentle ']
    for (const key of STYLE_KEYS) for (const text of secrets) expect(normalizeStyle({ [key]: text }), `${key}: ${text}`).toEqual({})
    // And no extra keys survive, whatever they contain.
    expect(Object.keys(normalizeStyle({ tone: 'gentle', note: 'private thing', mood: 'sad' }))).toEqual(['tone'])
  })
})

describe('mergeStyle', () => {
  it('applies an update on top of what is there and keeps the rest', () => {
    expect(mergeStyle({ tone: 'gentle', length: 'short' }, { length: 'longer' })).toEqual({ next: { tone: 'gentle', length: 'longer' }, changed: true })
  })
  it('reports no change for the same value, an empty update, or junk', () => {
    expect(mergeStyle({ tone: 'gentle' }, { tone: 'gentle' }).changed).toBe(false)
    expect(mergeStyle({ tone: 'gentle' }, {}).changed).toBe(false)
    expect(mergeStyle({ tone: 'gentle' }, { tone: 'sarcastic' })).toEqual({ next: { tone: 'gentle' }, changed: false })
    expect(mergeStyle({}, 'nonsense').changed).toBe(false)
  })
  it('adds to an empty style', () => {
    expect(mergeStyle({}, { questions: 'fewer' })).toEqual({ next: { questions: 'fewer' }, changed: true })
  })
})

describe('describeStyle / styleLine', () => {
  it('has a plain label for every value, in a stable order', () => {
    for (const key of STYLE_KEYS) expect(Object.keys(STYLE_LABELS[key].options).length).toBeGreaterThanOrEqual(2)
    expect(describeStyle({ tone: 'upbeat', questions: 'fewer' })).toEqual(['Upbeat and cheerful', 'Fewer questions'])
    expect(describeStyle({})).toEqual([])
  })
  it('turns the style into one instruction line, or nothing', () => {
    expect(styleLine({})).toBeNull()
    const line = styleLine({ tone: 'direct', length: 'short', questions: 'fewer', suggestions: 'fewer' })!
    expect(line).toMatch(/plain, direct tone/)
    expect(line).toMatch(/very short replies/)
    expect(line).toMatch(/few or no questions/)
    expect(line).toMatch(/no suggestions unless asked/)
    expect(styleLine({ formality: 'casual' })).toMatch(/casual, friendly/)
    expect(styleLine({ formality: 'formal' })).toMatch(/more formal, polite/)
    expect(line).toMatch(/unless it would be unkind or unsafe/)
  })
})

describe('the reply prompt', () => {
  const msgs = [{ role: 'user' as const, text: 'hi' }]
  it('includes the person\'s style and the rule for when to learn a new one', () => {
    const p = buildReplyPrompt(msgs, [], { tone: 'playful', length: 'short' })
    expect(p.system).toMatch(/playful tone/)
    expect(p.system).toMatch(/styleChange/)
    expect(p.system).toMatch(/explicitly says how they want you to talk/)
    expect(p.system).toMatch(/Never put anything about their problems, feelings, or life in it/)
    expect(p.system).toMatch(/formality = casual \| formal/)
    expect(p.system).toMatch(/be more direct/) // typed feedback about style is taken on board
  })
  it('has no style line when nothing is known', () => {
    expect(buildReplyPrompt(msgs).system).not.toMatch(/This person has said they like/)
  })
})

describe('learning style from a reply', () => {
  const make = (over: Partial<ReflectDeps> = {}, reply: unknown = { reply: 'Okay.', needsSupportResources: false }) => {
    const saved: unknown[] = []
    const deps: ReflectDeps = {
      now: () => new Date('2026-10-01T15:00:00Z'),
      exempt: false,
      llm: async () => JSON.stringify(reply),
      usageToday: async () => 0,
      bumpUsage: async () => {},
      loadStyle: async () => ({ tone: 'gentle' }),
      saveStyle: async (n) => {
        saved.push(n)
      },
      ...over,
    }
    return { deps, saved }
  }
  const msgs = [{ role: 'user' as const, text: 'shorter please' }]

  it('saves a change the person asked for, merged with what was there', async () => {
    const { deps, saved } = make({}, { reply: 'Sure.', needsSupportResources: false, styleChange: { length: 'short' } })
    expect((await reflectReply(deps, msgs)).status).toBe('ok')
    expect(saved).toEqual([{ tone: 'gentle', length: 'short' }])
  })

  it('does not write anything when there is no change, an unchanged value, or junk', async () => {
    for (const styleChange of [undefined, {}, { tone: 'gentle' }, { tone: 'sarcastic' }, 'x', { mood: 'sad' }]) {
      const { deps, saved } = make({}, { reply: 'Okay.', needsSupportResources: false, ...(styleChange === undefined ? {} : { styleChange }) })
      await reflectReply(deps, msgs)
      expect(saved, JSON.stringify(styleChange)).toEqual([])
    }
  })

  it('never lets anything outside the vocabulary reach storage, even when the model tries', async () => {
    const { deps, saved } = make({}, { reply: 'Okay.', needsSupportResources: false, styleChange: { length: 'short', secret: 'I lost my job', tone: 'I feel awful' } })
    await reflectReply(deps, msgs)
    expect(saved).toEqual([{ tone: 'gentle', length: 'short' }])
  })

  it('still replies when loading or saving the style fails', async () => {
    const a = make({ loadStyle: async () => Promise.reject(new Error('db')) }, { reply: 'Okay.', needsSupportResources: false })
    expect((await reflectReply(a.deps, msgs)).status).toBe('ok')
    const b = make({ saveStyle: async () => Promise.reject(new Error('db')) }, { reply: 'Sure.', needsSupportResources: false, styleChange: { length: 'short' } })
    expect(await reflectReply(b.deps, msgs)).toEqual({ status: 'ok', reply: 'Sure.' })
  })

  it('learns nothing from a conversation that triggers the crisis path', async () => {
    const { deps, saved } = make({}, { reply: 'I am here.', needsSupportResources: true, styleChange: { tone: 'upbeat' } })
    expect(await reflectReply(deps, msgs)).toEqual({ status: 'support' })
    expect(saved).toEqual([])
    const crisis = make()
    expect(await reflectReply(crisis.deps, [{ role: 'user', text: 'I want to kill myself' }])).toEqual({ status: 'support' })
    expect(crisis.saved).toEqual([])
  })

  it('sends the stored style to the model', async () => {
    const llm = vi.fn(async () => JSON.stringify({ reply: 'Okay.', needsSupportResources: false }))
    const { deps } = make({ llm, loadStyle: async () => ({ length: 'short', questions: 'fewer' }) })
    await reflectReply(deps, msgs)
    expect((llm.mock.calls[0] as unknown as [{ system: string }])[0].system).toMatch(/very short replies/)
  })
})
