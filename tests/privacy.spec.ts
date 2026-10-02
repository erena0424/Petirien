/**
 * The privacy page: readable without signing in, honest about the data flows,
 * linked from the places people will look, and static (no auth call, no websocket).
 *
 * Does NOT prove the page is legally sufficient (it is plain-language product
 * copy, not legal advice), only that it exists, says what the app does, and is
 * reachable.
 */
import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

test('privacy page loads signed out with no errors, no auth call, and no websocket', async ({ page }) => {
  const errors = captureConsoleErrors(page)
  const offenders: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/auth/')) offenders.push(r.url())
  })
  page.on('websocket', (ws) => {
    if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
  })
  await page.goto('/privacy')
  await expect(page.getByTestId('privacy-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible()
  expect(offenders).toEqual([])
  expect(errors).toEqual([])
})

test('it says what is saved, where words go, and how to delete', async ({ page }) => {
  await page.goto('/privacy')
  const body = page.getByTestId('privacy-page')
  for (const phrase of [
    'your optional note',
    'Your conversations with the bunny',
    "Don't save this chat",
    'does not keep a hidden profile',
    "Anthropic's Claude",
    'fixed search phrases',
    'Places near you (optional)',
    'rounded to about a kilometre',
    'Google Calendar (optional)',
    'never changes your calendar',
    'never sent to the AI',
    'Reflect on this',
    'Delete everything',
    'Only you',
    'not therapy or medical advice',
    'Journal notes',
    'Your preferences',
    'Places you mark good, not right now, or never',
    'Reflections you write about a plan',
    'how you like the bunny to talk',
    'A simple count of how many times',
    'Your check-ins',
    'Videos and ideas you save',
    'not a person and not a therapist',
    '988',
    '741741',
  ]) {
    await expect(body).toContainText(phrase)
  }
})

test('it links to YouTube Terms and the Google Privacy Policy, and opens them safely', async ({ page }) => {
  await page.goto('/privacy')
  const terms = page.getByRole('link', { name: 'YouTube Terms of Service' })
  await expect(terms).toHaveAttribute('href', 'https://www.youtube.com/t/terms')
  await expect(terms).toHaveAttribute('rel', /noopener/)
  const policy = page.getByRole('link', { name: 'Privacy Policy' })
  await expect(policy).toHaveAttribute('href', 'https://policies.google.com/privacy')
  await expect(policy).toHaveAttribute('rel', /noopener/)
})

test('it is linked from the landing page and from the app footer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('static-landing').getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  await page.goto('/home')
  await expect(page.getByTestId('footer-privacy')).toBeVisible()
  await page.getByTestId('footer-privacy').click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByTestId('privacy-page')).toBeVisible()
})

test('phone width: no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/privacy')
  await expect(page.getByTestId('privacy-page')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
