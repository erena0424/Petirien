/**
 * The Journal's iCal-style calendar in a real browser against the REAL local database, with Google Calendar
 * MOCKED (no paid calls) and entries seeded through the dev-only hook (the model that writes them is never
 * called). This proves layout, times, overlap, all-day events, opening an event, reflecting with the bunny,
 * reading the calendar only when asked, and not paying twice for a range already loaded. It does NOT prove
 * the real Google response shape or billing, and placement on other dates is covered by unit tests
 * (src/journal), because a test cannot back-date a real entry.
 * Uses its own account (Dana); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { clearCheckins, seedCheckin, seedJournal } from './seed'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const today = () => new Date()
const at = (h: number, m = 0) => new Date(today().getFullYear(), today().getMonth(), today().getDate(), h, m).toISOString()
const dayStr = (offset = 0) => {
  const d = new Date(today().getFullYear(), today().getMonth(), today().getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayKey = () => dayStr(0)
const NOTE = `Quiet evening ${run}`
const STANDUP = `Standup ${run}`
const PLANNING = `Planning ${run}`
const WORSHIP = `Worship ${run}`
const HOLIDAY = `Holiday ${run}`

const items = [
  { id: `s-${run}`, summary: STANDUP, start: { dateTime: at(9) }, end: { dateTime: at(10) } },
  { id: `p-${run}`, summary: PLANNING, start: { dateTime: at(9, 30) }, end: { dateTime: at(10, 30) } },
  { id: `w-${run}`, summary: WORSHIP, start: { dateTime: at(14) }, end: { dateTime: at(15, 30) } },
  { id: `h-${run}`, summary: HOLIDAY, start: { date: dayStr(0) }, end: { date: dayStr(1) } },
]

async function mockCalendar(page: Page) {
  const calls: any[] = []
  await page.route('**/api/integrations/google/calendar-list-events', (route) => {
    calls.push(route.request().postDataJSON())
    return route.fulfill(ok({ items }))
  })
  await page.route('**/api/actions/reflectReply', (r) => r.fulfill(ok({ status: 'ok', reply: 'Tell me about it.' })))
  return calls
}

async function cleanUp(page: Page) {
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await page.waitForTimeout(1000) // let the stored entries arrive before looking for leftovers
  // The chat opened by "Reflect on this" sits over the right edge of the page: fold it away before pressing buttons there.
  const toggle = page.getByTestId('floating-toggle')
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
  await page.getByTestId('journal-view-list').click()
  for (let i = 0; i < 5; i++) {
    const del = page.getByRole('button', { name: /^Delete entry:/ })
    if ((await del.count()) === 0) break
    await del.first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(500)
  }
}

