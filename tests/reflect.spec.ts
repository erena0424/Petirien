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
import { tuck } from './tuck'
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
  await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible()
  await page.waitForTimeout(1500)
  for (let i = 0; i < 10; i++) {
    const items = page.getByTestId('conversation-item')
    if ((await items.count()) === 0) return
    await page.getByRole('button', { name: /Delete conversation/ }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(700)
  }
}

/** Home no longer has a chat card: the floating bunny is on it, so open its panel. */
async function openHome(page: Page) {
  await page.goto('/home')
  await openPanel(page)
}
async function openPanel(page: Page) {
  // Wait for the bunny, then use its own open/closed state (a computer shows the chat by default, a phone does not).
  const toggle = page.getByTestId('floating-toggle')
  await expect(toggle.or(page.getByTestId('floating-panel')).first()).toBeVisible() // on a phone the bunny hides while the sheet is open
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await expect(page.getByTestId('floating-panel')).toBeVisible()
}

async function sayOnHome(page: Page, text: string) {
  await openPanel(page)
  await page.getByLabel('Tell the bunny something').fill(text)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
}

test('Home has the floating bunny with its words beside it: a greeting first, then its latest reply, with no chat card', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await clearConversations(eli.page)
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/home')

  // Home has its own big bunny, so the floating chat starts folded away there until the person opens it.
  await expect(eli.page.getByTestId('home-hero')).toBeVisible()
  await expect(eli.page.getByTestId('floating-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(eli.page.getByTestId('bunny-words')).toHaveCount(0)
  await openPanel(eli.page)
  const words = eli.page.getByTestId('bunny-words')
  await expect(words).toContainText(/Say something/)
  await expect(eli.page.getByTestId('chat-log')).toHaveCount(0) // the log lives on Messages, not here
  await expect(eli.page.getByTestId('chat')).toHaveCount(0) // no fixed chat card on Home any more

  // The words sit to the RIGHT of the bunny (side by side, not below) in their lavender bubble.
  const bunnyBox = (await eli.page.getByTestId('floating-toggle').boundingBox())!
  const wordsBox = (await words.boundingBox())!
  expect(wordsBox.x).toBeGreaterThanOrEqual(bunnyBox.x + bunnyBox.width - 2)
  expect(await words.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)') // keeps its lavender bubble
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
  await tuck(eli.page)
  await tuck(alice.page)
  await clearConversations(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
  await sayOnHome(eli.page, FIRST)
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await expect(eli.page.getByTestId('chat-private-note')).toContainText('Saved to Chat')

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
  await expect(alice.page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await expect(alice.page.getByText(FIRST)).toHaveCount(0)
})

test('a conversation can be continued from Messages like texting', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByTestId('conversation-item').filter({ hasText: FIRST }).click()
  await eli.page.getByLabel('Tell the bunny something').fill('and then I felt a bit better')
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
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
  await tuck(eli.page)
  await clearConversations(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
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
  await tuck(eli.page)
  await clearConversations(eli.page)
  const seen = await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByLabel('Tell the bunny something').fill(FIRST)
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toBeVisible()
  await expect(eli.page.getByTestId('conversation-item')).toHaveCount(1, { timeout: 15_000 })

  // Asking for notes right now sends the open conversation's id with force (the person asked).
  await eli.page.getByRole('button', { name: 'Turn this conversation into journal' }).click()
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
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(eli.page.getByTestId('conversation-item')).toHaveCount(2, { timeout: 15_000 })
})

test('deleting a conversation removes it and its messages for good', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await expect(eli.page.getByTestId('conversation-item').first()).toBeVisible({ timeout: 15_000 })
  await clearConversations(eli.page)
  await eli.page.reload()
  await expect(eli.page.getByTestId('messages-empty')).toBeVisible({ timeout: 15_000 })
  await openHome(eli.page) // a fresh chat there starts from the greeting, nothing carried over
  await expect(eli.page.getByTestId('bunny-words')).toContainText(/Say something/)
})

test('a saved conversation counts as a day on the calendar', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await clearConversations(eli.page)
  await openHome(eli.page)
  await expect(eli.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(0, { timeout: 15_000 })
  await mockBunny(eli.page)
  await sayOnHome(eli.page, 'counting for the calendar')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await openHome(eli.page)
  await expect(eli.page.getByTestId('calendar').locator('[data-done]')).toHaveCount(1, { timeout: 15_000 })
  await clearConversations(eli.page)
})

test('crisis words on the REAL server show the support card on Home, with no bunny reply', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await clearConversations(eli.page)
  await openHome(eli.page) // no mocks: the real action stops before any model call
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
  await tuck(eli.page)
  await mockBunny(eli.page, { reply: () => ({ status: 'support' }) })
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'everything feels pointless lately')
  await expect(eli.page.getByTestId('chat-support')).toBeVisible()
})

