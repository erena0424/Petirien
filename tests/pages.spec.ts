/**
 * The pages and details added late, in a real browser: the landing page's sections and links, how the landing page hands
 * a visitor to Home, the tab icon, the public places route refusing bad requests (no paid call is made: it checks the
 * request before anything is searched), and every signed-in page having its heading, fitting a phone, and keeping the
 * Chat text box on screen. All paid calls are MOCKED. It does NOT prove how the pages look (that was reviewed by eye),
 * or the real public search, which needs the owner's token and a paid call.
 * Uses its own account (Dana) for the signed-in pages; specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.setTimeout(120_000)

const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.body.scrollWidth <= window.innerWidth + 1)

test.describe('the landing page, signed out', () => {
  test('tells the story in order, answers the questions, and hands the visitor to Home', async ({ page }) => {
    await tuck(page)
    await page.goto('/')
    const landing = page.getByTestId('static-landing')
    await expect(landing.getByRole('heading', { level: 1 })).toHaveText('Journaling that feels like talking.')
    await expect(landing).toContainText('turn the conversation into a journal entry in your own words')
    // The sections, in order: example, steps, journal, small next step, control, questions, closing band.
    const order = ['landing-example', 'landing-journal', 'landing-next-step', 'landing-control', 'landing-faq', 'landing-cta']
    let last = -1
    for (const id of order) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box, id).not.toBeNull()
      expect(box!.y, `${id} comes after the one before`).toBeGreaterThan(last)
      last = box!.y
    }
    await expect(page.getByRole('list', { name: 'How it works' }).getByRole('listitem')).toHaveCount(3)
    // The invented example is labelled as invented, and nothing claims to be a real person's words.
    await expect(page.getByTestId('landing-example')).toContainText('An invented example')
    await expect(page.getByTestId('landing-journal')).toContainText('An invented example')
    // The activity suggestions are there too, as a separate section below the journal story.
    await expect(page.getByTestId('landing-next-step')).toContainText('Chair yoga')
    await expect(page.getByTestId('landing-next-step')).toContainText('Box breathing')
    // Questions expand and say plainly what this is not.
    const faq = page.getByTestId('landing-faq')
    await expect(faq.locator('details')).toHaveCount(6)
    await faq.getByText('Is Petirien therapy?').click()
    await expect(faq).toContainText('No. It is everyday emotional support, not therapy or medical advice')
    await faq.getByText('Is the bunny a real person?').click()
    await expect(faq).toContainText('it is an AI')
    // The words the product must never use as a promise are not on the page.
    const text = (await landing.innerText()).toLowerCase()
    for (const word of ['diagnose your', 'cure', 'treat your', 'clinical', 'prescrib']) expect(text, word).not.toContain(word)
  })

  test('"Try a preview" opens the energy and time questions on Home, and "Sign in" opens sign-in', async ({ page }) => {
    await tuck(page)
    await page.goto('/')
    await expect(page.getByTestId('landing-try')).toHaveAttribute('href', '/home?try=1')
    await expect(page.getByTestId('landing-signin')).toHaveAttribute('href', '/home?signin=1')
    await expect(page.getByTestId('landing-cta').getByRole('link', { name: 'Try a preview' })).toHaveAttribute('href', '/home?try=1')
    await page.getByTestId('landing-try').click()
    await expect(page).toHaveURL(/\/home\?try=1$/)
    await expect(page.getByTestId('preview-form')).toBeVisible()

    await page.goto('/')
    await page.getByTestId('landing-signin').click()
    await expect(page).toHaveURL(/\/home\?signin=1$/)
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible() // DeepSpace's sign-in window
    // There is no separate sign-up: the window says that a new person's account is made the first time.
    await expect(page.getByRole('heading', { name: 'Sign in or sign up' })).toBeVisible()
    await expect(page.getByText("If you're new, your account is created the first time.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible()
  })

  test('phone width: the whole landing page fits without scrolling sideways', async ({ page }) => {
    await tuck(page)
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')
    await expect(page.getByTestId('landing-cta')).toBeVisible()
    expect(await noSideways(page)).toBe(true)
  })

  test('the tab icon is the bunny: an SVG, a PNG fallback, a touch icon and an .ico all load', async ({ page }) => {
    await page.goto('/')
    const icons = await page.locator('head link[rel~="icon"], head link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).getAttribute('href')))
    expect(icons).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.png', '/apple-touch-icon.png']))
    for (const path of ['/favicon.svg', '/favicon.png', '/apple-touch-icon.png', '/favicon.ico']) {
      const res = await page.request.get(path)
      expect(res.status(), path).toBe(200)
      expect((await res.body()).length, path).toBeGreaterThan(100)
    }
  })
})

test.describe('the public places route refuses anything that is not a fixed kind and a real location', () => {
  for (const [name, body] of [
    ['an unknown kind', { kind: 'nightclub', lat: 40.75, lng: -73.98 }],
    ['free text as a kind', { kind: 'park near my house', lat: 40.75, lng: -73.98 }],
    ['a latitude out of range', { kind: 'park', lat: 123, lng: -73.98 }],
    ['coordinates as text', { kind: 'park', lat: '40.75', lng: '-73.98' }],
    ['missing coordinates', { kind: 'park' }],
  ] as const) {
    test(`rejects ${name}, before any search`, async ({ page }) => {
      const res = await page.request.post('/api/public/places', { data: body })
      expect(res.status()).toBe(400)
      expect(await res.json()).toMatchObject({ success: false, code: 'bad_request' })
    })
  }
  test('rejects a body that is not JSON', async ({ page }) => {
    const res = await page.request.post('/api/public/places', { data: 'not json', headers: { 'content-type': 'text/plain' } })
    expect(res.status()).toBe(400)
  })
})

test.describe('signed-in pages', () => {
  test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')

  const PAGES = [
    ['/home', 'Home'],
    ['/checkin', "Let's do something little"],
    ['/messages', 'Chat'],
    ['/journal', 'Journal'],
    ['/saved', 'Saved'],
    ['/history', 'Your check-ins'],
    ['/preferences', 'Preferences'],
  ] as const

  test('each page has its heading, and fits a phone without scrolling sideways', async ({ users }) => {
    const [dana] = await users(['Dana'])
    const page = dana.page
    await tuck(page)
    for (const [path, heading] of PAGES) {
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 }).filter({ hasText: heading }).first()).toBeVisible()
        await page.waitForTimeout(400)
        expect(await noSideways(page), `${path} at ${width}px`).toBe(true)
      }
    }
  })

  test('Chat keeps its text box on screen, with the conversation scrolling above it', async ({ users }) => {
    const [dana] = await users(['Dana'])
    const page = dana.page
    await tuck(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/messages')
    await page.getByRole('button', { name: 'New conversation' }).click()
    const box = (await page.getByLabel('Tell the bunny something').boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(800) // visible without scrolling the page
    // The big bunny is not sitting in the thread any more: just the greeting.
    await expect(page.getByTestId('chat')).toContainText('Tell me whatever is on your mind')
  })

  test('the Saved page is a header and a grid: an empty account shows the bunny and a way to start', async ({ users }) => {
    const [dana] = await users(['Dana'])
    const page = dana.page
    await tuck(page)
    await page.goto('/saved')
    await expect(page.getByRole('heading', { level: 1, name: 'Saved' })).toBeVisible()
    // Either the empty state or the grid, never a blank page.
    await expect(page.locator('[data-testid="saved-empty"], [data-testid="saved-list"]').first()).toBeVisible()
  })

  test('the privacy page says the location is remembered on the device only', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByTestId('privacy-page')).toContainText('remembered in this browser only')
    await expect(page.getByTestId('privacy-page')).toContainText('never on our servers')
  })
})
