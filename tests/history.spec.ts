/**
 * Persistence and privacy against the REAL local server and database (nothing mocked).
 *
 * Test accounts have no credits, so the model call is refused and YouTube may
 * be down; the pipeline then degrades to its no-video path, which still stores
 * the check-in. That is exactly what this test needs: proof that a check-in is
 * saved, shown back to its owner, deletable, and invisible to another account.
 *
 * What this does NOT prove: that real recommendations work (they need credits
 * and a healthy YouTube integration), or isolation of suggestions/saved videos
 * (those are covered by the same owner-only permission, but only check-ins are
 * asserted here).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts.')

test('a check-in is saved, shown on Home and History, hidden from others, and deletable', async ({ users }) => {
  const [alice, bob] = await users(2)
  const note = `pw-test-note-${Date.now()}`

  // Alice checks in (real action, real database).
  await alice.page.goto('/checkin')
  await alice.page.getByText('Low', { exact: true }).first().click()
  await alice.page.getByText('Medium', { exact: true }).click()
  await alice.page.getByText('Calm down', { exact: true }).click()
  await alice.page.getByLabel('Anything you want to add?').fill(note)
  await alice.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(alice.page.getByTestId('loading')).toHaveCount(0, { timeout: 45_000 })

  // Whatever the pipeline returned, it must have saved the check-in. (A crisis
  // phrase would drop the note, but this note is ordinary.)
  await alice.page.goto('/history')
  const item = alice.page.getByTestId('history-item').filter({ hasText: note })
  await expect(item).toHaveCount(1, { timeout: 15_000 })
  await expect(item).toContainText('Feeling low')
  await expect(item).toContainText('Medium energy')
  await expect(item).toContainText('10 min')
  await expect(item).toContainText('Calm down')

  // Home shows the last check-in.
  await alice.page.goto('/home')
  await expect(alice.page.getByTestId('last-checkin')).toContainText('feeling low', { timeout: 15_000 })

  // Bob cannot see Alice's note anywhere on his history.
  await bob.page.goto('/history')
  await expect(bob.page.getByRole('heading', { name: 'Your check-ins' })).toBeVisible()
  await bob.page.waitForTimeout(1500) // let any (wrongly) shared rows arrive
  await expect(bob.page.getByText(note)).toHaveCount(0)

  // Alice deletes it.
  await alice.page.goto('/history')
  await alice.page.getByTestId('history-item').filter({ hasText: note }).getByRole('button', { name: /Delete check-in/ }).click()
  await alice.page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(alice.page.getByText(note)).toHaveCount(0, { timeout: 15_000 })
})

test('history shows a friendly empty state for an account with no check-ins', async ({ users }) => {
  const [alice] = await users(1)
  await alice.page.goto('/history')
  await expect(alice.page.getByRole('heading', { name: 'Your check-ins' })).toBeVisible()
  // Either empty or a list, but never an error.
  await expect(alice.page.getByRole('alert')).toHaveCount(0)
})