test('the calendar shows events at their times, marks what you wrote about, and reflecting happens with the bunny', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  const calls = await mockCalendar(page)
  await page.goto('/journal')
  await cleanUp(page) // start clean: an earlier failed run may have left entries behind
  await seedJournal(page, { title: NOTE, notes: ['I felt a bit quiet today'], feelings: ['calm'], bunnyNote: 'Thanks for sharing.' })
  await seedJournal(page, { title: `About ${WORSHIP}`, notes: ['It was good to be there'], eventId: `w-${run}`, eventTitle: WORSHIP, eventStart: at(14) })

  // Nothing is read from Google until asked; the journal itself is already on the calendar.
  await page.reload()
  await page.getByTestId('journal-view-month').click() // the list was the last view used (cleaning up), so choose Month
  await expect(page.getByTestId('journal-view-month')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('calendar-bar')).toContainText('Show my calendar')
  expect(calls).toHaveLength(0)
  const cell = page.locator(`[data-testid="journal-day"][data-date="${todayKey()}"]`)
  await expect(cell).toHaveAttribute('data-count', '2', { timeout: 15_000 })
  await expect(cell).toHaveAttribute('data-events', '0')
  await expect(page.getByTestId('journal-day-entries')).toContainText(NOTE) // an entry with no calendar event, on its date

  // Show the calendar: one read for the whole visible month, then events appear in the cells and the day's agenda.
  await page.getByRole('button', { name: 'Show my calendar' }).click()
  await expect(cell).toHaveAttribute('data-events', '4')
  expect(calls).toHaveLength(1)
  const span = Date.parse(calls[0].timeMax) - Date.parse(calls[0].timeMin)
  expect(span).toBeGreaterThanOrEqual(28 * 86_400_000)
  await expect(cell).toContainText(STANDUP)
  await expect(cell).toContainText('+1 more') // three names then a count
  await expect(page.getByTestId('journal-day-events')).toContainText(WORSHIP)
  await expect(page.getByTestId('journal-day-events')).toContainText(/2:00.*to.*3:30/)
  await expect(page.getByTestId('calendar-bar')).toHaveCount(0)

  // Week: hours on the side, events at their times, overlapping ones side by side, all-day in the strip.
  await page.getByTestId('journal-view-week').click()
  expect(calls).toHaveLength(1) // the month already covers this week: no second read, no second charge
  const grid = page.getByTestId('time-grid')
  await expect(grid).toBeVisible()
  const standup = page.locator('[data-testid="event-block"]').filter({ hasText: STANDUP })
  const planning = page.locator('[data-testid="event-block"]').filter({ hasText: PLANNING })
  await expect(standup).toHaveAttribute('data-start-min', String(9 * 60))
  await expect(standup).toHaveAttribute('data-end-min', String(10 * 60))
  await expect(planning).toHaveAttribute('data-start-min', String(9 * 60 + 30))
  await expect(standup).toHaveAttribute('data-lanes', '2')
  await expect(planning).toHaveAttribute('data-lane', '1')
  const a = (await standup.boundingBox())!
  const b = (await planning.boundingBox())!
  expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 2) // side by side: neither hides the other
  expect(b.y).toBeGreaterThan(a.y) // and the later one starts lower
  await expect(page.getByTestId('allday-event').filter({ hasText: HOLIDAY })).toBeVisible()
  // The event you already wrote about is marked, the others are not.
  await expect(page.locator('[data-testid="event-block"]').filter({ hasText: WORSHIP })).toHaveAttribute('aria-label', /in your journal/)
  await expect(standup).not.toHaveAttribute('aria-label', /in your journal/)
  // An entry with no event sits in the grid at the time it was written.
  await expect(page.getByTestId('journal-marker').filter({ hasText: NOTE })).toBeVisible()

  // Day: the same hours for one day, and moving a day costs nothing.
  await page.getByTestId('journal-view-day').click()
  expect(calls).toHaveLength(1)
  await expect(page.getByTestId('time-column')).toHaveCount(1)
  await expect(page.locator('[data-testid="event-block"]').filter({ hasText: STANDUP })).toBeVisible()

  // Open an event that has nothing written: say so, and reflect with the bunny (a conversation, not a form).
  await page.locator('[data-testid="event-block"]').filter({ hasText: STANDUP }).click()
  const dialog = page.getByTestId('event-dialog')
  await expect(dialog).toContainText(STANDUP)
  await expect(dialog).toContainText(/9:00.*to.*10:00/)
  await expect(page.getByTestId('event-empty')).toBeVisible()
  await dialog.getByRole('button', { name: 'Reflect on this' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByTestId('bunny-words')).toContainText(`"${STANDUP}"`)
  await expect(page.getByTestId('bunny-words')).toContainText(/How (are you feeling about it|did it go|is it going)\?/)
  await expect(page.getByLabel('Tell the bunny something')).toBeFocused()

  // Open the event you wrote about: its entry is listed.
  await page.locator('[data-testid="event-block"]').filter({ hasText: WORSHIP }).click()
  await expect(page.getByTestId('event-entries')).toContainText(`About ${WORSHIP}`)
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()

  await cleanUp(page)
})

test('moving to another month reads the calendar once more, and coming back is free; the view is remembered', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  const calls = await mockCalendar(page)
  await page.goto('/journal')
  await page.getByTestId('journal-view-month').click()
  await page.getByRole('button', { name: 'Show my calendar' }).click()
  await expect(page.locator(`[data-testid="journal-day"][data-date="${todayKey()}"]`)).toHaveAttribute('data-events', '4')
  expect(calls).toHaveLength(1)

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect.poll(() => calls.length).toBe(2) // a new range: one more read, on its own because it was used
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.locator(`[data-testid="journal-day"][data-date="${todayKey()}"]`)).toHaveAttribute('data-events', '4')
  await page.waitForTimeout(500)
  expect(calls).toHaveLength(2) // back in a range already loaded: free

  await page.getByTestId('journal-view-week').click()
  await page.reload()
  await expect(page.getByTestId('journal-view-week')).toHaveAttribute('aria-pressed', 'true')
})

test('not connected yet: a Connect link to Google only, and a failure offers Try again', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  let mode: 'oauth' | 'fail' | 'ok' = 'oauth'
  await page.route('**/api/integrations/google/calendar-list-events', (route) => {
    if (mode === 'oauth') return route.fulfill(ok({ requiresOAuth: true, authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }))
    if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) })
    return route.fulfill(ok({ items }))
  })
  await page.goto('/journal')
  await page.getByRole('button', { name: 'Show my calendar' }).click()
  const link = page.getByTestId('calendar-connect')
  await expect(link).toHaveAttribute('href', 'https://accounts.google.com/o/oauth2/v2/auth?x=1')
  await expect(link).toHaveAttribute('rel', /noopener/)
  mode = 'fail'
  await page.getByRole('button', { name: /I've connected, check again/ }).click()
  await expect(page.getByTestId('calendar-error')).toContainText("couldn't reach your calendar")
  mode = 'ok'
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator(`[data-testid="journal-day"][data-date="${todayKey()}"]`)).toHaveAttribute('data-events', '4')
})