test('failures keep what you wrote and offer Try again; the daily limit is explained kindly', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await mockBunny(eli.page, {
    reply: (n) =>
      n === 1
        ? { status: 'error', message: "I couldn't answer just now. Your message is still here, so you can send it again." }
        : n === 2
          ? { status: 'ok', reply: 'I am here now.' }
          : { status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' },
  })
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'testing a failure')
  await expect(eli.page.getByTestId('chat-error')).toContainText('still here')
  await eli.page.getByRole('button', { name: 'Try again' }).click()
  await expect(eli.page.getByTestId('bunny-words')).toContainText('I am here now.')
  await expect(eli.page.getByTestId('chat-error')).toHaveCount(0)
  await sayOnHome(eli.page, 'and once more')
  await expect(eli.page.getByTestId('chat-error')).toContainText("That's enough chatting for today")
})

test('the text box grows as you type, stops growing at a limit, and shrinks back after sending', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  const box = eli.page.getByLabel('Tell the bunny something')
  const height = async () => (await box.boundingBox())!.height

  const one = await height()
  await box.fill('line one\nline two\nline three\nline four\nline five')
  const five = await height()
  expect(five).toBeGreaterThan(one + 40) // grew with the text

  await box.fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n'))
  const forty = await height()
  expect(forty).toBeLessThan(260) // capped, then it scrolls
  expect(await box.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

  await box.fill('hello')
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  expect(Math.abs((await height()) - one)).toBeLessThan(4) // back to one line
})

test('Shift+Enter makes a new line and Enter sends', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  const seen = await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  const box = eli.page.getByLabel('Tell the bunny something')
  await box.click()
  await box.pressSequentially('first')
  await box.press('Shift+Enter')
  await box.pressSequentially('second')
  await box.press('Enter')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  expect(seen.reply[0].messages[0].text).toBe('first\nsecond')
})

test('a new empty conversation has no big empty block under the text box (the card is tall on purpose, controls sit at its bottom)', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByRole('button', { name: 'New conversation' }).click()
  const thread = eli.page.getByTestId('chat')
  await expect(thread).toBeVisible()
  const card = thread.locator('xpath=ancestor::div[contains(@class,"bg-card")][1]') // the white card around the bunny and the chat
  const cardBox = (await card.boundingBox())!
  const checkbox = (await eli.page.getByLabel("Don't save this chat").boundingBox())!
  // The card is tall on purpose (the chat gets the page), but nothing empty hangs below the last control.
  expect(cardBox.y + cardBox.height - (checkbox.y + checkbox.height)).toBeLessThan(60)
})


async function forgetStyle(page: Page) {
  await page.goto('/preferences')
  await expect(page.getByTestId('bunny-style')).toBeVisible()
  await page.waitForTimeout(1200)
  const btn = page.getByRole('button', { name: 'Forget all of these' })
  if (await btn.isEnabled()) {
    await btn.click()
    await expect(page.getByTestId('style-summary')).toContainText('Nothing picked up yet')
  }
  await expect(page.getByTestId('style-summary')).toContainText('Nothing picked up yet') // start every test clean
}

