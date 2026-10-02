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
    for (const p of res.picks.filter((x) => x.video)) expect(p.video!.videoId).toMatch(/^vid0000000[123]$/) // the plain idea has no video, by design
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
    for (const p of res.picks.filter((x) => x.video)) expect(p.video!.durationSec).toBeLessThanOrEqual(12 * 60)
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
    expect(search.mock.calls.length).toBe(res.picks.filter((p) => getActivity(p.activityId)!.video).length) // once per video activity, never retried
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
    for (const p of res.picks.filter((x) => x.video)) expect(p.video!.videoId).toBe(vid(2).id)
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
    // The default is two videos and one idea without a video, leaning on videos: the model's first video and plain
    // idea stay, and a second video joins from the rest of what fits.
    // The default is one place to visit, one video, and one other idea. The model's first idea and first video stay.
    // Shown in this order: the video, then the place to visit, then the idea.
    expect(res.picks.map((p) => p.activityId)).toEqual(['desk-stretch', 'walk-nearby', 'grounding-54321'])
    expect(res.picks.map((p) => p.video === null)).toEqual([false, true, true])
    expect(res.picks.map((p) => p.rank)).toEqual([1, 2, 3])
    expect(res.picks[1]!.reason).toBe(getActivity('walk-nearby')!.blurb)
    expect(res.picks[2]!.reason).toBe(getActivity('grounding-54321')!.blurb)
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
    expect(sent).toEqual(['desk-stretch']) // only the activity with a video goes to ranking
  })

  it('stores plain ideas as suggestions without a video id', async () => {
    const { deps, calls } = makeDeps({ llm: llmScript(mixed, () => null) })
    await recommend(deps, mixedInput)
    const idea = calls.suggestions.find((r) => r.activityId === 'walk-nearby')!
    expect(idea.videoId).toBe('')
    expect(idea.title).toBe(getActivity('walk-nearby')!.title)
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

describe('recommend: "Not sure" is a real mix, and the response says where videos came from', () => {
  const allPlain = interpretJson({ goal: null, activityIds: ['grounding-54321', 'mindful-pause', 'journaling-prompts'] })
  const open: CheckinInput = { mood: 3, energy: 4, minutes: 15 }

  it('shows at least one video and one plain idea even when the model only chose plain ones', async () => {
    const { deps } = makeDeps({ llm: llmScript(allPlain, () => null) })
    const res = await recommend(deps, open) // screen not set: the "Not sure" default
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.some((p) => p.video !== null)).toBe(true)
    expect(res.picks.some((p) => p.video === null)).toBe(true)
    // A place to visit, a video, and an idea (the model chose only plain ones, so the idea is its first choice).
    expect(res.picks.filter((p) => p.video !== null)).toHaveLength(1)
    const plain = res.picks.filter((p) => p.video === null).map((p) => p.activityId)
    expect(plain).toContain('walk-nearby')
    expect(plain).toContain('grounding-54321')
  })

  it('"Videos are fine" never shows a plain idea, and "No screen" never shows a video, from the same model answer', async () => {
    const v = await recommend(makeDeps({ llm: llmScript(allPlain, () => null) }).deps, { ...open, screen: 'video' })
    expect(v.status).toBe('ok')
    if (v.status === 'ok') for (const p of v.picks) expect(p.video, p.activityId).not.toBeNull()
    const n = await recommend(makeDeps({ llm: llmScript(allPlain, () => null) }).deps, { ...open, screen: 'none' })
    expect(n.status).toBe('ok')
    if (n.status === 'ok') for (const p of n.picks) expect(p.video, p.activityId).toBeNull()
  })

  it('passes along which sources answered, once each, and omits the field when unknown', async () => {
    const withSources = makeDeps({ sources: () => ['integration', 'google', 'integration'] })
    const res = await recommend(withSources.deps, input)
    expect(res.status === 'ok' && res.sources).toEqual(['integration', 'google'])
    const without = await recommend(makeDeps().deps, input)
    expect(without.status === 'ok' && 'sources' in without).toBe(false)
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

describe('recommend: inside or outside', () => {
  const llm = interpretJson({ goal: null, activityIds: ['grounding-54321', 'desk-stretch', 'journaling-prompts'] })
  const base: CheckinInput = { mood: 3, energy: 4, minutes: 20 }

  it('"Not sure" can put a walk in the mix when time and energy allow it, and not when they do not', async () => {
    const withTime = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, base)
    expect(withTime.status === 'ok' && withTime.picks.some((p) => p.activityId === 'walk-nearby')).toBe(true)
    const tooShort = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, minutes: 5 })
    expect(tooShort.status === 'ok' && tooShort.picks.some((p) => p.activityId === 'walk-nearby')).toBe(false)
    const tooTired = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, energy: 1 })
    expect(tooTired.status === 'ok' && tooTired.picks.some((p) => p.activityId === 'walk-nearby')).toBe(false)
  })
  it('"Stay in" never offers anything outdoors', async () => {
    const res = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'in' })
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks.length).toBeGreaterThan(0)
    for (const p of res.picks) expect(getActivity(p.activityId)!.tags, p.activityId).not.toContain('outdoors')
  })
  it('"Go outside" gives the walk as the idea (with two videos), and stays quiet about it when it cannot fit', async () => {
    const out = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'out' })
    expect(out.status === 'ok' && out.picks.filter((p) => p.video === null).map((p) => p.activityId)).toEqual(['walk-nearby'])
    const none = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'out', screen: 'none' })
    expect(none.status === 'ok' && none.picks.some((p) => p.activityId === 'walk-nearby')).toBe(true)
    const short = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'out', minutes: 5 })
    expect(short.status).toBe('ok') // ordinary picks, no error
  })
  it('"Videos are fine" never shows the walk, since it has no video', async () => {
    const res = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, screen: 'video', place: 'out' })
    expect(res.status === 'ok' && res.picks.every((p) => p.video !== null)).toBe(true)
  })
  it('accepts the new field and rejects nonsense in it', () => {
    expect(parseCheckinInput({ mood: 3, energy: 3, minutes: 20, place: 'out' }).ok).toBe(true)
    expect(parseCheckinInput({ mood: 3, energy: 3, minutes: 20, place: 'beach' }).ok).toBe(false)
  })
})

