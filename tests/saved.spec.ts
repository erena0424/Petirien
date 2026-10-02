/**
 * Saved library against the REAL local server and database.
 *
 * Mocked: only the recommend action (to get known ideas on screen) and
 * window.YT (no YouTube traffic). Everything about saving, notes, removing,
 * ownership and persistence is real.
 *
 * Does NOT prove: real videos play, the 25/30-day refresh against real YouTube
 * (unit-tested with fakes), or the withheld-details display in a browser (unit-tested).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts.')
test.describe.configure({ mode: 'serial' })
test.setTimeout(90_000)

const run = String(Date.now() % 1e7).padStart(7, '0')
const vid = (n: number) => `sv${run}${n}`.slice(0, 11).padEnd(11, 'x') // 11 chars
const title = (n: number) => `Saved test ${run} video ${n}`

const pick = (n: number, activityId: string, activityTitle: string) => ({
  suggestionId: `none_${n}`,
  activityId,
  activityTitle,
  video: {
    videoId: vid(n),
    title: title(n),
    channel: 'Test Channel',
    thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    durationSec: 300,
    watchUrl: `https://www.youtube.com/watch?v=${vid(n)}`,
  },
  reason: `Reason ${n}`,
  rank: n,
})

const response = {
  status: 'ok',
  checkinId: 'c',
  reply: 'Here are two ideas.',
  degraded: [],
  picks: [pick(1, 'box-breathing', 'Box breathing'), pick(2, 'chair-yoga', 'Chair yoga')],
}

async function showIdeas(page: Page) {
  await page.route('**/api/actions/recommend', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) }),
  )
  await page.goto('/checkin')
  await page.getByText('Low', { exact: true }).first().click()
  await page.getByText('Medium', { exact: true }).click()
  await page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(page.getByTestId('ok-result')).toBeVisible()
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
          el.textContent = 'fake player'
        }
        destroy() {}
      },
    }
  })
}
const fireError = (page: Page, code: number) =>
  page.evaluate((c) => (window as unknown as { __yt: { last: { events: { onError: (e: { data: number }) => void } } } }).__yt.last.events.onError({ data: c }), code)