test('phone width: no horizontal scroll in any view, with events showing', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  await mockCalendar(page)
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/journal')
  await page.getByRole('button', { name: 'Show my calendar' }).click()
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  for (const v of ['month', 'week', 'day', 'list']) {
    await page.getByTestId(`journal-view-${v}`).click()
    expect(await overflow(), v).toBeLessThanOrEqual(0)
  }
})

test('check-ins show on the Journal: a mood and energy chart, the day\'s check-ins, and markers at their times', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  await mockCalendar(page)
  await page.goto('/journal')
  await clearCheckins(page)
  await page.getByTestId('journal-view-month').click()

  // Nothing yet: a calm invitation, no chart, no verdict.
  await expect(page.getByTestId('mood-empty')).toContainText('No check-ins in this stretch yet')
  await expect(page.getByTestId('mood-svg')).toHaveCount(0)

  await seedCheckin(page, { mood: 2, energy: 3, note: `quiet start ${run}` })
  await seedCheckin(page, { mood: 4, energy: 2, goal: 'calm' })
  const chart = page.getByTestId('mood-chart')
  await expect(chart.getByTestId('mood-summary')).toContainText('Across 2 check-ins', { timeout: 15_000 })
  await expect(chart.getByTestId('mood-summary')).toContainText(/mostly felt (okay|good|low).*energy/)
  await expect(chart).not.toContainText(/bad|worse|poor|problem|concern|should/i)
  // A month shows one point a day (the average of that day), two lines that differ by shape as well as color.
  await expect(chart.getByTestId('mood-point')).toHaveCount(1)
  await expect(chart.getByTestId('energy-point')).toHaveCount(1)
  await expect(chart.getByTestId('energy-line')).toHaveAttribute('stroke-dasharray', /\d/) // dashed
  await expect(chart.getByTestId('mood-line')).not.toHaveAttribute('stroke-dasharray', /./) // solid
  await expect(chart.getByTestId('mood-svg')).toHaveAttribute('aria-label', /Chart of mood and energy from 1 to 5/)

  // The numbers, for anyone who cannot see the chart.
  await chart.getByText('See the numbers').click()
  const rows = chart.getByTestId('mood-table').locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('4 · Good')
  await expect(rows.nth(0)).toContainText('2 · Low')
  await expect(rows.nth(1)).toContainText('2 · Low')
  await expect(rows.nth(1)).toContainText('3 · Medium')

  // On the calendar: the day has a check-in dot, and the day's list says what was said.
  const cell = page.locator(`[data-testid="journal-day"][data-date="${todayKey()}"]`)
  await expect(cell).toHaveAttribute('data-checkins', '2')
  await expect(cell).toHaveAttribute('aria-label', /2 check-ins/)
  await expect(cell.getByTestId('checkin-dot')).toHaveCount(1)
  const list = page.getByTestId('journal-day-checkins')
  await expect(list.getByTestId('day-checkin')).toHaveCount(2)
  await expect(list).toContainText('Feeling low, medium energy')
  await expect(list).toContainText('Feeling good, low energy')
  await expect(list).toContainText(`quiet start ${run}`)
  await expect(list).toContainText('Wanted: calm down')

  // The Day view plots every check-in, and marks each at its time in the hour grid.
  await page.getByTestId('journal-view-day').click()
  await expect(chart.getByTestId('mood-point')).toHaveCount(2)
  await expect(chart.getByTestId('energy-point')).toHaveCount(2)
  await expect(page.getByTestId('checkin-marker')).toHaveCount(2)
  await expect(page.getByTestId('checkin-marker').first()).toHaveAttribute('aria-label', /^Check-in: Feeling (low, medium|good, low) energy, /)

  // A stretch without check-ins goes back to the invitation.
  await page.getByTestId('journal-view-month').click()
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByTestId('mood-empty')).toBeVisible()

  // Phone width: the chart and its table do not make the page scroll sideways.
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.setViewportSize({ width: 375, height: 700 })
  for (const v of ['month', 'week', 'day', 'list']) {
    await page.getByTestId(`journal-view-${v}`).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), v).toBeLessThanOrEqual(0)
  }
  await clearCheckins(page)
})