describe('recommend: the default is a place, a video, and an idea', () => {
  const llm = interpretJson({ goal: null, activityIds: ['desk-stretch', 'chair-yoga', 'grounding-54321'] })
  const base: CheckinInput = { mood: 3, energy: 4, minutes: 10 } // the form's default time

  it('with the default time and any energy of 3 or more, the three are: one place, one video, one idea', async () => {
    const res = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, base)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.picks).toHaveLength(3)
    expect(res.picks.filter((p) => p.activityId === 'walk-nearby')).toHaveLength(1)
    expect(res.picks.filter((p) => p.video !== null)).toHaveLength(1)
    expect(res.picks.filter((p) => p.video === null && p.activityId !== 'walk-nearby')).toHaveLength(1)
  })
  it('stay in is two videos and an idea, with nothing outdoors', async () => {
    const res = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'in' })
    expect(res.status === 'ok' && res.picks.filter((p) => p.video !== null)).toHaveLength(2)
    expect(res.status === 'ok' && res.picks.some((p) => p.activityId === 'walk-nearby')).toBe(false)
  })
  it('go outside is the place and two videos', async () => {
    const res = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, { ...base, place: 'out' })
    expect(res.status === 'ok' && res.picks.map((p) => p.activityId)).toContain('walk-nearby')
    expect(res.status === 'ok' && res.picks.filter((p) => p.video !== null)).toHaveLength(2)
  })
})

