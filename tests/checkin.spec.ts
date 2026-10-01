/**
 * Check-in flow in a real browser, signed in as a test account.
 *
 * Boundaries that are faked (and what that means):
 *  - POST /api/actions/recommend is mocked with page.route(). This proves the UI
 *    handles each response status; it does NOT prove the server pipeline, the
 *    LLM, or YouTube (those are covered by unit tests and manual checks).
 *  - window.YT is replaced with a fake so no network call to YouTube is made.
 *    This proves our player wiring (error codes, ended event, fallbacks); it
 *    does NOT prove a real video plays or what YouTube shows after it ends.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 1, 'Needs 1 usable test account (npx deepspace test accounts create ...).')

const video = (n: number) => ({
  videoId: `vid${String(n).padStart(8, '0')}`,
  title: `Gentle video ${n}`,
  channel: 'Calm Channel',
  thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  durationSec: 360,
  watchUrl: `https://www.youtube.com/watch?v=vid${String(n).padStart(8, '0')}`,
})

const okResponse = (checkinId = 'chk_1') => ({
  status: 'ok',
  checkinId,
  reply: 'That sounds like a heavy day. Here are a few quiet things that fit.',
  degraded: [],
  picks: [1, 2].map((n) => ({
    suggestionId: `sug_${n}`,
    activityId: n === 1 ? 'box-breathing' : 'body-scan',
    activityTitle: n === 1 ? 'Box breathing' : 'Body scan',
    video: video(n),
    reason: `Reason ${n}: a steady one that fits your time.`,
    rank: n,
  })),
})

async function mockRecommend(page: Page, respond: (n: number, body: Record<string, unknown>) => unknown) {
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/actions/recommend', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    bodies.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: respond(bodies.length, body) }),
    })
  })
  return bodies
}

async function fakeYouTube(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.__yt = { last: null }
    w.YT = {
      Player: class {
        constructor(el: HTMLElement, opts: unknown) {
          ;(w.__yt as { last: unknown }).last = opts
          el.setAttribute('data-testid', 'fake-player')
          el.textContent = `fake player ${(opts as { videoId: string }).videoId}`
        }
        destroy() {}
      },
    }
  })
}

const fire = (page: Page, kind: 'error' | 'state', data: number) =>
  page.evaluate(
    ([k, d]) => {
      const ev = (window as unknown as { __yt: { last: { events: Record<string, (e: { data: number }) => void> } } }).__yt.last.events
      ;(k === 'error' ? ev.onError : ev.onStateChange)!({ data: d as number })
    },
    [kind, data] as const,
  )

async function fillAndSubmit(page: Page) {
  await page.getByText('Low', { exact: true }).first().click() // mood
  await page.getByText('Medium', { exact: true }).click() // energy
  await page.getByRole('button', { name: 'Show me a few ideas' }).click()
}

test.beforeEach(async ({ users }, testInfo) => {
  testInfo.annotations.push({ type: 'note', description: 'uses a mocked recommend action' })
  void users
})

test('form needs mood and energy, shows the privacy note, then returns ideas', async ({ users }) => {
  const [a] = await users(1)
  const bodies = await mockRecommend(a.page, () => okResponse())
  await a.page.goto('/checkin')

  const submit = a.page.getByRole('button', { name: 'Show me a few ideas' })
  await expect(submit).toBeDisabled()
  await expect(a.page.getByTestId('note-privacy')).toContainText('sent to an AI service')

  await a.page.getByLabel('Anything you want to add?').fill('long day at work')
  await a.page.getByText('Calm down', { exact: true }).click()
  await fillAndSubmit(a.page)

  await expect(a.page.getByTestId('ok-result')).toBeVisible()
  await expect(a.page.getByTestId('pick-card')).toHaveCount(2)
  await expect(a.page.getByText('Reason 1')).toBeVisible()
  expect(bodies[0]).toMatchObject({ mood: 2, energy: 3, minutes: 10, goal: 'calm', note: 'long day at work' })
})

test('watch, finish, give feedback', async ({ users }) => {
  const [a] = await users(1)
  await fakeYouTube(a.page)
  await mockRecommend(a.page, () => okResponse())
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  await a.page.getByRole('button', { name: /Watch: Gentle video 1/ }).click()
  await expect(a.page.getByTestId('fake-player')).toBeVisible()
  await expect(a.page.getByText("may suggest other videos")).toBeVisible()

  await fire(a.page, 'state', 0) // ENDED: player is removed, our feedback card appears
  await expect(a.page.getByTestId('fake-player')).toHaveCount(0)
  await expect(a.page.getByTestId('feedback-card')).toBeVisible()
  await expect(a.page.getByText('Was this useful?')).toBeVisible()
  await expect(a.page.getByText(/feel better/i)).toHaveCount(0)

  await a.page.getByRole('button', { name: 'Yes, useful' }).click()
  await expect(a.page.getByTestId('thanks-card')).toBeVisible()
  await a.page.getByRole('button', { name: 'Back to ideas' }).click()
  await expect(a.page.getByTestId('pick-card')).toHaveCount(2)
})

test('embedding blocked and removed videos fall back inline', async ({ users }) => {
  const [a] = await users(1)
  await fakeYouTube(a.page)
  await mockRecommend(a.page, () => okResponse())
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  await a.page.getByRole('button', { name: /Watch: Gentle video 1/ }).click()
  await fire(a.page, 'error', 101)
  await expect(a.page.getByTestId('player-error')).toContainText("doesn't allow this video")
  const link = a.page.getByRole('link', { name: 'Open on YouTube' })
  await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=vid00000001')
  await expect(link).toHaveAttribute('rel', /noopener/)

  await a.page.getByRole('button', { name: 'Pick another idea' }).click()
  await a.page.getByRole('button', { name: /Watch: Gentle video 2/ }).click()
  await fire(a.page, 'error', 100)
  await expect(a.page.getByTestId('player-error')).toContainText('no longer available')
  await expect(a.page.getByRole('link', { name: 'Open on YouTube' })).toHaveCount(0)
})

test('"none fit" retries with exclusions and the same check-in, then stops after two', async ({ users }) => {
  const [a] = await users(1)
  const bodies = await mockRecommend(a.page, () => okResponse('chk_7'))
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  await a.page.getByRole('button', { name: 'Too long' }).click()
  await expect(a.page.getByTestId('ok-result')).toBeVisible()
  expect(bodies[1]).toMatchObject({ checkinId: 'chk_7' })
  expect(bodies[1]!.excludeActivityIds).toEqual(expect.arrayContaining(['box-breathing', 'body-scan']))

  await a.page.getByRole('button', { name: 'Not my thing' }).click()
  await expect(a.page.getByTestId('none-fit-done')).toBeVisible()
  await expect(a.page.getByText('resting counts too')).toBeVisible()
  expect(bodies.length).toBe(3)
})

test('crisis response shows support resources and no ideas', async ({ users }) => {
  const [a] = await users(1)
  await mockRecommend(a.page, () => ({ status: 'support', checkinId: 'chk_1' }))
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  const card = a.page.getByTestId('support-card')
  await expect(card).toBeVisible()
  await expect(card.getByRole('link', { name: 'Call 988' })).toHaveAttribute('href', 'tel:988')
  await expect(card.getByRole('link', { name: 'Text 988' })).toHaveAttribute('href', 'sms:988')
  await expect(card.getByText('Text HOME to 741741')).toBeVisible()
  await expect(card.getByRole('link', { name: 'findahelpline.com' })).toBeVisible()
  await expect(a.page.getByTestId('pick-card')).toHaveCount(0)
})

test('support is reachable from the footer on any screen', async ({ users }) => {
  const [a] = await users(1)
  await a.page.goto('/home')
  await a.page.getByTestId('footer-support').click()
  await expect(a.page.getByTestId('support-card')).toBeVisible()
  await expect(a.page.getByRole('link', { name: 'Call 988' })).toBeVisible()
  await a.page.keyboard.press('Escape')
  await expect(a.page.getByTestId('support-card')).toHaveCount(0)
  await expect(a.page.getByText('not therapy or medical advice', { exact: false })).toBeVisible()
})

test('other statuses render calmly and recover locally', async ({ users }) => {
  const [a] = await users(1)
  const statuses = [
    { status: 'no_video', checkinId: 'c', reply: 'Here are a few options.', activities: [{ activityId: 'box-breathing', title: 'Box breathing', blurb: 'A steady rhythm.' }] },
    { status: 'error', message: 'Something went wrong on our side.' },
    { status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' },
    { status: 'nothing_fits', checkinId: 'c', reply: 'Nothing fits right now.' },
    okResponse(),
  ]
  const bodies = await mockRecommend(a.page, (n) => statuses[Math.min(n - 1, statuses.length - 1)])
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  await expect(a.page.getByTestId('no-video-result')).toContainText("Videos aren't loading right now")
  await a.page.getByRole('button', { name: 'Try again' }).click() // 2: error
  await expect(a.page.getByTestId('error-result')).toContainText('Something went wrong')
  await a.page.getByRole('button', { name: 'Try again' }).click() // 3: capped
  await expect(a.page.getByTestId('capped-result')).toContainText("today's limit")
  await a.page.getByRole('button', { name: 'Back' }).click()
  await expect(a.page.getByRole('button', { name: 'Show me a few ideas' })).toBeVisible() // form again, values kept
  await a.page.getByRole('button', { name: 'Show me a few ideas' }).click() // 4: nothing fits
  await expect(a.page.getByTestId('nothing-fits-result')).toBeVisible()
  await a.page.getByRole('button', { name: 'Change time or energy' }).click()
  await a.page.getByRole('button', { name: 'Show me a few ideas' }).click() // 5: ok
  await expect(a.page.getByTestId('ok-result')).toBeVisible()
  expect(bodies.length).toBe(5)
})

test('each idea expands into hand-written instructions, also while watching and without videos', async ({ users }) => {
  const [a] = await users(1)
  await fakeYouTube(a.page)
  await mockRecommend(a.page, (n) =>
    n === 1
      ? okResponse()
      : { status: 'no_video', checkinId: 'c', reply: 'Here are a few options.', activities: [{ activityId: 'gratitude-note', title: 'Write a thank-you note', blurb: 'Write a few lines.' }] },
  )
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)

  // Collapsed by default, expands on click, collapses again.
  const card = a.page.getByTestId('pick-card').first()
  const toggle = card.getByRole('button', { name: 'How to do it' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(card.getByText('Breathe in slowly through your nose')).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(card.getByText("You'll need:")).toBeVisible()
  await expect(card.getByText('Breathe in slowly through your nose')).toBeVisible()
  await toggle.click()
  await expect(card.getByText('Breathe in slowly through your nose')).toBeHidden()

  // Also available while watching.
  await a.page.getByRole('button', { name: /Watch: Gentle video 1/ }).click()
  await expect(a.page.getByTestId('fake-player')).toBeVisible()
  await a.page.getByRole('button', { name: 'How to do it' }).click()
  await expect(a.page.getByText('Breathe in slowly through your nose')).toBeVisible()
  await a.page.getByRole('button', { name: /Other ideas/ }).click()

  // With no videos, the instructions are the content and start open.
  await a.page.getByRole('button', { name: 'Too long' }).click()
  await expect(a.page.getByTestId('no-video-result')).toBeVisible()
  await expect(a.page.getByText('Write what they did and how it helped')).toBeVisible()
})

test('"No screen" asks for ideas only; plain ideas have steps, feedback, and no Watch button', async ({ users }) => {
  const [a] = await users(1)
  const idea = (n: number, id: string, title: string) => ({
    suggestionId: `sug_${n}`, activityId: id, activityTitle: title, video: null,
    reason: 'A short written exercise.', rank: n,
  })
  const bodies = await mockRecommend(a.page, () => ({
    status: 'ok', checkinId: 'c', reply: 'Two things, no screen needed.', degraded: [],
    picks: [idea(1, 'grounding-54321', '5-4-3-2-1 grounding'), idea(2, 'journaling-prompts', 'Journaling prompts')],
  }))
  await a.page.goto('/checkin')
  await expect(a.page.getByLabel('Videos where they help')).toBeChecked() // default
  await a.page.getByText('No screen, just ideas', { exact: true }).click()
  await fillAndSubmit(a.page)

  expect(bodies[0]).toMatchObject({ screen: 'none' })
  await expect(a.page.getByTestId('idea-card')).toHaveCount(2)
  await expect(a.page.getByRole('button', { name: /^Watch/ })).toHaveCount(0)
  await expect(a.page.getByText('Name five things you can see')).toBeVisible() // steps open by default
  await a.page.getByRole('button', { name: /Yes, useful: 5-4-3-2-1 grounding/ }).click()
  await expect(a.page.getByTestId('idea-thanks')).toBeVisible()
})

test('the default asks for videos where they help and does not send a screen value', async ({ users }) => {
  const [a] = await users(1)
  const bodies = await mockRecommend(a.page, () => okResponse())
  await a.page.goto('/checkin')
  await fillAndSubmit(a.page)
  await expect(a.page.getByTestId('ok-result')).toBeVisible()
  expect(bodies[0]).not.toHaveProperty('screen')
})


test('phone width: no horizontal scroll on form, results, and support', async ({ users }) => {
  const [a] = await users(1)
  await a.page.setViewportSize({ width: 375, height: 700 })
  await mockRecommend(a.page, () => okResponse())
  const overflow = () => a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  await a.page.goto('/checkin')
  expect(await overflow()).toBeLessThanOrEqual(0)
  await fillAndSubmit(a.page)
  await expect(a.page.getByTestId('ok-result')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await a.page.getByTestId('footer-support').click()
  await expect(a.page.getByTestId('support-card')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
