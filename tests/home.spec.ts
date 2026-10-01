/**
 * Home against the REAL local server and database (no paid calls): the
 * calendar fills in after a check-in, the streak message is gentle, the
 * time-of-day suggestion is there, and saved items show up.
 *
 * Uses its own account (Dana) so parallel specs cannot clear its data.
 *
 * Does NOT prove: multi-day streaks in a browser (check-ins can only be created
 * "now"; streak and calendar logic across days is unit-tested), or time-of-day
 * wording at other hours (unit-tested).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { CATALOG } from '../src/catalog'

test.skip(loadAllTestAccounts().length < 4, 'Needs 4 usable test accounts (Alice, Bob, Cara, Dana).')
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

async function clearDana(page: Page) {
  await page.goto('/preferences')
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await page.waitForTimeout(1500)
  const btn = page.getByRole('button', { name: 'Delete everything' })
  if (await btn.isEnabled()) {
    await btn.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click()
    await expect(page.getByTestId('delete-done')).toBeVisible({ timeout: 20_000 })
  }
}

test('a new account sees a welcoming, non-empty Home with no streak talk', async ({ users }) => {
  const [dana] = await users(['Dana'])
  await clearDana(dana.page)
  await dana.page.goto('/home')
  await expect(dana.page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)|night owl/)
  await expect(dana.page.getByTestId('calendar')).toBeVisible()
  await expect(dana.page.getByTestId('for-now')).toBeVisible() // a suggestion even with no history
  await expect(dana.page.getByTestId('home-saved-empty')).toBeVisible()
  await expect(dana.page.getByTestId('cheer')).toHaveCount(0) // nothing to celebrate yet, so nothing said
  await expect(dana.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(0)
})

test('checking in fills today on the calendar and shows a gentle message', async ({ users }) => {
  const [dana] = await users(['Dana'])
  // A real check-in that stops at "nothing fits" (no paid call).
  const everything = CATALOG.map((a) => a.id)
  await dana.page.route('**/api/actions/recommend', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    await route.continue({ postData: JSON.stringify({ ...body, excludeActivityIds: everything }) })
  })
  await dana.page.goto('/checkin')
  await dana.page.getByText('Low', { exact: true }).first().click()
  await dana.page.getByText('Medium', { exact: true }).click()
  await dana.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(dana.page.getByTestId('nothing-fits-result')).toBeVisible({ timeout: 45_000 })

  await dana.page.goto('/home')
  const done = dana.page.getByTestId('calendar').locator('[data-done]')
  await expect(done).toHaveCount(1, { timeout: 15_000 })
  await expect(done.first()).toHaveAttribute('aria-label', /today/)
  await expect(dana.page.getByTestId('cheer')).toContainText(/showed up|checked in|That counts/)
  await expect(dana.page.getByTestId('cheer')).not.toContainText(/miss|lost|behind/i)
  await expect(dana.page.getByTestId('last-checkin')).toContainText('feeling low')

  // Two check-ins on one day still make one filled day.
  await dana.page.goto('/checkin')
  await dana.page.getByText('Good', { exact: true }).first().click()
  await dana.page.getByText('Lots', { exact: true }).click()
  await dana.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(dana.page.getByTestId('nothing-fits-result')).toBeVisible({ timeout: 45_000 })
  await dana.page.goto('/home')
  await expect(dana.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(1)
})

test('the calendar moves between months and cannot go into the future', async ({ users }) => {
  const [dana] = await users(['Dana'])
  await dana.page.goto('/home')
  const title = dana.page.getByTestId('calendar').getByRole('heading')
  const now = await title.innerText()
  await expect(dana.page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await dana.page.getByRole('button', { name: 'Previous month' }).click()
  await expect(title).not.toHaveText(now)
  await expect(dana.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(0) // no check-ins last month
  await dana.page.getByRole('button', { name: 'Next month' }).click()
  await expect(title).toHaveText(now)
})

test('the suggestion for right now can be saved, and saved items appear on Home', async ({ users }) => {
  const [dana] = await users(['Dana'])
  await dana.page.goto('/home')
  const nowCard = dana.page.getByTestId('for-now')
  await expect(nowCard.getByRole('button', { name: 'How to do it' })).toBeVisible()
  // Save is disabled until the connection can accept the write, so a fast tap is never silently lost.
  const save = nowCard.getByRole('button', { name: /^Save: / })
  await expect(save).toBeEnabled({ timeout: 15_000 })
  await save.click()
  await expect(nowCard.getByRole('button', { name: /Remove from saved/ })).toHaveAttribute('aria-pressed', 'true')

  await dana.page.reload()
  await expect(dana.page.getByTestId('home-saved')).toBeVisible({ timeout: 15_000 })
  await expect(dana.page.getByTestId('home-saved').getByRole('listitem')).toHaveCount(1)
  await expect(dana.page.getByTestId('home-saved')).toContainText('Idea')

  // Nobody else sees it.
  const [alice] = await users(['Alice'])
  await alice.page.goto('/home')
  await alice.page.waitForTimeout(1500)
  await expect(alice.page.getByTestId('home-saved').getByText('Idea')).toHaveCount(0)

  await clearDana(dana.page)
})

test('phone width: Home has no horizontal scroll', async ({ users }) => {
  const [dana] = await users(['Dana'])
  await dana.page.setViewportSize({ width: 375, height: 800 })
  await dana.page.goto('/home')
  await expect(dana.page.getByTestId('calendar')).toBeVisible()
  expect(await dana.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
