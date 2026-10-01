/**
 * The big bunny on Home, saved-by-default conversations, the Messages tab, and
 * the private option, in a real browser against the REAL local server and
 * database, with no paid calls:
 *  - reflectReply and summarizeConversation are mocked with page.route() where a
 *    model would answer (this proves the UI and the real storage of messages and
 *    conversations, NOT the model's tone, and NOT the server's automatic-note
 *    database writes, which are covered by unit tests with fakes);
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
const FIRST = `work was heavy today ${run}`

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

type Seen = { reply: any[]; notes: any[] }
async function mockBunny(page: Page, over: { reply?: (n: number, body: any) => unknown } = {}): Promise<Seen> {
  const seen: Seen = { reply: [], notes: [] }
  await page.route('**/api/actions/reflectReply', async (route) => {
    const body = route.request().postDataJSON()
    seen.reply.push(body)
    await route.fulfill(json(over.reply ? over.reply(seen.reply.length, body) : { status: 'ok', reply: `That sounds like a lot. What part felt heaviest? (${seen.reply.length})` }))
  })
  await page.route('**/api/actions/summarizeConversation', async (route) => {
    seen.notes.push(route.request().postDataJSON())
    await route.fulfill(json({ status: 'ok' }))
  })
  return seen
}

async function clearConversations(page: Page) {
  await page.goto('/messages')
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()
  await page.waitForTimeout(1500)
  for (let i = 0; i < 10; i++) {
    const items = page.getByTestId('conversation-item')
    if ((await items.count()) === 0) return
    await page.getByRole('button', { name: /Delete conversation/ }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(700)
  }
}

async function sayOnHome(page: Page, text: string) {
  await page.getByLabel('Tell the bunny something').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('Home is a very big bunny with its words: a greeting first, then its latest reply, with no chat card', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearConversations(eli.page)
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/home')

  const words = eli.page.getByTestId('bunny-words')
  await expect(words).toContainText(/Say something/)
  await expect(eli.page.getByTestId('chat-log')).toHaveCount(0) // the log lives on Messages, not here
  await expect(eli.page.getByTestId('chat')).not.toContainText('not a therapist') // the AI note is in the footer
  await expect(eli.page.getByRole('contentinfo')).toContainText('The bunny is an AI')

  await sayOnHome(eli.page, FIRST)
  await expect(words).toContainText('What part felt heaviest? (1)')
  expect(seen.reply[0]).toEqual({ messages: [{ role: 'user', text: FIRST }] })

  await sayOnHome(eli.page, 'a walk at lunch helped a little')
  await expect(words).toContainText('(2)') // the words always show the latest reply
  expect(seen.reply[1].messages).toHaveLength(3)
})

test('conversations are saved by default, listed on Messages, readable after a reload, and private to the account', async ({ users }) => {
  const [eli, alice] = await users(['Eli', 'Alice'])
  await clearConversations(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/home')
  await sayOnHome(eli.page, FIRST)
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await expect(eli.page.getByTestId('chat-private-note')).toContainText('Saved to Messages')

  await eli.page.goto('/messages')
  const item = eli.page.getByTestId('conversation-item').filter({ hasText: FIRST })
  await expect(item).toHaveCount(1, { timeout: 15_000 })

  // After a full reload the conversation is still there and opens with both messages (real database).
  await eli.page.reload()
  await eli.page.getByTestId('conversation-item').filter({ hasText: FIRST }).click()
  await expect(eli.page.getByTestId('chat-user')).toContainText(FIRST)
  await expect(eli.page.getByTestId('chat-bunny')).toContainText('What part felt heaviest?')

  // Private: Alice sees none of it.
  await alice.page.goto('/messages')
  await expect(alice.page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await expect(alice.page.getByText(FIRST)).toHaveCount(0)
})

test('a conversation can be continued from Messages like texting', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByTestId('conversation-item').filter({ hasText: FIRST }).click()
  await eli.page.getByLabel('Tell the bunny something').fill('and then I felt a bit better')
  await eli.page.getByRole('button', { name: 'Send' }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(2)
  // The model sees the earlier saved messages, not just the new one.
  expect(seen.reply[0].messages.map((m: any) => m.role)).toEqual(['user', 'bunny', 'user'])
  await eli.page.reload()
  await eli.page.getByTestId('conversation-item').filter({ hasText: FIRST }).click()
  await expect(eli.page.getByTestId('chat-user')).toHaveCount(2)
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(2)
})

test('"Don\'t save this chat" stores nothing and says so', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearConversations(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/home')
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'something I want to keep to myself')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await expect(eli.page.getByTestId('chat-private-note')).toContainText('not being saved')

  await eli.page.goto('/messages')
  await expect(eli.page.getByTestId('messages-empty')).toBeVisible({ timeout: 15_000 })
  await eli.page.reload()
  await expect(eli.page.getByTestId('messages-empty')).toBeVisible({ timeout: 15_000 })
  await expect(eli.page.getByText('something I want to keep to myself')).toHaveCount(0)
})

test('starting a new conversation keeps the old one, and asks for notes about the one you left', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearConversations(eli.page)
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByLabel('Tell the bunny something').fill(FIRST)
  await eli.page.getByRole('button', { name: 'Send' }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  await expect(eli.page.getByTestId('conversation-item')).toHaveCount(1, { timeout: 15_000 })

  // Asking for notes right now sends the open conversation's id with force (the person asked).
  await eli.page.getByRole('button', { name: 'Write notes about this now' }).click()
  await expect(eli.page.getByTestId('notes-written')).toBeVisible()
  expect(seen.notes[0]).toMatchObject({ force: true })
  expect(typeof seen.notes[0].conversationId).toBe('string')
  const oldId = seen.notes[0].conversationId

  // New conversation: the chat clears, the old one stays listed, notes are requested for the one left.
  await eli.page.getByRole('button', { name: 'New conversation' }).click()
  await expect(eli.page.getByTestId('chat-log')).toHaveCount(0)
  await expect(eli.page.getByTestId('conversation-item')).toHaveCount(1)
  expect(seen.notes[1]).toEqual({ conversationId: oldId, force: true })

  await eli.page.getByLabel('Tell the bunny something').fill('a second, different thing')
  await eli.page.getByRole('button', { name: 'Send' }).click()
  await expect(eli.page.getByTestId('conversation-item')).toHaveCount(2, { timeout: 15_000 })
})

test('deleting a conversation removes it and its messages for good', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await expect(eli.page.getByTestId('conversation-item').first()).toBeVisible({ timeout: 15_000 })
  await clearConversations(eli.page)
  await eli.page.reload()
  await expect(eli.page.getByTestId('messages-empty')).toBeVisible({ timeout: 15_000 })
  await eli.page.goto('/home') // a fresh chat there starts from the greeting, nothing carried over
  await expect(eli.page.getByTestId('bunny-words')).toContainText(/Say something/)
})

test('a saved conversation counts as a day on the calendar', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearConversations(eli.page)
  await eli.page.goto('/home')
  await expect(eli.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(0, { timeout: 15_000 })
  await mockBunny(eli.page)
  await sayOnHome(eli.page, 'counting for the calendar')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await eli.page.goto('/home')
  await expect(eli.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(1, { timeout: 15_000 })
  await clearConversations(eli.page)
})

test('crisis words on the REAL server show the support card on Home, with no bunny reply', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await clearConversations(eli.page)
  await eli.page.goto('/home') // no mocks: the real action stops before any model call
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'I want to kill myself')
  const card = eli.page.getByTestId('chat-support')
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card.getByRole('link', { name: 'Call 988' })).toHaveAttribute('href', 'tel:988')
  await expect(card.getByText('Text HOME to 741741')).toBeVisible()
  await expect(eli.page.getByTestId('bunny-words')).toHaveCount(0)
})