describe('recommend: what the person said was good or not', () => {
  it('a suggestion marked not for me is not offered again while other choices exist', async () => {
    const ctx = { prefs: { dislikedTags: [], avoid: [], likedTags: [] }, liked: [], disliked: ['desk-stretch'], usageToday: 0 }
    const { deps } = makeDeps({ loadContext: async () => ctx, llm: llmScript(interpretJson({ goal: null, activityIds: ['desk-stretch', 'chair-yoga'] }), () => null) })
    const res = await recommend(deps, { mood: 3, energy: 4, minutes: 15 })
    expect(res.status === 'ok' && res.picks.some((p) => p.activityId === 'desk-stretch')).toBe(false)
  })
})

describe('recommend: variety, order and tailoring', () => {
  const llm = interpretJson({ goal: null, activityIds: ['box-breathing', 'desk-stretch', 'grounding-54321'] })
  const input: CheckinInput = { mood: 3, energy: 4, minutes: 15 }

  it('shows videos first, then the place to visit, then ideas', async () => {
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
      const { deps } = makeDeps({ now: () => new Date(`${day}T15:00:00Z`), llm: llmScript(llm, () => null) })
      const res = await recommend(deps, input)
      expect(res.status).toBe('ok')
      if (res.status !== 'ok') return
      const order = res.picks.map((p) => (p.video ? 'video' : p.activityId === 'walk-nearby' ? 'place' : 'idea'))
      const rank = { video: 0, place: 1, idea: 2 } as const
      expect(order.map((o) => rank[o as keyof typeof rank])).toEqual([...order.map((o) => rank[o as keyof typeof rank])].sort())
    }
  })

  it('what the last check-ins showed does not come first again (unless it was liked)', async () => {
    const ctx = (recent: string[], liked: string[] = []) => ({ prefs: { dislikedTags: [], avoid: [], likedTags: [] }, liked, disliked: [], recent, usageToday: 0 })
    const a = await recommend(makeDeps({ llm: llmScript(llm, () => null) }).deps, input)
    expect(a.status === 'ok' && a.picks.some((p) => p.activityId === 'box-breathing')).toBe(true) // nothing recent: the model's choice stands
    const b = await recommend(makeDeps({ loadContext: async () => ctx(['box-breathing', 'desk-stretch']), llm: llmScript(llm, () => null) }).deps, input)
    expect(b.status === 'ok' && b.picks.some((p) => p.activityId === 'box-breathing')).toBe(false)
    const c = await recommend(makeDeps({ loadContext: async () => ctx(['box-breathing'], ['box-breathing']), llm: llmScript(llm, () => null) }).deps, input)
    expect(c.status === 'ok' && c.picks.some((p) => p.activityId === 'box-breathing')).toBe(true) // liked: still welcome
  })

  it('the idea is a different kind of thing from the video, and can be an everyday or creative one', async () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 12; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      const { deps } = makeDeps({ now: () => new Date(`${day}T15:00:00Z`), llm: llmScript(interpretJson({ goal: null, activityIds: [] }), () => null) })
      const res = await recommend(deps, { ...input, minutes: 20 })
      if (res.status !== 'ok') continue
      const video = res.picks.find((p) => p.video)
      const idea = res.picks.find((p) => !p.video && p.activityId !== 'walk-nearby')
      if (video && idea) expect(getActivity(idea.activityId)!.category).not.toBe(getActivity(video.activityId)!.category)
      if (idea) seen.add(getActivity(idea.activityId)!.category)
    }
    expect(seen.size).toBeGreaterThan(1) // not always the same sort of idea
  })

  it('the same few do not come up day after day: the first choice changes with the day when the model gives none', async () => {
    const firsts = new Set<string>()
    for (let d = 1; d <= 10; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      const { deps } = makeDeps({ now: () => new Date(`${day}T15:00:00Z`), llm: llmScript(interpretJson({ goal: null, activityIds: [] }), () => null) })
      const res = await recommend(deps, input)
      if (res.status === 'ok' && res.picks[0]) firsts.add(res.picks[0].activityId)
    }
    expect(firsts.size).toBeGreaterThan(2)
  })
})