test('thumbs-down offers four reasons; one tap changes how the bunny talks (real database), and Undo puts it back', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await forgetStyle(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'tell me something')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')

  // Quiet by default: two icons, no reasons yet.
  await expect(eli.page.getByTestId('feedback-icons')).toBeVisible()
  await expect(eli.page.getByTestId('feedback-reasons')).toHaveCount(0)
  await eli.page.getByRole('button', { name: "This reply wasn't quite right" }).click()
  const reasons = eli.page.getByTestId('feedback-reasons').getByRole('button')
  await expect(reasons).toHaveCount(7) // six reasons and a way to type something else
  await expect(reasons).toHaveText(['Too long', 'Too many questions', 'Too cheery', 'Too serious', 'Too formal', 'Too informal', 'Something else…'])

  await reasons.filter({ hasText: 'Too long' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toContainText("I'll keep my replies shorter")
  await eli.page.getByRole('button', { name: 'Undo' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toContainText('back to how it was')

  await eli.page.goto('/preferences')
  await expect(eli.page.getByTestId('style-summary')).toContainText('Nothing picked up yet', { timeout: 15_000 })
})

test('a reason sticks: it shows up under Preferences, can be set again without change, and is private', async ({ users }) => {
  const [eli, alice] = await users(['Eli', 'Alice'])
  await tuck(eli.page)
  await tuck(alice.page)
  await forgetStyle(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'tell me something')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await eli.page.getByRole('button', { name: "This reply wasn't quite right" }).click()
  await eli.page.getByRole('button', { name: 'Too many questions' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toContainText('fewer questions')

  await eli.page.goto('/preferences')
  await expect(eli.page.getByTestId('style-summary')).toContainText('Fewer questions', { timeout: 15_000 })

  // Same reason again on a new reply: nothing to change, and it says so honestly.
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'and again')
  // (the fake bunny numbers its replies per page, and that count carries over from the earlier page load)
  await expect(eli.page.getByTestId('bunny-words')).toContainText('What part felt heaviest?')
  await eli.page.getByRole('button', { name: "This reply wasn't quite right" }).click()
  await eli.page.getByRole('button', { name: 'Too many questions' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toContainText("I'm already doing that")
  await expect(eli.page.getByRole('button', { name: 'Undo' })).toHaveCount(0)

  // Private to this account.
  await alice.page.goto('/preferences')
  await expect(alice.page.getByTestId('bunny-style')).toBeVisible()
  await alice.page.waitForTimeout(1500)
  await expect(alice.page.getByTestId('style-summary')).not.toContainText('Fewer questions')
  await forgetStyle(eli.page)
})

test('"Too formal" and "Too informal" change the style; "Something else" sends your own words to the bunny', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await forgetStyle(eli.page)
  const seen = await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'tell me something')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('What part felt heaviest?')

  await eli.page.getByRole('button', { name: "This reply wasn't quite right" }).click()
  await eli.page.getByRole('button', { name: 'Too formal' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toContainText('more casual')
  await eli.page.goto('/preferences')
  await expect(eli.page.getByTestId('style-summary')).toContainText('Casual, like a friend', { timeout: 15_000 })

  // Typing something else: it goes to the bunny as an ordinary message, and nothing is stored as a profile.
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'hello again')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('What part felt heaviest?')
  const before = seen.reply.length
  await eli.page.getByRole('button', { name: "This reply wasn't quite right" }).click()
  await eli.page.getByRole('button', { name: 'Something else…' }).click()
  await expect(eli.page.getByLabel('How would you like me to talk?')).toBeVisible()
  const feedbackBox = eli.page.getByTestId('feedback-typing')
  await expect(feedbackBox.getByRole('button', { name: 'Send', exact: true })).toBeDisabled() // nothing typed yet
  await eli.page.getByLabel('How would you like me to talk?').fill('please use simpler words')
  await feedbackBox.getByRole('button', { name: 'Send', exact: true }).click()
  await expect.poll(() => seen.reply.length).toBe(before + 1) // sent to the bunny as an ordinary message
  expect(seen.reply[before].messages.at(-1)).toEqual({ role: 'user', text: 'please use simpler words' })
  await expect(eli.page.getByTestId('feedback-typing')).toHaveCount(0) // the box closes after sending
  await forgetStyle(eli.page)
})


test('thumbs-up just says thanks and does not change anything', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await forgetStyle(eli.page)
  await mockBunny(eli.page)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'tell me something')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  await eli.page.getByRole('button', { name: 'This reply was good' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toHaveText('Glad that helped.')
  await expect(eli.page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  await eli.page.goto('/preferences')
  await expect(eli.page.getByTestId('style-summary')).toContainText('Nothing picked up yet', { timeout: 15_000 })
})

test('feedback controls come back for each new reply, and appear once on Messages, under the latest reply only', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await clearConversations(eli.page)
  await mockBunny(eli.page)
  await eli.page.goto('/messages')
  await eli.page.getByLabel('Tell the bunny something').fill('first thing')
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(1)
  await eli.page.getByRole('button', { name: 'This reply was good' }).click()
  await expect(eli.page.getByTestId('feedback-ack')).toBeVisible()
  await eli.page.getByLabel('Tell the bunny something').fill('second thing')
  await eli.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(eli.page.getByTestId('chat-bunny')).toHaveCount(2)
  await expect(eli.page.getByTestId('feedback-icons')).toHaveCount(1) // only under the latest reply, fresh again
  await expect(eli.page.getByTestId('feedback-ack')).toHaveCount(0)
  await clearConversations(eli.page)
})

test('no feedback controls appear on the support card', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await mockBunny(eli.page, { reply: () => ({ status: 'support' }) })
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'everything feels pointless lately')
  await expect(eli.page.getByTestId('chat-support')).toBeVisible()
  await expect(eli.page.getByTestId('feedback-icons')).toHaveCount(0)
})


test('phone width: Home, Messages, and the thread have no horizontal scroll', async ({ users }) => {
  const [eli] = await users(['Eli'])
  await tuck(eli.page)
  await eli.page.setViewportSize({ width: 375, height: 800 })
  await mockBunny(eli.page)
  const overflow = () => eli.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await openHome(eli.page)
  await eli.page.getByLabel("Don't save this chat").check()
  await sayOnHome(eli.page, 'a fairly long message to see how it wraps on a small screen without breaking the layout at all')
  await expect(eli.page.getByTestId('bunny-words')).toContainText('(1)')
  expect(await overflow()).toBeLessThanOrEqual(0)
  await eli.page.goto('/messages')
  await expect(eli.page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
