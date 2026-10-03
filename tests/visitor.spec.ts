/**
 * The first-time visitor flow, signed out, in a real browser. The preview uses no model and no search (sample
 * suggestions from the catalog and a short list of videos chosen by hand), so there is nothing paid to mock. Proves the
 * welcome, the sample content ready on arrival, the energy and time questions and their Skip, that saving asks for
 * sign-in and remembers the choice, and that after sign-in the choice is picked up. It cannot complete a real
 * Google or GitHub sign-in; the "after sign-in" half uses a signed-in test account with the remembered choice in storage.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

async function fakeYouTube(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.YT = {
      Player: class {
        constructor(el: HTMLElement) {
          el.setAttribute('data-testid', 'fake-player')
          el.textContent = 'fake player'
        }
        destroy() {}
      },
    }
  })
}

test.describe('someone who has not signed in', () => {
  test('arrives to the bunny, one sentence about Petirien, and one clear invitation, with nothing empty', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    const hero = page.getByTestId('home-hero')
    await expect(hero).toBeVisible()
    expect((await hero.locator('img').first().boundingBox())!.width).toBeGreaterThanOrEqual(200)
    await expect(page.getByTestId('home-pitch')).toHaveText('What feels manageable today?')
    await expect(page.getByTestId('home-find')).toHaveText('Find something to do')
    await expect(page.getByTestId('home-signin')).toBeVisible() // returning people can sign in from the start
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What feels manageable today?')
    await expect(page.getByTestId('home-explain')).toHaveText("Start with your mood, energy and time. I'll help you find something that fits.")
    // Nothing that needs an account, and nothing empty.
    for (const id of ['plans', 'home-saved-empty', 'calendar', 'for-now', 'home-ideas']) await expect(page.getByTestId(id)).toHaveCount(0)
    await expect(page.getByText('From your saved')).toHaveCount(0)
    await expect(page.getByText('Finding a couple of things')).toHaveCount(0)
  })

  test('Somewhere to go asks for location, then shows a real place with no sign-in, sending only a rounded location', async ({ page }) => {
    await tuck(page)
    // The permission is still to be asked (not granted yet), so nothing runs until the button; the fix is a precise one on purpose.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 40.753612, longitude: -73.983244 } }) },
        configurable: true,
      })
    })
    await page.clock.setFixedTime(new Date(2026, 0, 4, 12, 0)) // a park day
    const sent: any[] = []
    await page.route('**/api/public/places', (route) => {
      sent.push(route.request().postDataJSON())
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { local_results: [{ title: 'Corner Park', place_id: 'id-CornerPark', gps_coordinates: { latitude: 40.7545, longitude: -73.982 }, rating: 4.6, type: 'Park', address: '12 Quiet Street' }] } }),
      })
    })
    await page.goto('/home')
    const section = page.getByTestId('home-place')
    await expect(section.getByText('A change of scenery')).toBeVisible()
    expect(sent).toHaveLength(0) // nothing is asked or searched before the person presses
    await section.getByRole('button', { name: 'Share my location' }).click()
    await expect(section.getByTestId('place-line')).toContainText('Corner Park')
    await expect(section.getByRole('link', { name: 'Open in Google Maps' })).toBeVisible()
    await expect(section.getByRole('group', { name: /^Rate/ })).toHaveCount(0) // remembering likes needs an account
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual({ kind: 'park', lat: 40.75, lng: -73.98 })
  })

  test('Somewhere to go falls back to taking a walk when location is declined, and says so kindly when the daily limit is reached', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) },
        configurable: true,
      })
    })
    await page.reload()
    await page.getByTestId('home-place').getByRole('button', { name: 'Share my location' }).click()
    await expect(page.getByTestId('places-denied')).toContainText('Pick any direction you like')

    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: 40.75, longitude: -73.98 })
    await page.unroute('**/api/public/places')
    await page.route('**/api/public/places', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'daily_limit' }) }))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 40.75, longitude: -73.98 } }) },
        configurable: true,
      })
    })
    await page.reload()
    // Location is already allowed here, so the place is looked for on arrival.
    await expect(page.getByTestId('places-error')).toContainText("I'm resting my map")
  })

  test('sample suggestions are ready to view on arrival: one playable video and two ideas, labelled as samples', async ({ page }) => {
    await tuck(page)
    await fakeYouTube(page)
    await page.goto('/home')
    const preview = page.getByTestId('preview')
    await expect(preview.getByRole('heading', { name: 'A few ideas to try' })).toBeVisible()
    await expect(page.getByTestId('sample-note')).toContainText('These are samples, not tailored to you yet')
    await expect(page.getByTestId('sample-video')).toHaveCount(1)
    await expect(page.getByTestId('sample-idea')).toHaveCount(2)
    // The picture shows from the start, and is YouTube's standard thumbnail for the video.
    await expect(page.getByTestId('sample-video-thumb')).toHaveAttribute('src', /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/hqdefault\.jpg$/)
    await expect(page.getByTestId('sample-video').getByText('Guided video')).toBeVisible()
    await expect(page.getByTestId('sample-video').getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/)
    // It plays in the page.
    await page.getByTestId('sample-video').getByRole('button', { name: /^Watch:/ }).click()
    await expect(page.getByTestId('fake-player')).toBeVisible()
    // The ideas have their steps one tap away.
    await page.getByTestId('sample-idea').first().getByRole('button', { name: /How to do it/ }).click()
    await expect(page.getByTestId('sample-idea').first()).toContainText("You'll need:")
    // The invitation to sign in comes after the value, in the words of the plan.
    await expect(page.getByTestId('preview-signin')).toContainText('Talk it through, and keep it as a journal.')
  })

  test('"Find something to do" asks only energy and time, tailors the samples, and can be skipped', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    await expect(page.getByTestId('preview-form')).toHaveCount(0) // not forced on anyone
    await page.getByTestId('home-find').click()
    const form = page.getByTestId('preview-form')
    await expect(form).toBeVisible()
    await expect(form.getByText('How much energy do you have?')).toBeVisible()
    await expect(form.getByText('How much time do you have?')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Show me' })).toBeDisabled() // both are needed
    await form.getByText('Low', { exact: true }).click()
    await form.getByText('5 min', { exact: true }).click()
    await form.getByRole('button', { name: 'Show me' }).click()
    await expect(form).toHaveCount(0)
    await expect(page.getByTestId('sample-note')).toContainText('For low energy and about 5 minutes')
    // Only things that can be started in five minutes: the long guided videos are not offered.
    await expect(page.getByTestId('sample-video')).toContainText(/Desk stretch|Rain sounds/)
    for (const idea of await page.getByTestId('sample-idea').all()) await expect(idea).not.toContainText(/Body scan|Chair yoga/)
    // It is remembered, so a reload does not start over.
    await page.reload()
    await expect(page.getByTestId('sample-note')).toContainText('For low energy and about 5 minutes')
    // Skip closes the questions and keeps the samples.
    await page.getByTestId('home-find').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByTestId('preview-form')).toHaveCount(0)
    await expect(page.getByTestId('sample-idea')).toHaveCount(2)
  })

  test('"Show me" really changes the suggestions, they are not just the defaults again', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    const titles = async () => [await page.getByTestId('sample-video').locator('h3').innerText(), ...(await page.getByTestId('sample-idea').locator('h3').allInnerTexts())].join(' | ')
    const defaults = await titles()
    for (const [energy, time] of [['Low', '5 min'], ['Lots', '30 min'], ['Drained', '15 min']] as const) {
      await page.getByTestId('home-find').click()
      const form = page.getByTestId('preview-form')
      await form.getByText(energy, { exact: true }).click()
      await form.getByText(time, { exact: true }).click()
      await form.getByRole('button', { name: 'Show me' }).click()
      await expect(page.getByTestId('preview-form')).toHaveCount(0)
      await expect.poll(titles).not.toBe(defaults) // new activities, not the default ones
    }
    // And the choices differ from one another: low energy and 5 minutes is not what lots of energy and 30 minutes gets.
    const results: string[] = []
    for (const [energy, time] of [['Low', '5 min'], ['Lots', '30 min']] as const) {
      await page.getByTestId('home-find').click()
      const form = page.getByTestId('preview-form')
      await form.getByText(energy, { exact: true }).click()
      await form.getByText(time, { exact: true }).click()
      await form.getByRole('button', { name: 'Show me' }).click()
      await expect(page.getByTestId('sample-note')).toContainText(`${time.replace(' min', '')} minutes`)
      results.push(await titles())
    }
    expect(results[0]).not.toBe(results[1])
  })

  test('Save asks to sign in and remembers what they wanted, so signing in does not start them over', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    await page.getByTestId('home-find').click()
    await page.getByTestId('preview-form').getByText('Medium', { exact: true }).click()
    await page.getByTestId('preview-form').getByText('15 min', { exact: true }).click()
    await page.getByRole('button', { name: 'Show me' }).click()
    const idea = page.getByTestId('sample-idea').first()
    const title = await idea.locator('h3').innerText()
    await idea.getByRole('button', { name: `Save: ${title}` }).click()
    await expect(page.getByRole('dialog').or(page.getByTestId('auth-overlay')).first()).toBeVisible()
    const stored = await page.evaluate(() => ({ pending: localStorage.getItem('petirien.pendingSave'), choice: localStorage.getItem('petirien.preview') }))
    expect(JSON.parse(stored.pending!)).toMatchObject({ kind: 'idea' })
    expect(JSON.parse(stored.choice!)).toEqual({ energy: 3, minutes: 15 })
    // Only the choice is kept: nothing about how they feel, nothing they wrote.
    expect(Object.keys(JSON.parse(stored.choice!)).sort()).toEqual(['energy', 'minutes'])
  })

  test('the floating bunny introduces itself before sign-in and points to the preview', async ({ page }) => {
    await tuck(page)
    await page.goto('/home')
    const toggle = page.getByTestId('floating-toggle')
    await expect(toggle).toBeVisible()
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    await expect(page.getByTestId('bunny-words')).toContainText("Hi, I'm the bunny. Try the quick preview on Home")
  })

  test('phone width: no horizontal scroll, and the invitation is the first thing', async ({ page }) => {
    await tuck(page)
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/home')
    await expect(page.getByTestId('home-find')).toBeVisible()
    await page.getByTestId('home-find').click()
    await expect(page.getByTestId('preview-form')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('after signing in', () => {
  test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
  test.setTimeout(120_000)

  async function clearSaved(page: Page) {
    await page.goto('/saved')
    await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible()
    await page.waitForTimeout(1200)
    for (let i = 0; i < 6; i++) {
      const remove = page.getByRole('button', { name: /^Remove from saved:/ })
      if ((await remove.count()) === 0) return
      await remove.first().click()
      await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
      await page.waitForTimeout(600)
    }
  }

  test('what the visitor chose is picked up: the save is made, and the energy and time are offered back', async ({ users }) => {
    const [bob] = await users(['Bob'])
    const page = bob.page
    await tuck(page)
    await clearSaved(page)
    // The visitor pressed Save on a sample idea and a sample video's activity, after choosing low energy and 15 minutes.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('petirien.pendingSave', JSON.stringify({ kind: 'video', activityId: 'body-scan', videoId: 'aH72AScs0qk' }))
      localStorage.setItem('petirien.preview', JSON.stringify({ energy: 2, minutes: 15 }))
    })
    await page.goto('/home')
    const resume = page.getByTestId('resume')
    await expect(resume.getByTestId('resume-saved')).toContainText('Saved: Body scan', { timeout: 15_000 })
    await expect(resume.getByTestId('resume-choice')).toContainText('low energy and about 15 minutes')
    // It is gone from storage, so a reload cannot save it twice.
    expect(await page.evaluate(() => localStorage.getItem('petirien.pendingSave'))).toBeNull()
    // The save is real (database), and the Saved page shows it.
    await page.goto('/saved')
    await expect(page.getByTestId('saved-item').filter({ hasText: 'Body scan' })).toHaveCount(1, { timeout: 15_000 })
    // Continue goes to the check-in with the time and energy already chosen; mood is still theirs.
    await page.goto('/home')
    await page.evaluate(() => localStorage.setItem('petirien.preview', JSON.stringify({ energy: 2, minutes: 15 })))
    await page.reload()
    await page.getByTestId('resume-continue').click()
    await expect(page).toHaveURL(/\/checkin\?minutes=15&energy=2$/)
    await expect(page.getByRole('button', { name: 'Show me a few ideas' })).toBeDisabled() // no mood chosen yet
    await expect(page.getByRole('group', { name: 'How much energy do you have?' }).getByLabel('Low')).toBeChecked() // the energy question, not the mood one
    await page.getByRole('button', { name: /More options/ }).click()
    await expect(page.getByLabel('15 min')).toBeChecked()
    await clearSaved(page)
  })

  test('with nothing remembered, Home is just Home, and "Not now" forgets the choice', async ({ users }) => {
    const [bob] = await users(['Bob'])
    const page = bob.page
    await tuck(page)
    await page.goto('/home')
    await expect(page.getByTestId('home-hero')).toBeVisible()
    await expect(page.getByTestId('resume')).toHaveCount(0)
    await page.evaluate(() => localStorage.setItem('petirien.preview', JSON.stringify({ energy: 4, minutes: 20 })))
    await page.reload()
    await expect(page.getByTestId('resume-choice')).toContainText('good energy and about 20 minutes')
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(page.getByTestId('resume')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('petirien.preview'))).toBeNull()
  })
})
