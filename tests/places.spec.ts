/**
 * Places to go, in a real browser against the REAL local database, with the location and Google Maps MOCKED (a fake
 * location from the browser, page.route for the search), so no paid call is made. This proves our UI, that only a
 * rounded location is sent, concrete suggestions with no menu to pick from, that good / not for me on a specific place
 * is stored and changes later suggestions, the denied and failure paths, and that asking twice does not pay twice.
 * It does NOT prove the real permission prompt, how good the real results are, or billing.
 * Uses its own account (Eli); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const place = (title: string, lat: number, lng: number, type: string) => ({
  title,
  place_id: `id-${title.replace(/\W/g, '')}`,
  gps_coordinates: { latitude: lat, longitude: lng },
  rating: 4.6,
  type,
  address: '12 Quiet Street',
  open_state: 'Open · Closes 8 PM',
  thumbnail: `https://lh3.googleusercontent.com/test-photo-${title.replace(/\W/g, '')}`,
})
// Each list is in the service's own (relevance) order, not by distance.
const PARKS = { local_results: [place('Faraway Green', 40.79, -73.95, 'Park'), place('Corner Park', 40.7545, -73.982, 'Park'), place('Mid Park', 40.768, -73.972, 'Park'), place('Tiny Garden Park', 40.754, -73.984, 'Park')] }
const CAFES = { local_results: [place('Blue Door Cafe', 40.7515, -73.9805, 'Cafe'), place('Far Cafe', 40.78, -73.96, 'Cafe')] }
const LIBRARIES = { local_results: [place('Quiet Branch Library', 40.752, -73.981, 'Library')] }
const GARDENS = { local_results: [place('Rose Garden', 40.7535, -73.9815, 'Garden'), place('Quiet Garden', 40.7565, -73.979, 'Garden')] }
const BY_Q: Record<string, unknown> = { park: PARKS, cafe: CAFES, library: LIBRARIES, garden: GARDENS }

const idea = (n: number, id: string, title: string) => ({ suggestionId: `sug_${n}`, activityId: id, activityTitle: title, video: null, reason: 'A change of scene.', rank: n })
const video = (n: number) => ({
  videoId: `vid${String(n).padStart(8, '0')}`,
  title: `Gentle video ${n}`,
  channel: 'Calm Channel',
  thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  durationSec: 360,
  watchUrl: `https://www.youtube.com/watch?v=vid${String(n).padStart(8, '0')}`,
})
const videoPick = (n: number, id: string, title: string) => ({ suggestionId: `sug_${n}`, activityId: id, activityTitle: title, video: video(n), reason: `Reason ${n}.`, rank: n })

/**
 * Suggestions rotate by day, so a test fixes the date it sees. 4 January is day 4 of the year: a park and a café on the
 * check-in card, and Home's kind of place is a park (4 mod 4 is the first kind). 5 January is a café, 6 January a library.
 */
async function fixDay(page: Page, month = 0, day = 4) {
  await page.clock.setFixedTime(new Date(2026, month, day, 12, 0))
}

async function mockMaps(page: Page) {
  await tuck(page)
  // The place photos: a tiny picture for any Google image link, so no real network is needed.
  await page.route('https://lh3.googleusercontent.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64') }),
  ) // first: a route registered later wins, so this test's own Maps route must come after the default one
  const calls: any[] = []
  // Everyone's place searches go through the app's own capped route (the app owner pays); the kind is sent, not a search phrase.
  await page.route('**/api/public/places', (route) => {
    const body = route.request().postDataJSON()
    calls.push({ q: body.kind, ll: `@${body.lat},${body.lng},15z` })
    return route.fulfill(ok(BY_Q[body.kind] ?? { local_results: [] }))
  })
  return calls
}

async function toIdeas(page: Page) {
  await page.route('**/api/actions/recommend', (route) =>
    route.fulfill(
      ok({
        status: 'ok',
        checkinId: 'c',
        reply: 'Here are three things.',
        degraded: [],
        picks: [videoPick(1, 'box-breathing', 'Box breathing'), idea(2, 'walk-nearby', 'Visit a place nearby'), idea(3, 'tidy-one-thing', 'Tidy one small spot')],
      }),
    ),
  )
  await page.goto('/checkin')
  await page.getByText('Low', { exact: true }).first().click()
  await page.getByText('Medium', { exact: true }).click()
  await page.getByRole('button', { name: 'Show me a few ideas' }).click()
  await expect(page.getByTestId('idea-card').first()).toBeVisible()
}

