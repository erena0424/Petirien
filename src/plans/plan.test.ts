import { describe, expect, it } from 'vitest'
import { cleanTitle, manualPlan, minutesUntil, openerFor, plansFromCalendar, statusOf, suggestionsFor, whenText, MAX_TITLE, type Plan } from './plan'

// Local noon on a Friday, so "today" and "tomorrow" are unambiguous in any time zone.
const now = new Date(2026, 9, 2, 12, 0, 0)
const at = (dayOffset: number, h: number, m = 0) => new Date(2026, 9, 2 + dayOffset, h, m).toISOString()
const timed = (id: string, title: string, from: string, to: string, extra: object = {}) => ({ id, summary: title, start: { dateTime: from }, end: { dateTime: to }, ...extra })

describe('cleanTitle', () => {
  it('makes one tidy line, never empty, capped', () => {
    expect(cleanTitle('  Dentist \n  visit\t ')).toBe('Dentist visit')
    expect(cleanTitle('')).toBe('a plan')
    expect(cleanTitle(undefined)).toBe('a plan')
    expect(cleanTitle(42)).toBe('a plan')
    expect(cleanTitle('x'.repeat(500))).toHaveLength(MAX_TITLE)
    expect(cleanTitle('a\u0000b​c')).toBe('a b c')
  })
})

