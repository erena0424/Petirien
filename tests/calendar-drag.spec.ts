/**
 * Adding an event by pointing at the calendar, like a paper diary or Google Calendar, in a real browser against the REAL
 * local database (nothing paid). This proves: dragging on an empty part of a day in the Week or Day view opens "Add an
 * event" with that start and end filled in (either direction, snapped to a quarter hour); a plain click makes an hour
 * starting at the half hour clicked; clicking an existing event opens it instead of adding; a tiny wobble is a click, not a
 * drag; cancelling saves nothing; and what is added lands where it was drawn.
 * The pointer arithmetic is covered by unit tests (src/journal/slots.test.ts).
 * It does NOT prove touch screens (a tap uses the click path; a drag would scroll the page instead).
 * Uses its own account (Dana); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const HOUR_PX = 48 // src/journal/layout.ts

/** Bring the hours into view and start them at 7 AM, so 9 to 5 is on screen (the mouse can only reach what is on screen). */
async function showHours(page: Page) {
  await page.getByTestId('time-grid').evaluate((el) => {
    el.scrollTop = 7 * 48
    el.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
  await page.waitForTimeout(400)
}

async function openWeek(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1100 })
  await tuck(page)
  await page.goto('/journal')
  await expect(page.getByTestId('journal-range')).toBeVisible()
  const toggle = page.getByTestId('floating-toggle')
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
  await page.getByTestId('journal-view-week').click()
  await showHours(page)
}

/** The page position of a minute of today's column. */
async function at(page: Page, minute: number) {
  const box = (await page.locator(`[data-testid="time-column"][data-date="${TODAY}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + (minute / 60) * HOUR_PX }
}

async function drag(page: Page, from: number, to: number) {
  const a = await at(page, from)
  const b = await at(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

const dialog = (page: Page) => page.getByTestId('add-event-dialog')

async function removeEvent(page: Page, title: string) {
  const block = page.locator('[data-testid="event-block"]').filter({ hasText: title })
  await block.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await block.click()
  await page.getByTestId('remove-event').click()
  await expect(block).toHaveCount(0)
}

test('dragging down the calendar adds an event for exactly that time', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await openWeek(page)
  const title = `Workshop ${run}`
  await drag(page, 9 * 60, 10 * 60 + 30)
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByLabel('Date')).toHaveValue(TODAY)
  await expect(dialog(page).getByLabel('Time (optional)')).toHaveValue('09:00')
  await expect(dialog(page).getByLabel('Until (optional)')).toHaveValue('10:30')
  await dialog(page).getByLabel('What is it?').fill(title)
  await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
  const block = page.locator('[data-testid="event-block"]').filter({ hasText: title })
  await expect(block).toHaveAttribute('data-start-min', String(9 * 60))
  await expect(block).toHaveAttribute('data-end-min', String(10 * 60 + 30))
  await removeEvent(page, title)
})

test('dragging upward works the same, and shows the range while dragging', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await openWeek(page)
  const a = await at(page, 11 * 60)
  const b = await at(page, 10 * 60)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await expect(page.getByTestId('slot-preview')).toContainText('10 AM – 11 AM') // shown while the button is still down
  await page.mouse.up()
  await expect(dialog(page).getByLabel('Time (optional)')).toHaveValue('10:00')
  await expect(dialog(page).getByLabel('Until (optional)')).toHaveValue('11:00')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByTestId('slot-preview')).toHaveCount(0)
})

test('a plain click makes an hour from the half hour clicked, and a tiny wobble is still a click', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await openWeek(page)
  const p = await at(page, 14 * 60 + 10)
  await page.mouse.click(p.x, p.y)
  await expect(dialog(page).getByLabel('Time (optional)')).toHaveValue('14:00')
  await expect(dialog(page).getByLabel('Until (optional)')).toHaveValue('15:00')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)

  const q = await at(page, 16 * 60 + 40)
  await page.mouse.move(q.x, q.y)
  await page.mouse.down()
  await page.mouse.move(q.x, q.y + 3)
  await page.mouse.up()
  await expect(dialog(page).getByLabel('Time (optional)')).toHaveValue('16:30') // the half hour it landed in
  await expect(dialog(page).getByLabel('Until (optional)')).toHaveValue('17:30')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
})

test('clicking an existing event opens it instead of adding a new one, and nothing is added by cancelling', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await openWeek(page)
  const title = `Existing ${run}`
  await drag(page, 12 * 60, 13 * 60)
  await dialog(page).getByLabel('What is it?').fill(title)
  await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
  const block = page.locator('[data-testid="event-block"]').filter({ hasText: title })
  await expect(block).toBeVisible()
  await block.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await block.click()
  await expect(page.getByTestId('event-dialog')).toContainText(title)
  await expect(dialog(page)).toHaveCount(0) // the add window did not open as well
  await page.getByTestId('remove-event').click()
  await expect(block).toHaveCount(0)

  // A drag that is cancelled leaves nothing behind.
  await showHours(page) // opening the event scrolled the page
  await drag(page, 15 * 60, 16 * 60)
  await dialog(page).getByLabel('What is it?').fill(`Never saved ${run}`)
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('[data-testid="event-block"]').filter({ hasText: `Never saved ${run}` })).toHaveCount(0)
})

test('the Day view works the same way, and typing an event in is still possible', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await openWeek(page)
  await page.getByTestId('journal-view-day').click()
  await showHours(page)
  const title = `Day view ${run}`
  await drag(page, 8 * 60, 9 * 60)
  await dialog(page).getByLabel('What is it?').fill(title)
  await dialog(page).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('[data-testid="event-block"]').filter({ hasText: title })).toHaveAttribute('data-start-min', String(8 * 60))
  await removeEvent(page, title)

  await expect(page.getByTestId('add-event-hint')).toContainText('Click or drag on the calendar')
  await page.getByTestId('add-event').click() // the keyboard way: type it in
  await expect(dialog(page).getByLabel('Date')).toHaveValue(TODAY)
  await expect(dialog(page).getByLabel('Time (optional)')).toHaveValue('')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
})