async function clearRatings(page: Page) {
  await page.goto('/preferences')
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await page.waitForTimeout(1500)
  for (let i = 0; i < 6; i++) {
    const remove = page.getByRole('button', { name: /^Remove rating:/ })
    if ((await remove.count()) === 0) return
    await remove.first().click()
    await page.waitForTimeout(600)
  }
}

test('the card is video, then a concrete place to walk to and one to spend time at, then an idea; no menu to pick from', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.753612, longitude: -73.983244 }) // precise on purpose
  const calls = await mockMaps(page)
  await fixDay(page)
  await clearRatings(page)
  await toIdeas(page)

  // One video first, then the place card, then an everyday idea.
  await expect(page.getByTestId('pick-card')).toHaveCount(1)
  await expect(page.getByTestId('idea-card')).toHaveCount(2)
  const cards = page.locator('[data-testid="pick-card"], [data-testid="idea-card"]')
  await expect(cards.nth(0)).toHaveAttribute('data-testid', 'pick-card')
  await expect(cards.nth(2)).toContainText('Tidy one small spot')
  const placeCard = cards.nth(1)
  await expect(placeCard).not.toContainText('Visit a place nearby') // no generic title: concrete options instead

  // Location was already allowed: the concrete suggestions are there with nothing to press first.
  const lines = placeCard.getByTestId('place-line')
  await expect(lines).toHaveCount(2)
  await expect(lines.nth(0)).toHaveText(/^Take a walk to (Corner Park|Tiny Garden Park|Mid Park)$/)
  await expect(lines.nth(1)).toHaveText(/^Spend quality time at (Blue Door Cafe|Far Cafe)$/)
  await expect(placeCard.getByTestId('place-photo')).toHaveCount(2) // a photo for each place, as a small picture next to its name
  await expect(placeCard.getByTestId('place-photo').first()).toBeVisible()
  await expect(placeCard).toContainText('Places and photos from Google Maps')
  await expect(placeCard).not.toContainText('Faraway Green') // further than an easy walk, whatever order the service listed it
  await expect(placeCard.getByRole('link', { name: 'Open in Google Maps' }).first()).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
  await expect(placeCard.getByRole('group', { name: 'Kind of place' })).toHaveCount(0) // the other kinds are tucked away

  // Only a rounded location and fixed kinds went out: one search for the park, one for the café.
  expect(calls.map((c) => c.q).sort()).toEqual(['cafe', 'park'])
  for (const c of calls) {
    expect(c).toMatchObject({ ll: '@40.75,-73.98,15z' })
    expect(JSON.stringify(c)).not.toMatch(/40\.7536|73\.9832/)
  }

  // Other places to visit: the kinds, one search each, and none of it pays twice.
  await placeCard.getByRole('button', { name: 'Other places to visit' }).click()
  await expect(placeCard.getByRole('group', { name: 'Kind of place' }).getByRole('button')).toHaveText(['Park', 'Café', 'Library', 'Garden'])
  await placeCard.getByRole('button', { name: 'Library' }).click()
  await expect(placeCard.getByTestId('other-places-list').getByTestId('place-line')).toHaveText(['Browse and sit quietly at Quiet Branch Library'])
  expect(calls).toHaveLength(3)
  await placeCard.getByRole('button', { name: 'Park', exact: true }).click()
  await expect(placeCard.getByTestId('other-places-list').getByTestId('place')).toHaveCount(3) // three nearest parks, the far one is out
  expect(calls).toHaveLength(3) // parks were already looked up
})

