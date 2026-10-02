/**
 * Ideas for right now on Home, in a real browser against the REAL local database, with the server's answer MOCKED
 * (no YouTube or model call). Proves that a brand new account sees real video ideas with pictures showing from
 * the start, that saving works and persists, and that Home stays whole when the ideas cannot load. It does NOT
 * prove the real search (src/recommend/home.test.ts covers the choosing and the cache with fakes).
 * Uses its own account (Bob); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { HOME_IDEAS_FIXTURE, tuck } from './tuck'
import type { Page } from '@playwright/test'

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

test('someone who has never saved or checked in sees two video ideas with pictures, and can save one', async ({ users }) => {
  const [bob] = await users(['Bob'])
  const page = bob.page
  await tuck(page)
  await clearSaved(page)
  await page.goto('/home')

  const ideas = page.getByTestId('home-idea')
  await expect(ideas).toHaveCount(2)
  await expect(page.getByTestId('home-saved-empty')).toBeVisible() // nothing saved, yet ideas are here
  // The pictures are showing without anyone pressing anything.
  const thumbs = page.getByTestId('home-idea-thumb')
  await expect(thumbs).toHaveCount(2)
  for (const t of await thumbs.all()) await expect(t).toBeVisible()
  await expect(ideas.first()).toContainText('Ten minute body scan')
  await expect(ideas.first()).toContainText('10 min')
  await expect(ideas.first()).toContainText('Calm Channel')
  await expect(ideas.first().getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', /youtube\.com\/watch\?v=homevid0001/)
  await expect(ideas.first().getByRole('button', { name: /^Watch:/ })).toBeVisible()

  // The steps are one tap away, and Save persists.
  await ideas.first().getByRole('button', { name: /How to do it/ }).click()
  await expect(ideas.first()).toContainText("You'll need:")
  const save = ideas.first().getByRole('button', { name: 'Save: Ten minute body scan' })
  await expect(save).toBeEnabled()
  await save.click()
  await expect(ideas.first().getByRole('button', { name: /Remove from saved/ })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/saved')
  await expect(page.getByTestId('saved-item').filter({ hasText: 'Ten minute body scan' })).toHaveCount(1, { timeout: 15_000 })
  await clearSaved(page)
})

test('when the ideas cannot load, Home is still whole and says nothing alarming', async ({ users }) => {
  const [bob] = await users(['Bob'])
  const page = bob.page
  await tuck(page)
  await page.route('**/api/actions/homeIdeas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { status: 'error', message: 'x' } }) }))
  await page.goto('/home')
  await expect(page.getByTestId('home-hero')).toBeVisible()
  await expect(page.getByTestId('for-now')).toBeVisible() // the written suggestion is always there
  await expect(page.getByTestId('home-idea')).toHaveCount(0)
  await expect(page.getByTestId('home-ideas')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('ideas without a video (YouTube did not answer) still show their steps', async ({ users }) => {
  const [bob] = await users(['Bob'])
  const page = bob.page
  await tuck(page)
  const plain = { ...HOME_IDEAS_FIXTURE, ideas: HOME_IDEAS_FIXTURE.ideas.map((i) => ({ ...i, video: null })) }
  await page.route('**/api/actions/homeIdeas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: plain }) }))
  await page.goto('/home')
  await expect(page.getByTestId('home-idea')).toHaveCount(2)
  await expect(page.getByTestId('home-idea-thumb')).toHaveCount(0)
  await expect(page.getByTestId('home-idea').first()).toContainText('Body scan')
  await expect(page.getByRole('button', { name: /^Watch:/ })).toHaveCount(0)
  await page.getByTestId('home-idea').first().getByRole('button', { name: /How to do it/ }).click()
  await expect(page.getByTestId('home-idea').first()).toContainText("You'll need:")
})

test('signed out: Home shows what the site offers and invites sign-in instead of waiting forever or doing nothing', async ({ page }) => {
  await tuck(page)
  await page.goto('/home')
  await expect(page.getByTestId('home-hero')).toBeVisible()
  await expect(page.getByTestId('for-now')).toBeVisible() // the written suggestion is there for everyone
  await page.waitForTimeout(1500)
  await expect(page.getByText('Finding a couple of things for you')).toHaveCount(0) // no endless loading
  // Generic ideas for right now: two, with their steps and no video, so nothing is spent before anyone signs in.
  const ideas = page.getByTestId('home-idea')
  await expect(ideas).toHaveCount(2)
  await expect(page.getByTestId('home-idea-thumb')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Watch:/ })).toHaveCount(0)
  await expect(page.getByTestId('home-ideas-signin')).toContainText('Sign in and')
  await ideas.first().getByRole('button', { name: /How to do it/ }).click()
  await expect(ideas.first()).toContainText("You'll need:")
  // Plans and places ask for sign-in, and the buttons do something.
  const plans = page.getByTestId('plans')
  await expect(plans).toContainText('Sign in to see')
  await expect(plans.getByRole('button', { name: 'Show my plans' })).toHaveCount(0)
  await expect(plans.getByRole('button', { name: 'Share a plan' })).toHaveCount(0)
  await expect(page.getByTestId('home-place').getByRole('button', { name: 'Share my location' })).toHaveCount(0)
  await page.getByTestId('home-place').getByRole('button', { name: 'Sign in to see places' }).click()
  await expect(page.getByRole('dialog').or(page.getByTestId('auth-overlay')).first()).toBeVisible()
})
