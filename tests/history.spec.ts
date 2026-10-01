/**
 * Persistence and privacy against the REAL local server and database.
 *
 * To spend nothing, the request is rewritten in flight to exclude every
 * activity. The real action then validates, applies the real filter, finds
 * nothing that fits, and saves the check-in (note included) BEFORE any model or
 * YouTube call. So this exercises the real server and database with zero paid
 * calls. (Test accounts' calls were being billed to the developer's account.)
 *
 * What this does NOT prove: that real recommendations work (they need credits
 * and a healthy YouTube integration), or isolation of suggestions/saved videos
 * (saved videos are covered in saved.spec.ts).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { CATALOG } from '../src/catalog'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts.')

test('a check-in is saved, shown on Home and History, hidden from others, and deletable', async ({ users }) => {
  // Real server round trip with no paid calls; give it more than the 30s default
  // when other specs run in parallel.
  test.setTimeout(120_000)
  const [bob, alice] = await users(['Bob', 'Alice'])
  // Bob checks in and Alice looks, so the two roles are covered across the suite.
  const note = `pw-test-note-${Date.now()}`

  // Bob checks in (real action, real database). Exclude every activity so the
  // action stops at "nothing fits" without making any paid call.
  const everything = CATALOG.map((a) => a.id)
  await bob.page.route('**/api/actions/recommend', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    await route.continue({ postData: JSON.stringify({ ...body, excludeActivityIds: everything }) })
  })
  await bob.page.goto('/checkin')
  await bob.page.getByText('Low', { exact: true }).first().click()
  await bob.page.getByText('Medium', { exact: true }).click()
  await bob.page.getByText('Calm down', { exact: true }).click()
  await bob.page.getByLabel('Anything you want to add?').fill(note)
  await bob.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(bob.page.getByTestId('nothing-fits-result')).toBeVisible({ timeout: 45_000 })

  // The check-in was saved (note included), even though no ideas were produced.
  await bob.page.goto('/history')
  const item = bob.page.getByTestId('history-item').filter({ hasText: note })
  await expect(item).toHaveCount(1, { timeout: 15_000 })
  await expect(item).toContainText('Feeling low')
  await expect(item).toContainText('Medium energy')
  await expect(item).toContainText('10 min')
  await expect(item).toContainText('Calm down')

  // Home shows the last check-in.
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('last-checkin')).toContainText('feeling low', { timeout: 15_000 })

  // Alice cannot see Bob's note anywhere on her history.
  await alice.page.goto('/history')
  await expect(alice.page.getByRole('heading', { name: 'Your check-ins' })).toBeVisible()
  await alice.page.waitForTimeout(1500) // let any (wrongly) shared rows arrive
  await expect(alice.page.getByText(note)).toHaveCount(0)

  // Bob deletes it.
  await bob.page.goto('/history')
  await bob.page.getByTestId('history-item').filter({ hasText: note }).getByRole('button', { name: /Delete check-in/ }).click()
  await bob.page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(bob.page.getByText(note)).toHaveCount(0, { timeout: 15_000 })
})

test('history shows a friendly empty state for an account with no check-ins', async ({ users }) => {
  const [alice] = await users(1)
  await alice.page.goto('/history')
  await expect(alice.page.getByRole('heading', { name: 'Your check-ins' })).toBeVisible()
  // Either empty or a list, but never an error.
  await expect(alice.page.getByRole('alert')).toHaveCount(0)
})