test('the kind of place and the specific place change from day to day', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.75, longitude: -73.98 })
  await mockMaps(page)
  await clearRatings(page)
  const seen: string[] = []
  const kinds: string[] = []
  // Check-in card: an outdoor and an indoor place each day, from two kinds each.
  for (const day of [4, 5, 6, 7, 8, 9]) {
    await fixDay(page, 0, day)
    await toIdeas(page)
    const rows = page.locator('[data-testid="idea-card"]').first().getByTestId('place-line')
    await expect(rows).toHaveCount(2) // wait for the places to arrive
    const lines = await rows.allInnerTexts()
    expect(lines[0]).toMatch(/^(Take a walk to|Wander through) /)
    expect(lines[1]).toMatch(/^(Spend quality time at|Browse and sit quietly at) /)
    kinds.push(lines.map((l) => l.split(' ').slice(0, 2).join(' ')).join('|'))
    seen.push(lines[0]!)
  }
  expect(new Set(kinds).size).toBeGreaterThan(1) // not the same pair every day
  expect(new Set(seen).size).toBeGreaterThan(1) // and not the same place every day
})

test('good or not right now on a specific place is remembered, hides that place, and "never" is separate; all can be undone', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.75, longitude: -73.98 })
  const calls = await mockMaps(page)
  await fixDay(page)
  await clearRatings(page)
  await toIdeas(page)

  const card = page.locator('[data-testid="idea-card"]').first()
  const line = card.getByTestId('place-line').first()
  await expect(line).toHaveText(/^Take a walk to /)
  const parkName = (await line.innerText()).replace('Take a walk to ', '')
  // The thumbs are on each place, and there is no good / bad for "going outside" as a whole.
  await expect(card.getByRole('button', { name: `Good place: ${parkName}` })).toBeVisible()
  await expect(card.getByTestId('pick-feedback')).toHaveCount(0)

  // Not right now: that place goes and another takes its place, with no new search. The wording says it is not forever.
  const before = calls.length
  await card.getByRole('button', { name: `Not right now: ${parkName}` }).click()
  await expect(line).not.toHaveText(`Take a walk to ${parkName}`)
  await expect(line).toHaveText(/^Take a walk to /)
  const notice = page.getByTestId('place-no-notice')
  await expect(notice).toContainText(`Okay, not right now. I'll leave ${parkName} out for a while.`)
  await expect(notice.getByRole('button', { name: 'Never suggest it' })).toBeVisible()
  expect(calls.length).toBe(before)

  // Remembered after a fresh page load (real database): it does not come back soon.
  await page.waitForTimeout(800)
  await toIdeas(page)
  const again = page.locator('[data-testid="idea-card"]').first()
  await expect(again.getByTestId('place-line').first()).toHaveText(/^Take a walk to /)
  await expect(again).not.toContainText(parkName)

  // Never is its own choice, from the notice, and a good rating is remembered too.
  const second = (await again.getByTestId('place-line').first().innerText()).replace('Take a walk to ', '')
  await again.getByRole('button', { name: `Not right now: ${second}` }).click()
  await page.getByTestId('place-no-notice').getByRole('button', { name: 'Never suggest it' }).click()
  await expect(again.getByRole('button', { name: /^Good place: Blue Door Cafe|^Good place: Far Cafe/ })).toBeVisible()
  await again.getByRole('button', { name: /^Good place: (Blue Door Cafe|Far Cafe)/ }).first().click()

  // Preferences shows what is remembered, in plain words, and removing a rating brings the place back.
  await page.goto('/preferences')
  const rated = page.getByTestId('rated-place')
  await expect(rated.filter({ hasText: parkName })).toContainText('Not right now (back in about 14 days)', { timeout: 15_000 })
  await expect(rated.filter({ hasText: second })).toContainText('Never suggest')
  await expect(rated.filter({ hasText: /Cafe/ })).toContainText('Good')
  await rated.filter({ hasText: parkName }).getByRole('button', { name: /Remove rating/ }).click()
  await expect(rated.filter({ hasText: parkName })).toHaveCount(0)

  await clearRatings(page)
})

test('without location, the card asks first and nothing is sent until you agree', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  const calls = await mockMaps(page)
  await fixDay(page)
  await toIdeas(page)
  const ask = page.getByTestId('places-ask')
  await expect(ask).toContainText('Share your location')
  await expect(ask).toContainText('remembered on this device only')
  await expect(page.getByRole('group', { name: 'Kind of place' })).toHaveCount(0)
  expect(calls).toHaveLength(0)
})