describe('plansFromCalendar', () => {
  it('keeps id, title, start and end only', () => {
    const [p] = plansFromCalendar({ items: [timed('e1', 'Team sync', at(0, 15), at(0, 16), { description: 'SECRET', location: 'SECRET', attendees: [{ email: 'secret@x.com' }], htmlLink: 'https://x' })] }, now)
    expect(p).toEqual({ id: 'e1', title: 'Team sync', start: at(0, 15), end: at(0, 16), allDay: false, manual: false })
    expect(JSON.stringify(p)).not.toContain('SECRET')
  })
  it('limits to today and tomorrow, sorted', () => {
    const plans = plansFromCalendar(
      { items: [timed('c', 'later', at(3, 9), at(3, 10)), timed('b', 'tomorrow', at(1, 9), at(1, 10)), timed('a', 'today', at(0, 14), at(0, 15)), timed('old', 'yesterday', at(-1, 9), at(-1, 10))] },
      now,
    )
    expect(plans.map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('shows at most four coming up plus the two that most recently finished today', () => {
    const items = [
      timed('d1', 'd1', at(0, 7), at(0, 8)),
      timed('d2', 'd2', at(0, 8), at(0, 9)),
      timed('d3', 'd3', at(0, 9), at(0, 10)),
      ...[13, 14, 15, 16, 17, 18].map((h) => timed(`u${h}`, `u${h}`, at(0, h), at(0, h + 1))),
    ]
    expect(plansFromCalendar({ items }, now).map((p) => p.id)).toEqual(['d2', 'd3', 'u13', 'u14', 'u15', 'u16'])
  })
  it('includes all-day events, skips cancelled and declined, and ignores bad or odd data', () => {
    const plans = plansFromCalendar(
      {
        items: [
          { id: 'ad', summary: 'Holiday', start: { date: '2026-10-02' }, end: { date: '2026-10-03' } },
          timed('x1', 'cancelled', at(0, 14), at(0, 15), { status: 'cancelled' }),
          timed('x2', 'declined', at(0, 15), at(0, 16), { attendees: [{ self: true, responseStatus: 'declined' }] }),
          { id: 'bad', summary: 'bad', start: { dateTime: 'nope' }, end: { dateTime: at(0, 15) } },
          timed('zero', 'zero', at(0, 14), at(0, 14)),
          null,
          'string',
          timed('ok', 'ok', at(0, 17), at(0, 18)),
        ],
      },
      now,
    )
    expect(plans.map((p) => p.id)).toEqual(['ad', 'ok'])
    expect(plans[0]!.allDay).toBe(true)
  })
  it('copes with empty and strange responses, and an event with no id', () => {
    for (const d of [null, undefined, {}, { items: [] }, 7, 'x']) expect(plansFromCalendar(d, now)).toEqual([])
    const [p] = plansFromCalendar({ items: [{ summary: 'No id', start: { dateTime: at(0, 14) }, end: { dateTime: at(0, 15) } }] }, now)
    expect(p!.id).toContain('No id')
  })
})

describe('statusOf', () => {
  const p = (from: string, to: string | null): Plan => ({ id: 'p', title: 't', start: from, end: to, allDay: false, manual: false })
  it('is upcoming, now or done', () => {
    expect(statusOf(p(at(0, 14), at(0, 15)), now)).toBe('upcoming')
    expect(statusOf(p(at(0, 11), at(0, 13)), now)).toBe('now')
    expect(statusOf(p(at(0, 9), at(0, 10)), now)).toBe('done')
    expect(statusOf(p(at(0, 12), at(0, 13)), now)).toBe('now') // starts exactly now
    expect(statusOf(p(at(0, 11), at(0, 12)), now)).toBe('done') // ends exactly now
    expect(statusOf(p(at(0, 11), null), now)).toBe('now') // typed by hand, no end
  })
})

describe('manualPlan', () => {
  it('needs a title and a valid time or none', () => {
    expect(manualPlan('', '', now)).toBeNull()
    expect(manualPlan('   ', '10:00', now)).toBeNull()
    expect(manualPlan('Call', '25:00', now)).toBeNull()
    expect(manualPlan('Call', '10:75', now)).toBeNull()
    expect(manualPlan('Call', 'soon', now)).toBeNull()
    expect(manualPlan('Call mom', '16:30', now)).toMatchObject({ title: 'Call mom', start: at(0, 16, 30), end: at(0, 17, 30), manual: true, allDay: false })
    expect(manualPlan('Call mom', '', now)).toMatchObject({ start: at(0, 0), end: at(1, 0), manual: true, allDay: true })
  })
  it('cleans the title', () => {
    expect(manualPlan('  a\n\nb  ', '', now)!.title).toBe('a b')
  })
})

describe('wording', () => {
  const plan = (from: string, allDay = false): Plan => ({ id: 'p', title: 'Interview', start: from, end: null, allDay, manual: false })
  it('says today, tomorrow, all day', () => {
    expect(whenText(plan(at(0, 15, 30)), now)).toMatch(/^today at 3:30/)
    expect(whenText(plan(at(1, 9)), now)).toMatch(/^tomorrow at 9:00/)
    expect(whenText(plan(at(0, 0), true), now)).toBe('all day today')
  })
  it('opens with a neutral question that assumes no feeling', () => {
    const line = openerFor(plan(at(0, 15)), now)
    expect(line).toMatch(/^You have "Interview" today at 3:00/)
    expect(line).toMatch(/How are you feeling about it\?$/)
    expect(line).not.toMatch(/nervous|excited|stress|worr|anxi|!|ready|exciting|big day|good luck|luck/i)
  })
  it('counts minutes until a timed plan and nothing for past or all-day plans', () => {
    expect(minutesUntil(plan(at(0, 13, 30)), now)).toBe(90)
    expect(minutesUntil(plan(at(0, 11)), now)).toBeNull()
    expect(minutesUntil(plan(at(0, 0), true), now)).toBeNull()
  })
})

describe('openers by tense', () => {
  const plan = (from: string, to: string | null, title = 'Worship', allDay = false): Plan => ({ id: 'p', title, start: from, end: to, allDay, manual: false })
  it('asks how it went for something that finished, and never says "have"', () => {
    const line = openerFor(plan(at(0, 9), at(0, 10)), now)
    expect(line).toBe('You had "Worship" today at 9:00 AM. How did it go?')
    expect(line).not.toMatch(/You have/)
  })
  it('asks how it is going for something on now, and how they feel about what is coming', () => {
    expect(openerFor(plan(at(0, 11), at(0, 13)), now)).toBe('"Worship" is on right now. How is it going?')
    expect(openerFor(plan(at(0, 15), at(0, 16)), now)).toMatch(/^You have "Worship" today at 3:00.*How are you feeling about it\?$/)
    expect(openerFor(plan(at(0, 0), at(1, 0), 'Holiday', true), now)).toMatch(/^You have "Holiday" all day today\. How are you feeling about it\?$/)
  })
  it('assumes nothing about the answer in any tense', () => {
    for (const p of [plan(at(0, 9), at(0, 10)), plan(at(0, 11), at(0, 13)), plan(at(0, 15), at(0, 16))]) {
      expect(openerFor(p, now)).not.toMatch(/nervous|excited|stress|worr|anxi|!|great|wonderful|hard|tough|luck/i)
    }
  })
})

describe('suggestionsFor', () => {
  const p = (id: string, title: string, from: string, to: string | null): Plan => ({ id, title, start: from, end: to, allDay: false, manual: false })
  it('suggests how something that just finished went, with the plan to talk about', () => {
    const s = suggestionsFor([p('w', 'Worship', at(0, 9), at(0, 11))], now)
    expect(s).toEqual([{ plan: expect.objectContaining({ id: 'w' }), label: 'How was Worship?' }])
  })
  it('puts what just finished first, then what is on, then what is next, and offers at most two', () => {
    const plans = [p('a', 'Church', at(0, 8), at(0, 9)), p('b', 'Lunch', at(0, 11), at(0, 13)), p('c', 'Dentist', at(0, 15), at(0, 16))]
    const s = suggestionsFor(plans, now)
    expect(s.map((x) => x.label)).toEqual(['How was Church?', 'How is Lunch going?'])
    expect(suggestionsFor(plans, now, 3).map((x) => x.label)).toEqual(['How was Church?', 'How is Lunch going?', 'How are you feeling about Dentist?'])
  })
  it('skips what finished long ago or starts more than a day away, and handles nothing', () => {
    expect(suggestionsFor([p('o', 'Old', at(0, 1), at(0, 2))], now)).toEqual([]) // ended 10 hours ago
    expect(suggestionsFor([p('f', 'Far', at(2, 9), at(2, 10))], now)).toEqual([])
    expect(suggestionsFor([], now)).toEqual([])
  })
  it('shortens a long title in the label only', () => {
    const long = 'A'.repeat(60)
    const s = suggestionsFor([p('l', long, at(0, 9), at(0, 11))], now)
    expect(s[0]!.label.length).toBeLessThan(50)
    expect(s[0]!.label).toMatch(/…\?$/)
    expect(s[0]!.plan.title).toBe(long)
  })
})

describe('typed plans read naturally', () => {
  it('with no time it is just today, in the opener and in status', () => {
    const p = manualPlan('Call mom', '', now)!
    expect(whenText(p, now)).toBe('today')
    expect(openerFor(p, now)).toBe('You have "Call mom" today. How are you feeling about it?')
    expect(statusOf(p, now)).toBe('now')
  })
  it('with a time it lasts an hour, so it is upcoming, then on now, then finished', () => {
    const p = manualPlan('Call mom', '16:30', now)!
    expect(statusOf(p, now)).toBe('upcoming')
    expect(statusOf(p, new Date(2026, 9, 2, 17, 0))).toBe('now')
    expect(statusOf(p, new Date(2026, 9, 2, 18, 0))).toBe('done')
    expect(openerFor(p, new Date(2026, 9, 2, 18, 0))).toMatch(/^You had "Call mom" today at 4:30/)
  })
})
