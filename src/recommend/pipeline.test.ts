import { describe, expect, it, vi } from 'vitest'
import { getActivity } from '../catalog'
import type { CheckinInput } from '../contract'
import { DAILY_CAP, parseCheckinInput, recommend, type Deps, type SuggestionRow } from './pipeline'

// ── fakes ────────────────────────────────────────────────────────────────

const vid = (n: number, title = `Gentle video ${n}`, dur = 'PT6M') => ({
  id: `vid${String(n).padStart(8, '0')}`, // 11 chars
  title,
  channelTitle: 'Calm Channel',
  duration: dur,
})

interface Calls {
  llm: number
  search: string[]
  details: number
  checkins: Record<string, unknown>[]
  suggestions: SuggestionRow[]
  usage: number
}

function makeDeps(over: Partial<Deps> = {}, opts: { usageToday?: number } = {}) {
  const calls: Calls = { llm: 0, search: [], details: 0, checkins: [], suggestions: [], usage: 0 }
  const deps: Deps = {
    now: () => new Date('2026-10-01T15:00:00Z'),
    llm: async () => null,
    searchVideos: async (q) => {
      calls.search.push(q)
      return [vid(1), vid(2), vid(3)]
    },
    videoDetails: async () => {
      calls.details++
      return []
    },
    cacheGet: async (_q, _opts) => null,
    cachePut: async () => {},
    loadContext: async () => ({
      prefs: { dislikedTags: [], avoid: [], likedTags: [] },
      liked: [],
      disliked: [],
      usageToday: opts.usageToday ?? 0,
    }),
    bumpUsage: async () => {
      calls.usage++
    },
    ownsCheckin: async () => false,
    saveCheckin: async (row) => {
      calls.checkins.push(row)
      return `chk_${calls.checkins.length}`
    },
    saveSuggestions: async (_id, rows) => {
      calls.suggestions.push(...rows)
      return rows.map((_, i) => `sug_${calls.suggestions.length - rows.length + i + 1}`)
    },
    ...over,
  }
  const llm = deps.llm
  deps.llm = async (req) => {
    calls.llm++
    return llm(req)
  }
  return { deps, calls }
}

const input: CheckinInput = { mood: 3, energy: 4, minutes: 15, goal: 'move' }

const interpretJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    goal: 'move',
    activityIds: ['desk-stretch', 'chair-yoga', 'neck-shoulders'],
    reply: 'Here are a few easy ways to get moving.',
    intent: 'wants to settle',
    needsSupportResources: false,
    ...over,
  })

/** Routes by prompt so one fake serves both model calls. */
function llmScript(interpret: string | null, rank: (prompt: string) => string | null) {
  return async ({ system, user }: { system: string; user: string }) =>
    system.includes('"activityIds"') ? interpret : rank(user)
}

// ── input ────────────────────────────────────────────────────────────────

describe('parseCheckinInput', () => {
  it('accepts a good check-in and rejects bad values', () => {
    expect(parseCheckinInput(input).ok).toBe(true)
    expect(parseCheckinInput({ ...input, mood: 9 }).ok).toBe(false)
    expect(parseCheckinInput({ ...input, minutes: 0 }).ok).toBe(false)
    expect(parseCheckinInput({ ...input, goal: 'sleep' }).ok).toBe(false)
    expect(parseCheckinInput({ ...input, note: 'x'.repeat(1001) }).ok).toBe(false)
    expect(parseCheckinInput(null).ok).toBe(false)
  })
})

// ── happy path and model misbehavior ─────────────────────────────────────