test('saying no to location sends nothing and becomes "take a walk"; failures stay kind and can be retried', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  const calls: any[] = []
  let mode: 'limit' | 'empty' = 'limit'
  await tuck(page)
  await fixDay(page) // by day: late at night the card suggests something indoors instead of a walk
  await page.route('**/api/public/places', (route) => {
    const body = route.request().postDataJSON()
    calls.push({ q: body.kind, ll: `@${body.lat},${body.lng},15z` })
    if (mode === 'limit') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'daily_limit' }) })
    return route.fulfill(ok({ local_results: [] }))
  })
  await toIdeas(page)
  // No permission granted in this browser: refused, and the idea becomes simply taking a walk.
  await page.getByTestId('places-ask').getByRole('button', { name: 'Share my location' }).click()
  await expect(page.getByTestId('places-denied')).toContainText("won't use your location")
  await expect(page.getByTestId('places-denied')).toContainText('taking a walk')
  expect(calls).toHaveLength(0)

  // With permission, the daily limit is explained kindly, and an empty result is gentle.
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.75, longitude: -73.98 })
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('places-error')).toContainText('resting my map')
  await expect(page.getByTestId('places-error')).toContainText('taking a walk')
  mode = 'empty'
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('places-empty')).toContainText('easy walk')
  // The idea itself still has its steps without any of it.
  await page.getByRole('button', { name: /How to do it/ }).first().click()
  await expect(page.getByTestId('idea-card').first()).toContainText('Skip this one if the weather')
})

test('Home shows one place, asks for location first, rotates kinds by day, and does not search again on every reload', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  const calls = await mockMaps(page)
  await fixDay(page) // 4 January: Home's kind of place is a park
  await clearRatings(page)

  // Not allowed yet: it asks, and nothing is sent.
  await page.goto('/home')
  await expect(page.getByTestId('home-place').getByTestId('places-ask')).toContainText('Share your location')
  expect(calls).toHaveLength(0)

  // Allowed: one search for the day's kind, shown as something to do.
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 40.753612, longitude: -73.983244 })
  await page.getByTestId('home-place').getByRole('button', { name: 'Share my location' }).click()
  const line = page.getByTestId('home-place').getByTestId('place-line')
  await expect(line).toHaveCount(1)
  await expect(line).toHaveText(/^Take a walk to /)
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ q: 'park', ll: '@40.75,-73.98,15z' })
  await expect(page.getByTestId('home-place').getByRole('button', { name: 'Other places to visit' })).toHaveCount(0) // Home stays light

  // The rounded location is now remembered on this device, so a reload shows the place at once, from this tab's cache, with no new paid search.
  await page.reload()
  await expect(page.getByTestId('home-place').getByTestId('place-line')).toHaveText(/^Take a walk to /)
  await page.waitForTimeout(500)
  expect(calls).toHaveLength(1)
  expect(await page.evaluate(() => localStorage.getItem('petirien.location'))).toBe('{"lat":40.75,"lng":-73.98}')
  // Updating the location to the same spot reuses the cache; forgetting it goes back to asking.
  await page.getByTestId('home-place').getByTestId('update-location').click()
  await expect(page.getByTestId('home-place').getByTestId('place-line')).toHaveText(/^Take a walk to /)
  expect(calls).toHaveLength(1)
  await page.getByTestId('home-place').getByTestId('forget-location').click()
  await expect(page.getByTestId('home-place').getByTestId('places-ask')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('petirien.location'))).toBeNull()
  await page.getByTestId('home-place').getByRole('button', { name: 'Share my location' }).click()
  await expect(page.getByTestId('home-place').getByTestId('place-line')).toHaveText(/^Take a walk to /)

  // The next days, Home shows a different kind of place: a café, then a library.
  for (const [day, lead, q] of [[5, 'Spend quality time at', 'cafe'], [6, 'Browse and sit quietly at', 'library']] as const) {
    await fixDay(page, 0, day)
    await page.reload() // a new day: the half hour is long past, so it looks by itself (location is already allowed)
    await expect(page.getByTestId('home-place').getByTestId('place-line')).toHaveText(new RegExp(`^${lead} `))
    expect(calls[calls.length - 1]!.q).toBe(q)
  }
})
