/**
 * "Fit it to your day" on the check-in form, in a real browser with the Google
 * Calendar integration MOCKED (page.route). This proves our UI, the time choice,
 * the request we send, and that event details go nowhere. It does NOT prove
 * the real Google sign-in, the real response shape, or billing; those are
 * checked by hand with a real Google account after deploying.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 1, 'Needs 1 usable test account.')
test.setTimeout(120_000)

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const SECRET = 'SECRET-EVENT-TITLE'
const inMin = (m: number) => new Date(Date.now() + m * 60000).toISOString()

async function open(page: Page) {
  await tuck(page)
  await page.goto('/checkin')
  await page.getByRole('button', { name: /More options/ }).click()
}

test('"Use my calendar" picks a time that fits, shows only times, and sends nothing about the events', async ({ users }) => {
  const [a] = await users(1)
  const calls: any[] = []
  const recommend: any[] = []
  await a.page.route('**/api/integrations/google/calendar-list-events', (route) => {
    calls.push(route.request().postDataJSON())
    return route.fulfill(ok({ items: [{ summary: SECRET, description: 'SECRET-DESC', start: { dateTime: inMin(47) }, end: { dateTime: inMin(100) } }] }))
  })
  await a.page.route('**/api/actions/recommend', (route) => {
    recommend.push(route.request().postData())
    return route.fulfill(ok({ status: 'ok', checkinId: 'c', reply: 'Here are two.', degraded: [], picks: [] }))
  })
  await open(a.page)

  await a.page.getByRole('button', { name: 'Use my calendar' }).click()
  await expect(a.page.getByTestId('calendar-result')).toContainText(/about 4[67] minutes before/)
  await expect(a.page.getByTestId('calendar-result')).toContainText('I picked 30 minutes')
  await expect(a.page.getByLabel('30 min')).toBeChecked()
  await expect(a.page.getByTestId('options-summary')).toContainText('30 min')
  await expect(a.page.getByTestId('calendar-fit')).not.toContainText(SECRET) // times only

  // We asked for the next few hours of the main calendar, nothing else.
  expect(calls).toHaveLength(1)
  expect(calls[0].calendarId).toBe('primary')
  const span = Date.parse(calls[0].timeMax) - Date.parse(calls[0].timeMin)
  expect(span).toBe(240 * 60000)
  expect(Math.abs(Date.parse(calls[0].timeMin) - Date.now())).toBeLessThan(60_000)

  // Event details are not in the check-in request either.
  await a.page.getByText('Low', { exact: true }).first().click()
  await a.page.getByText('Medium', { exact: true }).click()
  await a.page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect.poll(() => recommend.length).toBeGreaterThan(0)
  expect(recommend.join(' ')).not.toContain('SECRET')
  expect(JSON.parse(recommend[0]!).minutes).toBe(30)
})

test('not connected yet: offers a Connect link to Google only, then checks again', async ({ users }) => {
  const [a] = await users(1)
  let connected = false
  await a.page.route('**/api/integrations/google/calendar-list-events', (route) =>
    route.fulfill(ok(connected ? { items: [{ start: { dateTime: inMin(12) }, end: { dateTime: inMin(40) } }] } : { requiresOAuth: true, provider: 'google', authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })),
  )
  await open(a.page)
  await a.page.getByRole('button', { name: 'Use my calendar' }).click()
  const link = a.page.getByTestId('calendar-connect')
  await expect(link).toHaveAttribute('href', 'https://accounts.google.com/o/oauth2/v2/auth?x=1')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  connected = true
  await a.page.getByRole('button', { name: /I've connected, check again/ }).click()
  await expect(a.page.getByTestId('calendar-result')).toContainText('I picked 10 minutes')
  await expect(a.page.getByLabel('10 min')).toBeChecked()
})

test('a sign-in link that is not Google is never shown', async ({ users }) => {
  const [a] = await users(1)
  await a.page.route('**/api/integrations/google/calendar-list-events', (route) =>
    route.fulfill(ok({ requiresOAuth: true, authUrl: 'https://evil.example.com/steal' })),
  )
  await open(a.page)
  await a.page.getByRole('button', { name: 'Use my calendar' }).click()
  await expect(a.page.getByTestId('calendar-error')).toBeVisible()
  await expect(a.page.getByTestId('calendar-connect')).toHaveCount(0)
})

test('busy now, no events, out of credits, and a failure each say something calm and keep manual choice', async ({ users }) => {
  const [a] = await users(1)
  let mode: 'busy' | 'empty' | 'credits' | 'fail' = 'busy'
  await a.page.route('**/api/integrations/google/calendar-list-events', (route) => {
    if (mode === 'busy') return route.fulfill(ok({ items: [{ start: { dateTime: inMin(-10) }, end: { dateTime: inMin(25) } }] }))
    if (mode === 'empty') return route.fulfill(ok({ items: [] }))
    if (mode === 'credits') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Not enough credits', code: 'insufficient_credits' }) })
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) })
  })
  await open(a.page)
  const run = () => a.page.getByRole('button', { name: 'Use my calendar' }).click()

  await run()
  await expect(a.page.getByTestId('calendar-result')).toContainText('busy until')
  await expect(a.page.getByLabel('10 min')).toBeChecked() // unchanged: the default
  mode = 'empty'
  await run()
  await expect(a.page.getByTestId('calendar-result')).toContainText('Nothing coming up')
  await expect(a.page.getByLabel('30 min')).toBeChecked()
  mode = 'credits'
  await run()
  await expect(a.page.getByTestId('calendar-error')).toContainText('out of credits')
  mode = 'fail'
  await run()
  await expect(a.page.getByTestId('calendar-error')).toContainText("couldn't reach your calendar")
  await a.page.getByText('15 min', { exact: true }).click() // the manual choice always works
  await expect(a.page.getByLabel('15 min')).toBeChecked()
  await expect(a.page.getByRole('button', { name: 'Show me a few ideas' })).toBeDisabled() // mood and energy still needed, as before
})