/** Alice is a throwaway test account: start every test from an empty library. */
async function clearAllSaved(page: Page) {
  await page.goto('/saved')
  await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
  await page.waitForTimeout(1200) // let the list arrive
  for (let i = 0; i < 20; i++) {
    const items = page.locator('[data-testid="saved-item"], [data-testid="saved-idea"]')
    if ((await items.count()) === 0) return
    await items.first().getByRole('button', { name: /Remove from saved/ }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.waitForTimeout(400)
  }
}

async function removeIfPresent(page: Page, n: number) {
  await page.goto('/saved')
  const item = page.getByTestId('saved-item').filter({ hasText: title(n) })
  if (await item.count()) {
    await item.getByRole('button', { name: /Remove from saved/ }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(item).toHaveCount(0)
  }
}

test('save from an idea, it persists, is private, and Save is a toggle', async ({ users }) => {
  const [alice, bob] = await users(2)
  await tuck(alice.page)
  await tuck(bob.page)
  await clearAllSaved(alice.page)
  await showIdeas(alice.page)

  const card = alice.page.getByTestId('pick-card').filter({ hasText: title(1) })
  const save = card.getByRole('button', { name: new RegExp(`Save: ${title(1)}`) })
  await save.click()
  await expect(card.getByRole('button', { name: /Remove from saved/ })).toHaveAttribute('aria-pressed', 'true')

  // Persisted: a fresh page load still shows it, on the Saved screen (no check-in needed).
  await alice.page.goto('/saved')
  const item = alice.page.getByTestId('saved-item').filter({ hasText: title(1) })
  await expect(item).toHaveCount(1, { timeout: 15_000 })
  await expect(item).toContainText('Box breathing')
  await expect(item).toContainText('5 min')

  // Private: Bob cannot see Alice's saved video.
  await bob.page.goto('/saved')
  await expect(bob.page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
  await bob.page.waitForTimeout(1500)
  await expect(bob.page.getByText(title(1))).toHaveCount(0)

  // Toggle off from the idea card.
  await showIdeas(alice.page)
  await alice.page.getByTestId('pick-card').filter({ hasText: title(1) }).getByRole('button', { name: /Remove from saved/ }).click()
  await alice.page.goto('/saved')
  await expect(alice.page.getByText(title(1))).toHaveCount(0, { timeout: 15_000 })
})

test('saving twice quickly keeps one row; notes persist; filter and remove work', async ({ users }) => {
  const [alice] = await users(1)
  await tuck(alice.page)
  await clearAllSaved(alice.page)
  await showIdeas(alice.page)

  // Double tap on the first idea, plain save on the second.
  const first = alice.page.getByTestId('pick-card').filter({ hasText: title(1) }).getByRole('button', { name: /Save: / })
  await first.dblclick()
  await alice.page.getByTestId('pick-card').filter({ hasText: title(2) }).getByRole('button', { name: /Save: / }).click()
  await expect(alice.page.getByRole('button', { name: /Remove from saved: Saved test/ })).toHaveCount(2)

  await alice.page.goto('/saved')
  await expect(alice.page.getByTestId('saved-item').filter({ hasText: title(1) })).toHaveCount(1, { timeout: 15_000 })
  await expect(alice.page.getByTestId('saved-item').filter({ hasText: title(2) })).toHaveCount(1)

  // Filter by category (box breathing = Meditation, chair yoga = Movement).
  await alice.page.getByText('Movement', { exact: true }).click()
  await expect(alice.page.getByText(title(2))).toBeVisible()
  await expect(alice.page.getByText(title(1))).toHaveCount(0)
  await alice.page.getByText('All', { exact: true }).click()
  await expect(alice.page.getByText(title(1))).toBeVisible()

  // Note: saved on blur and still there after a reload.
  const item = alice.page.getByTestId('saved-item').filter({ hasText: title(1) })
  await item.getByLabel('Your note').fill(`why I saved it ${run}`)
  await item.getByLabel('Your note').blur()
  await alice.page.waitForTimeout(800)
  await alice.page.reload()
  await expect(alice.page.getByTestId('saved-item').filter({ hasText: title(1) }).getByLabel('Your note')).toHaveValue(`why I saved it ${run}`, { timeout: 15_000 })

  // Instructions are available in the library too.
  const mine = alice.page.getByTestId('saved-item').filter({ hasText: title(1) })
  await mine.getByRole('button', { name: 'How to do it' }).click()
  await expect(mine.getByText('Breathe in slowly through your nose')).toBeVisible()

  await removeIfPresent(alice.page, 1)
  await removeIfPresent(alice.page, 2)
})

test('a video that cannot play is marked, and the mark persists', async ({ users }) => {
  const [alice] = await users(1)
  await tuck(alice.page)
  await clearAllSaved(alice.page)
  await fakeYouTube(alice.page)
  await showIdeas(alice.page)
  await alice.page.getByTestId('pick-card').filter({ hasText: title(1) }).getByRole('button', { name: /Save: / }).click()
  await alice.page.getByTestId('pick-card').filter({ hasText: title(2) }).getByRole('button', { name: /Save: / }).click()
  await expect(alice.page.getByRole('button', { name: /Remove from saved: Saved test/ })).toHaveCount(2)

  await alice.page.goto('/saved')
  const one = alice.page.getByTestId('saved-item').filter({ hasText: title(1) })
  await one.getByRole('button', { name: /^Watch:/ }).click()
  await expect(alice.page.getByTestId('fake-player')).toBeVisible()
  await fireError(alice.page, 100) // removed from YouTube
  // Once marked gone, the card stops showing the old YouTube title on purpose.
  await expect(alice.page.getByTestId('badge-gone')).toHaveCount(1)
  await expect(alice.page.getByText('No longer available')).toBeVisible()
  await expect(alice.page.getByRole('button', { name: /^Watch: No longer available/ })).toHaveCount(0)

  const two = alice.page.getByTestId('saved-item').filter({ hasText: title(2) })
  await two.getByRole('button', { name: /^Watch:/ }).click()
  await fireError(alice.page, 101) // embedding disabled
  await expect(two.getByTestId('badge-no-embed')).toBeVisible()
  await expect(two.getByRole('link', { name: 'Open on YouTube' })).toBeVisible()

  // Persisted: still marked after a reload.
  await alice.page.reload()
  await expect(alice.page.getByTestId('saved-item').filter({ hasText: /No longer available/ }).getByTestId('badge-gone')).toHaveCount(1, { timeout: 15_000 })
  await expect(alice.page.getByTestId('badge-no-embed')).toHaveCount(1)

  // Clean up: the first row's title is cleared once it is gone, so remove by position of its badge.
  await alice.page.getByTestId('saved-item').filter({ has: alice.page.getByTestId('badge-gone') }).getByRole('button', { name: /Remove from saved/ }).click()
  await alice.page.getByRole('button', { name: 'Remove', exact: true }).click()
  await removeIfPresent(alice.page, 2)
})

test('the library is reachable directly and shows a friendly empty state', async ({ users }) => {
  const [alice] = await users(1)
  await tuck(alice.page)
  await clearAllSaved(alice.page)
  await alice.page.goto('/home')
  await alice.page.getByTestId('app-navigation').getByRole('link', { name: 'Saved', exact: true }).click()
  await expect(alice.page).toHaveURL(/\/saved/)
  await expect(alice.page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
  await expect(alice.page.getByRole('alert')).toHaveCount(0)
  await expect(alice.page.getByTestId('saved-empty')).toBeVisible()
})

const ideaResponse = {
  status: 'ok',
  checkinId: 'c',
  reply: 'Two ideas.',
  degraded: [],
  picks: [
    { suggestionId: 'none_i1', activityId: 'grounding-54321', activityTitle: '5-4-3-2-1 grounding', video: null, reason: 'Name things you can see, feel, and hear around you to come back to the room.', rank: 1 },
    pick(1, 'chair-yoga', 'Chair yoga'),
  ],
}

test('a plain idea (no video) can be saved, persists with its note, is private, and can be removed', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  await tuck(alice.page)
  await tuck(bob.page)
  await clearAllSaved(alice.page)
  await alice.page.route('**/api/actions/recommend', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: ideaResponse }) }),
  )
  await alice.page.goto('/checkin')
  await alice.page.getByText('Low', { exact: true }).first().click()
  await alice.page.getByText('Medium', { exact: true }).click()
  await alice.page.getByRole('button', { name: 'Show me a few ideas' }).click()

  // The plain idea has steps open and no Watch button; the video idea beside it still has one.
  const idea = alice.page.getByTestId('idea-card')
  await expect(idea).toHaveCount(1)
  await expect(idea.getByText('Name five things you can see')).toBeVisible()
  await expect(idea.getByRole('button', { name: /^Watch/ })).toHaveCount(0)
  await expect(alice.page.getByTestId('pick-card')).toHaveCount(1)

  const save = idea.getByRole('button', { name: /^Save: 5-4-3-2-1 grounding/ })
  await save.click()
  await expect(idea.getByRole('button', { name: /Remove from saved: 5-4-3-2-1 grounding/ })).toHaveAttribute('aria-pressed', 'true')

  // On the Saved page, after a reload, with a note that sticks.
  await alice.page.goto('/saved')
  const saved = alice.page.getByTestId('saved-idea').filter({ hasText: '5-4-3-2-1 grounding' })
  await expect(saved).toHaveCount(1, { timeout: 15_000 })
  await saved.getByLabel('Your note').fill(`ideas note ${run}`)
  await saved.getByLabel('Your note').blur()
  await alice.page.waitForTimeout(800)
  await alice.page.reload()
  await expect(alice.page.getByTestId('saved-idea').filter({ hasText: '5-4-3-2-1 grounding' }).getByLabel('Your note')).toHaveValue(`ideas note ${run}`, { timeout: 15_000 })

  // Private.
  await bob.page.goto('/saved')
  await expect(bob.page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
  await bob.page.waitForTimeout(1500)
  await expect(bob.page.getByText('5-4-3-2-1 grounding')).toHaveCount(0)

  await clearAllSaved(alice.page)
  await expect(alice.page.getByTestId('saved-empty')).toBeVisible({ timeout: 15_000 })
})
