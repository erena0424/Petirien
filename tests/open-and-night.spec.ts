/**
 * Places that are closed are never suggested, and nothing outdoors is suggested late at night, in a real browser against
 * the REAL local database, with the location and Google Maps MOCKED (no paid call). It pins the clock (to noon or 10 PM)
 * so the result does not depend on when the test runs. This proves: a closed place is skipped for an open one; when
 * everything is closed, the card says so kindly; at night Home looks only for a café or library and says why, "Other
 * places" has no park or garden, and a check-in left on "Not sure" is sent as inside while a chosen "Go outside" is kept.
 * It does NOT prove how accurate Google's hours line is (it is a snapshot from the moment of the search).
 * Uses its own account (Dana); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const place = (title: string, lat: number, openState: string, type: string) => ({
  title,
  place_id: `id-${title.replace(/\W/g, '')}`,
  gps_coordinates: { latitude: lat, longitude: -73.983 },
  rating: 4.6,
  type,
  address: '12 Quiet Street',
  open_state: openState,
})

const noon = () => new Date(2026, 0, 4, 12, 0) // 4 January: Home's kind of place is a park by day
const tenPm = () => new Date(2026, 0, 4, 22, 0)

async function setup(page: Page, now: Date, answers: Record<string, unknown>) {
  await tuck(page)
  await page.clock.setFixedTime(now)
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.753612, longitude: -73.983244 })
  const calls: any[] = []
  await page.route('**/api/integrations/serpapi/places-search', (route) => {
    const body = route.request().postDataJSON()
    calls.push(body)
    return route.fulfill(ok(answers[body.q] ?? { local_results: [] }))
  })
  return calls
}

test('by day, a closed place is skipped and an open one is suggested', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  const calls = await setup(page, noon(), {
    park: { local_results: [place('Shut Gate Park', 40.7537, 'Closed ⋅ Opens 6 AM', 'Park'), place('Open Lawn Park', 40.7545, 'Open ⋅ Closes 9 PM', 'Park')] },
  })
  await page.goto('/home')
  const line = page.getByTestId('home-place').getByTestId('place-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText('Open Lawn Park') // the nearer one is closed, so it is not offered
  await expect(page.getByTestId('home-place')).not.toContainText('Shut Gate Park')
  expect(calls[0]).toMatchObject({ q: 'park' })
  await expect(page.getByTestId('night-note')).toHaveCount(0)
})

test('when everything nearby is closed, it says so and offers no place', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await setup(page, noon(), { park: { local_results: [place('Shut Gate Park', 40.7537, 'Temporarily closed', 'Park'), place('Locked Garden Park', 40.7545, 'Closed ⋅ Opens 8 AM Mon', 'Park')] } })
  await page.goto('/home')
  await expect(page.getByTestId('home-place').getByTestId('places-empty')).toContainText('look closed right now')
  await expect(page.getByTestId('home-place').getByTestId('place-line')).toHaveCount(0)
})

test('late at night, Home looks only for a café or a library, says why, and skips what is closed', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  const calls = await setup(page, tenPm(), {
    cafe: { local_results: [place('Shut Cafe', 40.7537, 'Closed ⋅ Opens 7 AM', 'Cafe'), place('Late Night Cafe', 40.7545, 'Open ⋅ Closes 1 AM', 'Cafe')] },
    library: { local_results: [place('Quiet Branch Library', 40.7545, 'Closed ⋅ Opens 9 AM', 'Library')] },
    park: { local_results: [place('Dark Park', 40.7537, '', 'Park')] },
    garden: { local_results: [place('Dark Garden', 40.7537, '', 'Garden')] },
  })
  await page.goto('/home')
  await expect(page.getByTestId('home-place').getByTestId('night-note')).toContainText('indoors and open')
  await expect.poll(() => calls.length).toBeGreaterThan(0)
  for (const c of calls) expect(['cafe', 'library']).toContain(c.q) // never a park or a garden after dark
  const line = page.getByTestId('home-place').getByTestId('place-line')
  if ((await line.count()) > 0) {
    await expect(line).not.toContainText('Dark')
    await expect(line).not.toContainText('Shut Cafe')
    await expect(line).not.toContainText('Quiet Branch Library') // closed too
  } else {
    await expect(page.getByTestId('home-place').getByTestId('places-empty')).toContainText('closed right now')
  }
  await expect(page.getByTestId('home-place')).not.toContainText('Take a walk to')
})

test('late at night the places on a check-in are indoor, with no park or garden to choose, and "Not sure" is sent as inside', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  const calls = await setup(page, tenPm(), {
    cafe: { local_results: [place('Late Night Cafe', 40.7545, 'Open ⋅ Closes 1 AM', 'Cafe')] },
    library: { local_results: [place('Quiet Branch Library', 40.7545, 'Open ⋅ Closes 11 PM', 'Library')] },
  })
  const bodies: any[] = []
  await page.route('**/api/actions/recommend', (route) => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill(ok({ status: 'ok', checkinId: 'c', reply: 'Here are two things.', degraded: [], picks: [{ suggestionId: 's1', activityId: 'walk-nearby', activityTitle: 'Visit a place nearby', video: null, reason: 'A change of scene.', rank: 1 }, { suggestionId: 's2', activityId: 'tidy-one-thing', activityTitle: 'Tidy one small spot', video: null, reason: 'Small and doable.', rank: 2 }] }))
  })
  await page.goto('/checkin')
  await expect(page.getByTestId('options-summary')).toContainText('staying in')
  await page.getByText('Low', { exact: true }).first().click()
  await page.getByText('Medium', { exact: true }).click()
  await page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect.poll(() => bodies.length).toBeGreaterThan(0)
  expect(bodies[0]).toMatchObject({ place: 'in' }) // left on Not sure, so inside at this hour
  await expect(page.getByTestId('night-note')).toBeVisible()
  await expect.poll(() => calls.length).toBeGreaterThan(0)
  for (const c of calls) expect(['cafe', 'library']).toContain(c.q)
  await page.getByRole('button', { name: 'Other places to visit' }).click()
  const kinds = page.getByRole('group', { name: 'Kind of place' })
  await expect(kinds.getByRole('button', { name: 'Café' })).toBeVisible()
  await expect(kinds.getByRole('button', { name: 'Library' })).toBeVisible()
  await expect(kinds.getByRole('button', { name: 'Park' })).toHaveCount(0)
  await expect(kinds.getByRole('button', { name: 'Garden' })).toHaveCount(0)
})

test('a person who chooses "Go outside" late at night is listened to', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await setup(page, tenPm(), {})
  const bodies: any[] = []
  await page.route('**/api/actions/recommend', (route) => {
    bodies.push(route.request().postDataJSON())
    return route.fulfill(ok({ status: 'ok', checkinId: 'c', reply: 'Here is one.', degraded: [], picks: [{ suggestionId: 's1', activityId: 'tidy-one-thing', activityTitle: 'Tidy one small spot', video: null, reason: 'Small and doable.', rank: 1 }] }))
  })
  await page.goto('/checkin')
  await page.getByRole('button', { name: /More options/ }).click()
  await page.getByRole('group', { name: 'Inside or outside?' }).getByText('Go outside', { exact: true }).click()
  await page.getByText('Low', { exact: true }).first().click()
  await page.getByText('Medium', { exact: true }).click()
  await page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect.poll(() => bodies.length).toBeGreaterThan(0)
  expect(bodies[0]).toMatchObject({ place: 'out' })
})
