/**
 * Preferences against the REAL local server and database. No paid calls: the
 * one check-in is rewritten in flight so the real action stops at "nothing fits".
 *
 * Does NOT prove: that saved preferences change real recommendations end to end
 * (unit-tested on the filter and ranking; the live path needs paid calls).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'
import { CATALOG } from '../src/catalog'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts.')
test.describe.configure({ mode: 'serial' })
test.setTimeout(90_000)

async function deleteEverything(page: Page) {
  await page.goto('/preferences')
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await page.waitForTimeout(1200)
  const btn = page.getByRole('button', { name: 'Delete everything' })
  if (await btn.isEnabled()) {
    await btn.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click()
    await expect(page.getByTestId('delete-done')).toBeVisible({ timeout: 20_000 })
  }
}

test('preferences save, persist, shape the check-in, and stay private', async ({ users }) => {
  const [bob, alice] = await users(['Bob', 'Alice'])
  await deleteEverything(bob.page)

  await bob.page.goto('/preferences')
  await expect(bob.page.getByLabel('Someone talking me through it')).not.toBeChecked()
  await bob.page.getByText('Someone talking me through it', { exact: true }).click()
  await bob.page.getByText('Quiet, with no talking', { exact: true }).click()
  await bob.page.getByText('15 min', { exact: true }).click()
  await bob.page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(bob.page.getByTestId('prefs-saved')).toBeVisible()

  // Persisted across a reload.
  await bob.page.reload()
  await expect(bob.page.getByLabel('Someone talking me through it')).toBeChecked({ timeout: 15_000 })
  await expect(bob.page.getByLabel('Quiet, with no talking')).toBeChecked()
  await expect(bob.page.getByLabel('15 min')).toBeChecked()

  // The check-in starts from the usual time.
  await bob.page.goto('/checkin')
  await expect(bob.page.getByLabel('15 min')).toBeChecked({ timeout: 15_000 })

  // Private: Alice has her own, untouched preferences.
  await alice.page.goto('/preferences')
  await expect(alice.page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await alice.page.waitForTimeout(1200)
  await expect(alice.page.getByLabel('Someone talking me through it')).not.toBeChecked()
  await expect(alice.page.getByLabel('15 min')).not.toBeChecked()

  await deleteEverything(bob.page)
})

test('a tag cannot be both avoided and liked, and avoiding too much warns', async ({ users }) => {
  const [bob] = await users(['Bob'])
  await deleteEverything(bob.page)
  await bob.page.goto('/preferences')
  await expect(bob.page.getByRole('heading', { name: 'Preferences' })).toBeVisible()

  await bob.page.getByText('Calm music', { exact: true }).click() // like music
  await bob.page.getByText('Background music', { exact: true }).click() // then avoid music
  await expect(bob.page.getByLabel('Background music')).toBeChecked()
  await expect(bob.page.getByLabel('Calm music')).toBeDisabled()
  await expect(bob.page.getByLabel('Calm music')).not.toBeChecked() // avoiding wins

  await expect(bob.page.getByTestId('avoid-warning')).toHaveCount(0)
  for (const label of ['Someone talking me through it', 'Needing supplies (paper, paint, pens)', 'Closing my eyes', 'Copying someone’s movements']) {
    await bob.page.getByText(label, { exact: true }).click()
  }
  await expect(bob.page.getByTestId('avoid-warning')).toBeVisible()
})

test('delete everything removes check-ins, saved videos, and preferences', async ({ users }) => {
  const [bob] = await users(['Bob'])
  await deleteEverything(bob.page)

  // One real check-in (free: stops at "nothing fits") and one preference.
  const everything = CATALOG.map((a) => a.id)
  await bob.page.route('**/api/actions/recommend', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    await route.continue({ postData: JSON.stringify({ ...body, excludeActivityIds: everything }) })
  })
  await bob.page.goto('/checkin')
  await bob.page.getByText('Low', { exact: true }).first().click()
  await bob.page.getByText('Medium', { exact: true }).click()
  await bob.page.getByLabel('Anything you want to add?').fill('to be deleted')
  await bob.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(bob.page.getByTestId('nothing-fits-result')).toBeVisible({ timeout: 45_000 })

  await bob.page.goto('/preferences')
  await bob.page.getByText('Closing my eyes', { exact: true }).click()
  await bob.page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(bob.page.getByTestId('prefs-saved')).toBeVisible()

  await bob.page.goto('/history')
  await expect(bob.page.getByTestId('history-item').filter({ hasText: 'to be deleted' })).toHaveCount(1, { timeout: 15_000 })

  await deleteEverything(bob.page)

  await bob.page.goto('/history')
  await expect(bob.page.getByTestId('history-empty')).toBeVisible({ timeout: 15_000 })
  await bob.page.goto('/preferences')
  await expect(bob.page.getByLabel('Closing my eyes')).not.toBeChecked({ timeout: 15_000 })
})