describe('recommend: happy path', () => {
  it('returns real picks with model reasons and stores them', async () => {
    const { deps, calls } = makeDeps({
      llm: llmScript(interpretJson(), (user) => {
        const a = JSON.parse(user).activities as { activityId: string; candidates: { videoId: string }[] }[]
        return JSON.stringify({
          picks: a.map((x) => ({
            activityId: x.activityId,
            videoId: x.candidates[0]!.videoId,
            reason: 'A short, steady one that fits your time.',
          })),
        })
      }),
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.length).toBeGreaterThanOrEqual(2)
    expect(res.picks.length).toBeLessThanOrEqual(3)
    expect(res.degraded).toEqual([])
    expect(res.picks[0]!.reason).toBe('A short, steady one that fits your time.')
    expect(calls.suggestions.length).toBe(res.picks.length)
    expect(res.picks.map((p) => p.suggestionId)).toEqual(res.picks.map((_, i) => `sug_${i + 1}`))
    expect(calls.usage).toBe(1)
  })

  it('never shows a video id that did not come from retrieval', async () => {
    const { deps } = makeDeps({
      llm: llmScript(interpretJson(), () =>
        JSON.stringify({ picks: [{ activityId: 'box-breathing', videoId: 'INVENTED1234', reason: 'Nice.' }] }),
      ),
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    for (const p of res.picks) expect(p.video!.videoId).toMatch(/^vid0000000[123]$/)
    expect(res.degraded).toContain('rank')
  })

  it('drops activity ids the filter removed or the model invented', async () => {
    const { deps } = makeDeps({
      llm: llmScript(interpretJson({ activityIds: ['made-up', 'gentle-yoga', 'desk-stretch'] }), () => null),
    })
    // 5 minutes: gentle-yoga needs at least 8, so the filter removes it.
    const res = await recommend(deps, { ...input, minutes: 5 })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    const ids = res.picks.map((p) => p.activityId)
    expect(ids).not.toContain('made-up')
    expect(ids).not.toContain('gentle-yoga')
    expect(ids).toContain('desk-stretch')
  })

  it('falls back to deterministic choices when both model calls fail', async () => {
    const { deps } = makeDeps() // llm returns null
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.degraded).toEqual(expect.arrayContaining(['interpret', 'rank']))
    expect(res.picks.length).toBeGreaterThanOrEqual(2)
    expect(res.reply.length).toBeGreaterThan(0)
  })

  it('falls back when the model returns garbage', async () => {
    const { deps } = makeDeps({ llm: async () => 'Sure! Here is some friendly text, no JSON.' })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.degraded).toEqual(expect.arrayContaining(['interpret', 'rank']))
  })

  it('replaces model copy that contains a link or a forbidden word', async () => {
    const { deps } = makeDeps({
      llm: llmScript(
        interpretJson({ reply: 'Try this: https://evil.example/x' }),
        (user) => {
          const a = JSON.parse(user).activities as { activityId: string; candidates: { videoId: string }[] }[]
          return JSON.stringify({
            picks: a.map((x) => ({
              activityId: x.activityId,
              videoId: x.candidates[0]!.videoId,
              reason: 'This will treat your anxiety.',
            })),
          })
        },
      ),
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.reply).not.toMatch(/https?:|evil/)
    for (const p of res.picks) expect(p.reason).not.toMatch(/treat/i)
  })
})

// ── retrieval ────────────────────────────────────────────────────────────

describe('recommend: retrieval', () => {
  it('drops videos that are too long for the time available', async () => {
    const { deps } = makeDeps({
      searchVideos: async () => [vid(1, 'Long one', 'PT45M'), vid(2, 'Fits', 'PT7M')],
    })
    const res = await recommend(deps, input) // 10 minutes
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    for (const p of res.picks) expect(p.video!.durationSec).toBeLessThanOrEqual(12 * 60)
  })

  it('asks for details only when search results lack a length, and merges them', async () => {
    const details = vi.fn(async () => [vid(1, 'Gentle video 1', 'PT5M')])
    const { deps } = makeDeps({
      searchVideos: async () => [{ id: vid(1).id, title: 'Gentle video 1', channelTitle: 'C' }],
      videoDetails: details,
    })
    const res = await recommend(deps, input)
    expect(details).toHaveBeenCalled()
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks[0]!.video!.durationSec).toBe(300)
  })

  it('offers plain ideas instead of videos whose length cannot be verified', async () => {
    const { deps } = makeDeps({
      searchVideos: async () => [{ id: vid(1).id, title: 'No length' }],
      videoDetails: async () => null,
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.length).toBeGreaterThan(0)
    for (const p of res.picks) expect(p.video).toBeNull()
  })

  it('uses the cache and skips YouTube on a hit', async () => {
    const cached = [
      { videoId: 'cachedvid01', title: 'Cached', channel: 'C', thumbnail: 't', durationSec: 300, watchUrl: 'w' },
    ]
    const search = vi.fn(async () => [])
    const { deps } = makeDeps({ cacheGet: async () => cached, searchVideos: search })
    const res = await recommend(deps, input)
    expect(search).not.toHaveBeenCalled()
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks[0]!.video!.videoId).toBe('cachedvid01')
  })

  it('falls back to plain ideas with steps when YouTube fails, and does not retry', async () => {
    const search = vi.fn(async () => null)
    const { deps } = makeDeps({ searchVideos: search })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.degraded).toContain('video')
    expect(res.picks.length).toBeGreaterThan(0)
    for (const p of res.picks) {
      expect(p.video).toBeNull()
      expect(p.reason).toBe(getActivity(p.activityId)!.blurb)
    }
    expect(search.mock.calls.length).toBe(res.picks.length) // once per video activity, never retried
  })

  it('still returns picks when only some activities fail to retrieve', async () => {
    let n = 0
    const { deps } = makeDeps({
      searchVideos: async () => (n++ === 0 ? null : [vid(1), vid(2)]),
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.degraded).toContain('video')
  })
})

describe('recommend: embeddability and YouTube outages', () => {
  it('skips videos YouTube says cannot be embedded', async () => {
    const { deps } = makeDeps({
      searchVideos: async () => [
        { ...vid(1), status: { embeddable: false } },
        { ...vid(2), status: { embeddable: true } },
      ],
    })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    for (const p of res.picks) expect(p.video!.videoId).toBe(vid(2).id)
  })

  it('asks for details when embeddability is unknown, and keeps a video that turns out fine', async () => {
    const details = vi.fn(async () => [{ ...vid(1), status: { embeddable: true } }])
    const { deps } = makeDeps({ searchVideos: async () => [vid(1)], videoDetails: details })
    const res = await recommend(deps, input)
    expect(details).toHaveBeenCalled()
    expect(res.status).toBe('ok')
  })

  it('falls back to an older cached result when YouTube fails, instead of showing no videos', async () => {
    const stale = [{ videoId: 'stalevideo1', title: 'Stale but fine', channel: 'C', thumbnail: 't', durationSec: 300, watchUrl: 'w', embeddable: true }]
    const cacheGet = vi.fn(async (_q: string, opts?: { allowStale?: boolean }) => (opts?.allowStale ? stale : null))
    const { deps } = makeDeps({ searchVideos: async () => null, cacheGet })
    const res = await recommend(deps, input)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks[0]!.video!.videoId).toBe('stalevideo1')
    expect(cacheGet).toHaveBeenCalledWith(expect.any(String), { allowStale: true })
  })

  it('does not look at stale results when YouTube works', async () => {
    const cacheGet = vi.fn(async (_q: string, _opts?: { allowStale?: boolean }) => null)
    const { deps } = makeDeps({ cacheGet })
    await recommend(deps, input)
    expect(cacheGet.mock.calls.every(([, opts]) => !opts?.allowStale)).toBe(true)
  })
})

