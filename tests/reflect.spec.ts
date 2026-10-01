/**
 * Talk to the bunny and the journal, in a real browser against the REAL local
 * server and database, with no paid calls:
 *  - the two AI actions are mocked with page.route() where a reply is needed
 *    (this proves the UI and the real journal storage, NOT the model's tone);
 *  - the crisis path runs against the REAL action, which stops before any model call.
 *
 * Uses its own account (Eli) so parallel specs cannot clear its data.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts (Alice, Bob, Cara, Dana, Eli).')
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const TITLE = `A long day ${run}`

const draft = {
  title: TITLE,
  notes: ['You told me work felt heavy today.', 'You said a walk at lunch helped a little.'],
  feelings: ['tired', 'hopeful'],
  bunnyNote: 'Thanks for telling me about it.',
}

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

async function mockBunny(page: Page, handlers: { reply?: (n: number, body: any) => unknown; summary?: (n: number, body: any) => unknown } = {}) {
  const seen = { reply: [] as any[], summary: [] as any[] }
  await page.route('**/api/actions/reflectReply', async (route) => {
    const body = route.request().postDataJSON()
    seen.reply.push(body)
    await route.fulfill(json(handlers.reply ? handlers.reply(seen.reply.length, body) : { status: 'ok', reply: 'That sounds like a lot. What part felt heaviest?' }))
  })
  await page.route('**/api/actions/reflectSummary', async (route) => {
    const body = route.request().postDataJSON()
    seen.summary.push(body)
    await route.fulfill(json(handlers.summary ? handlers.summary(seen.summary.length, body) : { status: 'ok', draft }))
  })
  return seen
}