test('the model flagging a crisis also shows the support card', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page, { reply: () => ({ status: 'support' }) })
  await eli.page.goto('/home')
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'everything feels pointless lately')
  await expect(eli.page.getByTestId('chat-support')).toBeVisible()
})

test('failures keep what you wrote and offer Try again; the daily limit is explained kindly', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await mockBunny(eli.page, {
    reply: (n) =>
      n === 1
        ? { status: 'error', message: "I couldn't answer just now. Your message is still here, so you can send it again." }
        : n === 2
          ? { status: 'ok', reply: 'I am here now.' }
          : { status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' },
  })
  await eli.page.goto('/home')
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'testing a failure')
  await expect(eli.page.getByTestId('chat-error')).toContainText('still here')
  await eli.page.getByRole('button', { name: 'Try again' }).click()
  await expect(eli.page.getByTestId('bunny-words')).toContainText('I am here now.')
  await expect(eli.page.getByTestId('chat-error')).toHaveCount(0)
  await sayOnHome(eli.page, 'and once more')
  await expect(eli.page.getByTestId('chat-error')).toContainText("That's enough chatting for today")
})

test('phone width: Home, Messages, and the thread have no horizontal scroll', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await eli.page.setViewportSize({ width: 375, height: 800 })
  await mockBunny(eli.page)
  const overflow = () => eli.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await eli.page.goto('/home')
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'a fairly long message to see how it wraps on a small screen without breaking the layout at all')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  expect(await overflow()).toBeLessThanOrEqual(0)
  await eli.page.goto('/messages')
  await expect(eli.page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