describe('recommend: videos only where they help', () => {
  const mixed = interpretJson({ goal: null, activityIds: ['grounding-54321', 'desk-stretch', 'journaling-prompts'] })
  const mixedInput: CheckinInput = { mood: 3, energy: 4, minutes: 15 }

  it('gives plain ideas for activities where a video does not help, and a video for those where it does', async () => {
    const searched: string[] = []
    const { deps } = makeDeps({
      llm: llmScript(mixed, () => null),
      searchVideos: async (q) => {
        searched.push(q)
        return [vid(1), vid(2)]
      },
    })
    const res = await recommend(deps, mixedInput)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.map((p) => p.activityId)).toEqual(['grounding-54321', 'desk-stretch', 'journaling-prompts'])
    expect(res.picks.map((p) => p.video === null)).toEqual([true, false, true])
    expect(res.picks[0]!.reason).toBe(getActivity('grounding-54321')!.blurb)
    // Only the activity where a video helps is searched.
    expect(searched).toEqual([getActivity('desk-stretch')!.searchQuery])
  })

  it('only offers the video activities to the ranking call', async () => {
    let rankPrompt = ''
    const { deps } = makeDeps({
      llm: llmScript(mixed, (user) => {
        rankPrompt = user
        return null
      }),
    })
    await recommend(deps, mixedInput)
    const sent = (JSON.parse(rankPrompt).activities as { activityId: string }[]).map((a) => a.activityId)
    expect(sent).toEqual(['desk-stretch'])
  })

  it('stores plain ideas as suggestions without a video id', async () => {
    const { deps, calls } = makeDeps({ llm: llmScript(mixed, () => null) })
    await recommend(deps, mixedInput)
    const idea = calls.suggestions.find((r) => r.activityId === 'grounding-54321')!
    expect(idea.videoId).toBe('')
    expect(idea.title).toBe(getActivity('grounding-54321')!.title)
  })

  it('screen-free mode: no video search, no ranking call, plain ideas only', async () => {
    const search = vi.fn(async () => [vid(1)])
    const { deps, calls } = makeDeps({ llm: llmScript(interpretJson(), () => null), searchVideos: search })
    const res = await recommend(deps, { ...input, screen: 'none' })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(search).not.toHaveBeenCalled()
    expect(calls.llm).toBe(1) // interpret only
    expect(res.picks.length).toBeGreaterThan(0)
    for (const p of res.picks) {
      expect(p.video).toBeNull()
      expect(p.suggestionId).toMatch(/^sug_/)
    }
  })

  it('screen-free mode still honors time, exclusions, and the cap', async () => {
    const a = makeDeps()
    expect((await recommend(a.deps, { ...input, minutes: 1, screen: 'none' })).status).toBe('nothing_fits')
    const b = makeDeps({}, { usageToday: DAILY_CAP })
    expect((await recommend(b.deps, { ...input, screen: 'none' })).status).toBe('capped')
  })

  it('exempts the app owner from the daily cap but not other people', async () => {
    const owner = makeDeps({
      loadContext: async () => ({ prefs: { dislikedTags: [], avoid: [], likedTags: [] }, liked: [], disliked: [], usageToday: DAILY_CAP + 50, exempt: true }),
    })
    expect((await recommend(owner.deps, input)).status).toBe('ok')
    const other = makeDeps({}, { usageToday: DAILY_CAP })
    expect((await recommend(other.deps, input)).status).toBe('capped')
  })

  it('"videos are fine" only offers activities that come with a video', async () => {
    const { deps } = makeDeps({ llm: llmScript(mixed, () => null) })
    const res = await recommend(deps, { ...mixedInput, screen: 'video' })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.length).toBeGreaterThan(0)
    for (const p of res.picks) expect(getActivity(p.activityId)!.video, p.activityId).toBe(true)
  })

  it('accepts only the three screen values', () => {
    for (const v of ['auto', 'video', 'none']) expect(parseCheckinInput({ ...input, screen: v }).ok, v).toBe(true)
    expect(parseCheckinInput({ ...input, screen: 'some' }).ok).toBe(false)
  })
})

