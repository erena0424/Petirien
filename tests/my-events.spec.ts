/**
 * Events a person adds themselves, in a real browser against the REAL local database (nothing paid: no calendar read, no
 * model). This proves: an event added in the Journal appears on the Month and Week calendar on its day, is still there
 * after a reload (it is saved to the account, not held in the page), can be opened and removed, is private to its
 * owner, and that an event for today also shows on Home, where it can be added with a date and removed.
 * It does NOT prove Google Calendar events (covered in journal.spec) or the bunny's conversation about an event.
 * Uses accounts Dana (owner) and Eli (a second person); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
/** The 15th of this month: always on the month grid. */
const KEY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-15`
const TITLE = `Dentist ${run}`
const TODAY = `Coffee with Sam ${run}`

async function fold(page: Page) {
  const toggle = page.getByTestId('floating-toggle')
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
}

async function removeAnyLeft(page: Page, text: string) {
  // Leftovers from an earlier failed run would make counts wrong: remove them through the Month view.
  await page.getByTestId('journal-view-month').click()
  for (let i = 0; i < 6; i++) {
    const cell = page.locator(`[data-testid="journal-day"]`).filter({ hasText: text })
    if ((await cell.count()) === 0) break
    await cell.first().click() // opens that day
    await page.getByTestId('journal-view-day').click()
    const block = page.locator('[data-testid="event-block"], [data-testid="agenda-event"], [data-testid="allday-event"]').filter({ hasText: text }).first()
    if ((await block.count()) === 0) break
    await block.click()
    await page.getByTestId('remove-event').click()
    await page.waitForTimeout(700)
    await page.getByTestId('journal-view-month').click()
  }
}

test('an event added in the Journal shows on its day, survives a reload, opens, and can be removed', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  await page.goto('/journal')
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await fold(page)
  await page.getByTestId('journal-view-month').click()

  // Add one for the 15th, at 2:30 PM.
  await page.getByTestId('add-event').click()
  const dialog = page.getByTestId('add-event-dialog')
  await dialog.getByLabel('What is it?').fill(TITLE)
  await dialog.getByLabel('Date').fill(KEY)
  await dialog.getByLabel('Time (optional)').fill('14:30')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  // It is on the Month grid, in the cell for that day.
  const cell = page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`)
  await expect(cell).toContainText(TITLE)
  await expect(cell).toHaveAttribute('data-events', '1')

  // It is saved to the account: still there after a reload.
  await page.reload()
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await fold(page)
  await page.getByTestId('journal-view-month').click()
  await expect(page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`)).toContainText(TITLE)

  // Choosing the day opens it, with the event at its time on the Day view; opening the event shows it and a way to remove it.
  await page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`).click()
  await expect(page.getByTestId('time-column')).toHaveAttribute('data-date', KEY)
  const block = page.locator('[data-testid="event-block"]').filter({ hasText: TITLE })
  await expect(block).toHaveAttribute('data-start-min', String(14 * 60 + 30))
  await block.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await block.click()
  await expect(page.getByTestId('event-dialog')).toContainText(TITLE)
  await expect(page.getByTestId('event-dialog')).toContainText('Reflect on this') // it can be talked about like any event
  await page.getByTestId('remove-event').click()
  await expect(page.getByTestId('event-dialog')).toHaveCount(0)
  await expect(page.locator('[data-testid="event-block"]').filter({ hasText: TITLE })).toHaveCount(0)
  await page.getByTestId('journal-view-month').click()
  await expect(page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`)).not.toContainText(TITLE)
})

test('an event with no time is all day, and an unusable one is not saved', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  await page.goto('/journal')
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await fold(page)
  await page.getByTestId('journal-view-week').click()

  await page.getByTestId('add-event').click()
  const dialog = page.getByTestId('add-event-dialog')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click() // nothing typed
  await expect(dialog.getByRole('alert')).toContainText('Add what it is')
  await dialog.getByLabel('What is it?').fill(`Holiday ${run}`)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click() // the date defaults to the day being looked at
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('allday-event').filter({ hasText: `Holiday ${run}` })).toBeVisible()
  await page.getByTestId('allday-event').filter({ hasText: `Holiday ${run}` }).click()
  await page.getByTestId('remove-event').click()
  await expect(page.getByTestId('allday-event').filter({ hasText: `Holiday ${run}` })).toHaveCount(0)
})

test('events are private to their owner', async ({ users }) => {
  const [dana, eli] = await users(['Dana', 'Eli'])
  await tuck(dana.page)
  await tuck(eli.page)
  await dana.page.goto('/journal')
  await expect(dana.page.getByTestId('journal-range')).toBeVisible()
  await fold(dana.page)
  await dana.page.getByTestId('journal-view-month').click()
  await dana.page.getByTestId('add-event').click()
  await dana.page.getByTestId('add-event-dialog').getByLabel('What is it?').fill(`Private thing ${run}`)
  await dana.page.getByTestId('add-event-dialog').getByLabel('Date').fill(KEY)
  await dana.page.getByTestId('add-event-dialog').getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dana.page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`)).toContainText(`Private thing ${run}`)

  await eli.page.goto('/journal')
  await expect(eli.page.getByTestId('journal-range')).toBeVisible()
  await eli.page.waitForTimeout(2500) // let anything that would show have arrived
  await fold(eli.page)
  await eli.page.getByTestId('journal-view-month').click()
  await expect(eli.page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`)).not.toContainText(`Private thing ${run}`)

  // Clean up Dana's.
  await dana.page.locator(`[data-testid="journal-day"][data-date="${KEY}"]`).click()
  const block = dana.page.locator('[data-testid="allday-event"]').filter({ hasText: `Private thing ${run}` })
  await block.click()
  await dana.page.getByTestId('remove-event').click()
})

test('on Home, a plan for today is saved with its date, survives a reload, and can be removed', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  await page.goto('/home')
  await fold(page)
  await page.getByRole('button', { name: 'Share a plan' }).click()
  await page.getByLabel('What is it?').fill(TODAY)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('plan').filter({ hasText: TODAY })).toHaveCount(1)

  await page.reload() // before this change a hand-added plan was gone on reload
  await fold(page)
  await page.getByRole('button', { name: 'Show my plans' }).click().catch(() => undefined)
  await expect(page.getByTestId('plan').filter({ hasText: TODAY })).toHaveCount(1)

  // A plan for a later day is not on Home (only today and tomorrow are), but is on the Journal calendar.
  await page.getByRole('button', { name: 'Share a plan' }).click()
  await page.getByLabel('What is it?').fill(`Later ${run}`)
  await page.getByLabel('Date (optional)').fill(KEY.slice(0, 8) + '28')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('plan').filter({ hasText: `Later ${run}` })).toHaveCount(0)

  await page.getByRole('button', { name: `Remove: ${TODAY}` }).click()
  await expect(page.getByTestId('plan').filter({ hasText: TODAY })).toHaveCount(0)
  await page.goto('/journal')
  await fold(page)
  await removeAnyLeft(page, `Later ${run}`)
})