async function clearJournal(page: Page) {
  await page.goto('/journal')
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  await page.waitForTimeout(1200)
  for (let i = 0; i < 10; i++) {
    const items = page.getByTestId('journal-entry')
    if ((await items.count()) === 0) return
    await items.first().getByRole('button', { name: /Delete entry/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(500)
  }
}

async function say(page: Page, text: string) {
  await page.getByLabel('Tell the bunny something').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('chat, get notes, review, save: the entry persists, is private, counts for the calendar, and can be deleted', async ({ users }) => {
  const [eli, alice] = await users(['Eli', 'Alice'])
  await clearJournal(eli.page)
  const seen = await mockBunny(eli.page)

  await eli.page.goto('/home')
  const chat = eli.page.getByTestId('chat')
  await expect(chat).toBeVisible()
  await expect(eli.page.getByTestId('chat-note')).toContainText('AI, not a therapist')
  await expect(eli.page.getByTestId('chat-note')).toContainText('Nothing is saved unless you save')

  await say(eli.page, 'work was heavy today')
  await expect(eli.page.getByTestId('chat-bunny')).toContainText('What part felt heaviest?')
  expect(seen.reply[0]).toEqual({ messages: [{ role: 'user', text: 'work was heavy today' }] })

  await say(eli.page, 'a walk at lunch helped a little')
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(2)
  expect(seen.reply[1].messages).toHaveLength(3) // person, bunny, person

  // Notes are written only when asked, then shown for review before anything is stored.
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  const review = eli.page.getByTestId('chat-review')
  await expect(review).toContainText(TITLE)
  await expect(review).toContainText('You told me work felt heavy today.')
  await expect(review).toContainText('tired')
  expect(seen.summary[0].messages).toHaveLength(4)
  await eli.page.goto('/journal') // leaving without saving
  await expect(eli.page.getByTestId('journal-empty')).toBeVisible({ timeout: 15_000 })

  // Do it again and actually save.
  await mockBunny(eli.page).catch(() => undefined)
  await eli.page.goto('/home')
  await say(eli.page, 'work was heavy today')
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  await expect(eli.page.getByTestId('chat-review')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  await expect(eli.page.getByTestId('chat-saved')).toBeVisible()

  // Persisted in the real database; the chat itself is not.
  await eli.page.goto('/journal')
  const entry = eli.page.getByTestId('journal-entry').filter({ hasText: TITLE })
  await expect(entry).toHaveCount(1, { timeout: 15_000 })
  await expect(entry).toContainText('You said a walk at lunch helped a little.')
  await expect(entry).toContainText('Thanks for telling me about it.')
  await expect(eli.page.getByText('work was heavy today', { exact: true })).toHaveCount(0) // the person's own words are not stored

  // The calendar counts a saved entry as a day.
  await eli.page.goto('/home')
  await expect(eli.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(1, { timeout: 15_000 })

  // Private.
  await alice.page.goto('/journal')
  await expect(alice.page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await expect(alice.page.getByText(TITLE)).toHaveCount(0)

  await clearJournal(eli.page)
  await expect(eli.page.getByTestId('journal-empty')).toBeVisible({ timeout: 15_000 })
})

test('discard and start over store nothing', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearJournal(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/home')
  await say(eli.page, 'just a passing thought')
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  await expect(eli.page.getByTestId('chat-review')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Discard' }).click()
  await expect(eli.page.getByTestId('chat-log')).toHaveCount(0) // back to the start
  await eli.page.goto('/journal')
  await expect(eli.page.getByTestId('journal-empty')).toBeVisible({ timeout: 15_000 })
})

test('"Keep chatting" returns to the conversation with everything still there', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page)
  await eli.page.goto('/home')
  await say(eli.page, 'one more thing')
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  await expect(eli.page.getByTestId('chat-review')).toBeVisible()
  await eli.page.getByRole('button', { name: 'Keep chatting' }).click()
  await expect(eli.page.getByTestId('chat-user')).toContainText('one more thing')
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
})

test('a starter chip sends a message', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/home')
  await eli.page.getByRole('button', { name: "Something's on my mind" }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  expect(seen.reply[0].messages[0]).toEqual({ role: 'user', text: "Something's on my mind" })
})

test('crisis words on the REAL server show the support card, with no bunny reply and nothing saved', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearJournal(eli.page)
  await eli.page.goto('/home') // no mocks: the real action stops before any model call
  await say(eli.page, 'I want to kill myself')
  const card = eli.page.getByTestId('chat-support')
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card.getByRole('link', { name: 'Call 988' })).toHaveAttribute('href', 'tel:988')
  await expect(card.getByText('Text HOME to 741741')).toBeVisible()
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(0)
  await eli.page.goto('/journal')
  await expect(eli.page.getByTestId('journal-empty')).toBeVisible({ timeout: 15_000 })
})

test('the model flagging a crisis also shows the support card', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page, { reply: () => ({ status: 'support' }) })
  await eli.page.goto('/home')
  await say(eli.page, 'everything feels pointless lately')
  await expect(eli.page.getByTestId('chat-support')).toBeVisible()
})

test('failures keep what you wrote and say what to do; retry works', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page, {
    reply: (n) => (n === 1 ? { status: 'error', message: "I couldn't answer just now. Your message is still here, so you can send it again." } : { status: 'ok', reply: 'I am here now.' }),
    summary: (n) => (n === 1 ? { status: 'error', message: "I couldn't write the notes just now. Your chat is still here, so you can try again." } : { status: 'ok', draft }),
  })
  await eli.page.goto('/home')
  await say(eli.page, 'testing a failure')
  await expect(eli.page.getByTestId('chat-error')).toContainText('still here')
  await expect(eli.page.getByTestId('chat-user')).toContainText('testing a failure') // not lost
  await eli.page.getByRole('button', { name: 'Try again' }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toContainText('I am here now.')
  await expect(eli.page.getByTestId('chat-error')).toHaveCount(0)

  await eli.page.getByRole('button', { name: 'Save to my journal' }).click()
  await expect(eli.page.getByTestId('chat-error')).toContainText('Your chat is still here')
  await eli.page.getByRole('button', { name: 'Save to my journal' }).click() // try again
  await expect(eli.page.getByTestId('chat-review')).toBeVisible()
})

test('the daily limit is explained kindly', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page, { reply: () => ({ status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' }) })
  await eli.page.goto('/home')
  await say(eli.page, 'hello')
  await expect(eli.page.getByTestId('chat-error')).toContainText("That's enough chatting for today")
})

test('phone width: chat and journal have no horizontal scroll', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await eli.page.setViewportSize({ width: 375, height: 800 })
  await mockBunny(eli.page)
  const overflow = () => eli.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await eli.page.goto('/home')
  await say(eli.page, 'a fairly long message to see how it wraps on a small screen without breaking the layout at all')
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await eli.page.goto('/journal')
  await expect(eli.page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