// ── filter, exclusions, cap ──────────────────────────────────────────────

describe('recommend: constraints', () => {
  it('returns nothing_fits when no activity fits', async () => {
    const { deps, calls } = makeDeps()
    const res = await recommend(deps, { ...input, minutes: 1 })
    expect(res.status).toBe('nothing_fits')
    expect(calls.search).toEqual([])
    expect(calls.llm).toBe(0)
    expect(calls.usage).toBe(0) // free runs do not count toward the daily cap
  })

  it('honors exclusions on a re-run', async () => {
    const { deps } = makeDeps()
    const res = await recommend(deps, { ...input, excludeActivityIds: ['desk-stretch', 'chair-yoga'] })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    const ids = res.picks.map((p) => p.activityId)
    expect(ids).not.toContain('desk-stretch')
    expect(ids).not.toContain('chair-yoga')
  })

  it('honors saved dislikes and avoid tags', async () => {
    const { deps } = makeDeps({
      loadContext: async () => ({
        prefs: { dislikedTags: [], avoid: ['follow-along'], likedTags: [] },
        liked: [],
        disliked: [],
        usageToday: 0,
      }),
    })
    const res = await recommend(deps, { ...input, goal: undefined })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    for (const p of res.picks) expect(getActivity(p.activityId)!.tags).not.toContain('follow-along')
  })

  it('stops at the daily cap without calling anything paid', async () => {
    const { deps, calls } = makeDeps({}, { usageToday: DAILY_CAP })
    const res = await recommend(deps, input)
    expect(res).toEqual({ status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' })
    expect(calls.llm).toBe(0)
    expect(calls.search).toEqual([])
    expect(calls.usage).toBe(0)
  })
})

// ── crisis ───────────────────────────────────────────────────────────────

describe('recommend: crisis handling', () => {
  it('returns support for a crisis phrase, makes no paid calls, and does not store the note', async () => {
    const { deps, calls } = makeDeps()
    const res = await recommend(deps, { ...input, note: "I just want to die and can't do this" })
    expect(res.status).toBe('support')
    expect(calls.llm).toBe(0)
    expect(calls.search).toEqual([])
    expect(calls.checkins[0]).not.toHaveProperty('note')
    expect(calls.suggestions).toEqual([])
    expect(calls.usage).toBe(0)
  })

  it('returns support when the model raises the flag, and does not store the note', async () => {
    const { deps, calls } = makeDeps({
      llm: llmScript(interpretJson({ needsSupportResources: true }), () => null),
    })
    const res = await recommend(deps, { ...input, note: 'everything feels pointless lately' })
    expect(res.status).toBe('support')
    expect(calls.search).toEqual([])
    expect(calls.checkins[0]).not.toHaveProperty('note')
  })

  it('stores an ordinary note', async () => {
    const { deps, calls } = makeDeps()
    await recommend(deps, { ...input, note: 'long day at work' })
    expect(calls.checkins[0]).toMatchObject({ note: 'long day at work' })
  })
})

// ── ownership ────────────────────────────────────────────────────────────

describe('recommend: check-in ownership', () => {
  it('reuses the caller\'s own check-in on a re-run', async () => {
    const { deps, calls } = makeDeps({ ownsCheckin: async (id) => id === 'mine' })
    const res = await recommend(deps, { ...input, checkinId: 'mine' })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.checkinId).toBe('mine')
    expect(calls.checkins).toEqual([])
  })

  it('ignores a check-in id the caller does not own and creates a new one', async () => {
    const { deps, calls } = makeDeps({ ownsCheckin: async () => false })
    const res = await recommend(deps, { ...input, checkinId: 'someone-elses' })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.checkinId).not.toBe('someone-elses')
    expect(calls.checkins.length).toBe(1)
  })
})
