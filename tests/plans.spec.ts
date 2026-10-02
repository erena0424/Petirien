/**
 * Plans from the calendar, "Reflect on this", and journal reflections, in a real
 * browser against the REAL local server and database, with no paid calls:
 *  - Google Calendar (page.route) and the bunny's reply (page.route) are MOCKED. This proves our UI, what
 *    we send, what is stored, and the Journal. It does NOT prove the real Google response shape, the real
 *    model's tone about a plan, or billing. Those are checked by hand with a real account.
 * Uses its own account (Cara); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { seedJournal } from './seed'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const inMin = (m: number) => new Date(Date.now() + m * 60000).toISOString()
const COMING = `Dentist ${run}`
const DONE = `Team sync ${run}`
const SECRET_NOTE = `private reflection words ${run}`

const items = [
  { id: `done-${run}`, summary: DONE, start: { dateTime: inMin(-90) }, end: { dateTime: inMin(-30) }, description: 'SECRET-DESC', location: 'SECRET-PLACE' },
  { id: `soon-${run}`, summary: COMING, start: { dateTime: inMin(95) }, end: { dateTime: inMin(125) } },
]

async function setup(page: Page, opts: { calendar?: unknown } = {}) {
  await tuck(page)
  const replies: any[] = []
  await page.route('**/api/integrations/google/calendar-list-events', (route) => route.fulfill(ok(opts.calendar ?? { items })))
  await page.route('**/api/actions/reflectReply', (route) => {
    replies.push(route.request().postDataJSON())
    return route.fulfill(ok({ status: 'ok', reply: 'That makes sense. What part is on your mind most?', offer: true }))
  })
  await page.route('**/api/actions/summarizeConversation', (route) => route.fulfill(ok({ status: 'ok' })))
  return replies
}

/** Folds the floating chat away so the small bunny cannot sit over buttons while a test clicks around. */
async function collapseChat(page: Page) {
  const toggle = page.getByTestId('floating-toggle')
  await expect(toggle).toBeVisible()
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
}

test('Home has the big bunny at the top with an invitation, and the floating bunny too', async ({ users }) => {
  const [cara] = await users(['Cara'])
  await setup(cara.page)
  await cara.page.goto('/home')
  const hero = cara.page.getByTestId('home-hero')
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('heading', { name: "What's on your mind?" })).toBeVisible()
  await expect(cara.page.getByTestId('home-greeting')).toContainText(/Good (morning|afternoon|evening)|night owl/)
  expect((await hero.locator('img').first().boundingBox())!.width).toBeGreaterThanOrEqual(220) // big
  await expect(cara.page.getByTestId('floating-toggle')).toBeVisible() // and the floating one
  await expect(cara.page.getByRole('heading', { level: 1 })).toHaveText('Home')
  // One filled button in the hero, and the quieter way to do something little.
  await expect(cara.page.getByTestId('home-talk')).toBeVisible()
  await expect(cara.page.getByTestId('do-something')).toBeVisible()
  // "Talk to the bunny" brings the floating chat forward and focuses its text box (no second text box on the page).
  await collapseChat(cara.page)
  await cara.page.getByTestId('home-talk').click()
  await expect(cara.page.getByLabel('Tell the bunny something')).toBeFocused()
  await expect(cara.page.getByLabel('Tell the bunny something')).toHaveCount(1)
})

test('plans: a short list from the calendar with times only for what is coming, then Reflect on this', async ({ users }) => {
  const [cara] = await users(['Cara'])
  const replies = await setup(cara.page)
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()

  const list = cara.page.getByTestId('plans-list')
  await expect(list.getByTestId('plan')).toHaveCount(2)
  await expect(list).toContainText(DONE)
  await expect(list).toContainText('Finished')
  await expect(list).toContainText(COMING)
  await expect(list).toContainText(/today at|tomorrow at/)
  await expect(cara.page.getByTestId('plans')).not.toContainText('SECRET') // only titles and times

  // Reflect on this: the bunny opens with a neutral question, no model call yet.
  await cara.page.getByRole('button', { name: `Reflect on this: ${COMING}` }).click()
  const words = cara.page.getByTestId('bunny-words')
  await expect(words).toContainText(`You have "${COMING}"`)
  await expect(words).toContainText('How are you feeling about it?')
  expect(replies).toHaveLength(0)
  await expect(cara.page.getByLabel('Tell the bunny something')).toBeFocused()

  // The person answers; the model sees the opener as part of the conversation, and nothing else about the event.
  await cara.page.getByLabel('Tell the bunny something').fill('a bit unsure, honestly')
  await cara.page.getByRole('button', { name: 'Send' }).click()
  await expect(cara.page.getByTestId('bunny-words')).toContainText('What part is on your mind most?')
  expect(replies).toHaveLength(1)
  expect(replies[0].messages).toEqual([
    { role: 'bunny', text: expect.stringContaining(`You have "${COMING}"`) },
    { role: 'user', text: 'a bit unsure, honestly' },
  ])
  expect(JSON.stringify(replies[0])).not.toContain('SECRET')

  // The chat is saved like any other and listed on Messages under the plan's name.
  await cara.page.goto('/messages')
  await expect(cara.page.getByTestId('conversation-item').filter({ hasText: COMING })).toHaveCount(1, { timeout: 15_000 })
})

test('the bunny may offer a small idea, only as an optional link that fits the time before the plan', async ({ users }) => {
  const [cara] = await users(['Cara'])
  await setup(cara.page)
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()
  await cara.page.getByRole('button', { name: `Reflect on this: ${COMING}` }).click()
  await expect(cara.page.getByTestId('bunny-offer')).toHaveCount(0) // no offer just because a plan was opened
  await cara.page.getByLabel('Tell the bunny something').fill('I could use a minute to settle')
  await cara.page.getByRole('button', { name: 'Send' }).click()
  const offer = cara.page.getByTestId('bunny-offer')
  await expect(offer).toBeVisible()
  await expect(offer).toHaveAttribute('href', '/checkin?minutes=30') // the plan is about 95 minutes away
  await offer.click()
  await expect(cara.page).toHaveURL(/\/checkin\?minutes=30$/)
  await cara.page.getByRole('button', { name: /More options/ }).click()
  await expect(cara.page.getByLabel('30 min')).toBeChecked()
})

test('share a plan by hand: it appears, can be talked about, and can be removed', async ({ users }) => {
  const [cara] = await users(['Cara'])
  await setup(cara.page, { calendar: { items: [] } })
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()
  await expect(cara.page.getByTestId('plans-empty')).toBeVisible()
  await cara.page.getByRole('button', { name: 'Share a plan' }).click()
  await cara.page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(cara.page.getByRole('alert')).toContainText('Add what it is')
  await cara.page.getByLabel('What is it?').fill(`Call mom ${run}`)
  await cara.page.getByRole('button', { name: 'Add', exact: true }).click()
  const plan = cara.page.getByTestId('plan').filter({ hasText: `Call mom ${run}` })
  await expect(plan).toHaveCount(1)
  await cara.page.getByRole('button', { name: `Reflect on this: Call mom ${run}` }).click()
  await expect(cara.page.getByTestId('bunny-words')).toContainText(`You have "Call mom ${run}"`)
  await cara.page.getByRole('button', { name: `Remove: Call mom ${run}` }).click()
  await expect(cara.page.getByTestId('plan')).toHaveCount(0)
})

test('not connected yet: a Connect link to Google only, then the plans appear', async ({ users }) => {
  const [cara] = await users(['Cara'])
  await tuck(cara.page)
  let connected = false
  await cara.page.route('**/api/integrations/google/calendar-list-events', (route) =>
    route.fulfill(ok(connected ? { items } : { requiresOAuth: true, authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })),
  )
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()
  const link = cara.page.getByTestId('plans-connect')
  await expect(link).toHaveAttribute('href', 'https://accounts.google.com/o/oauth2/v2/auth?x=1')
  await expect(link).toHaveAttribute('rel', /noopener/)
  connected = true
  await cara.page.getByRole('button', { name: /I've connected, check again/ }).click()
  await expect(cara.page.getByTestId('plan')).toHaveCount(2)
})

test('an older written reflection can still be opened and changed from the Journal, one question at a time, and is never sent to the model', async ({ users }) => {
  const [cara] = await users(['Cara'])
  const replies = await setup(cara.page)
  await cara.page.goto('/journal')
  await seedJournal(cara.page, {
    title: DONE,
    notes: [SECRET_NOTE],
    feelings: ['Mixed'],
    kind: 'reflection',
    eventId: `done-${run}`,
    eventTitle: DONE,
    eventStart: inMin(-90),
  })
  await cara.page.getByTestId('journal-view-list').click()
  const entry = cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })
  await expect(entry).toHaveCount(1, { timeout: 15_000 })
  await expect(entry).toContainText('Reflection')
  await expect(entry).toContainText('Mixed')
  await expect(entry).toContainText(SECRET_NOTE)

  await entry.getByRole('button', { name: `Edit reflection: ${DONE}` }).click()
  const edit = cara.page.getByTestId('reflection-dialog')
  const prompt = edit.getByTestId('reflection-prompt')
  await expect(prompt).toHaveText('How did it go?')
  await edit.getByRole('button', { name: 'Try a different question' }).click()
  await expect(prompt).toHaveText("Anything you'd like to remember?")
  await edit.getByRole('button', { name: 'Try a different question' }).click()
  await edit.getByRole('button', { name: 'Try a different question' }).click()
  await expect(prompt).toHaveText('How did it go?') // cycles
  await expect(edit.getByLabel('Your reflection')).toHaveValue(SECRET_NOTE)
  await edit.getByLabel('Your reflection').fill(`${SECRET_NOTE} (edited)`)
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(cara.page.getByTestId('reflection-saved')).toBeVisible()
  await cara.page.getByRole('button', { name: 'Done' }).click()
  await expect(cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })).toHaveCount(1) // still one entry
  await expect(cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })).toContainText('(edited)')

  await cara.page.reload()
  await cara.page.getByTestId('journal-view-list').click()
  await expect(cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })).toContainText('(edited)')
  expect(JSON.stringify(replies)).not.toContain(SECRET_NOTE)

  await cara.page.getByRole('button', { name: `Delete entry: ${DONE}` }).click()
  await cara.page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })).toHaveCount(0)
})

test('there is no separate Reflect button any more: every plan has one action, a conversation with the bunny', async ({ users }) => {
  const [cara] = await users(['Cara'])
  await setup(cara.page)
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()
  await expect(cara.page.getByTestId('plan')).toHaveCount(2)
  await expect(cara.page.getByRole('button', { name: /^Reflect on this: / })).toHaveCount(2) // one per plan, finished or not
  await expect(cara.page.getByRole('button', { name: /^Reflect on this: / }).first()).toHaveText('Reflect on this')
  await expect(cara.page.getByRole('button', { name: /^Reflect$|View reflection|^Talk about this/ })).toHaveCount(0)
  await expect(cara.page.getByTestId('reflection-dialog')).toHaveCount(0)
})

test('past plans can be talked about too, and Home suggests asking about what just finished', async ({ users }) => {
  const [cara] = await users(['Cara'])
  const replies = await setup(cara.page)
  await cara.page.goto('/home')
  await collapseChat(cara.page)
  await expect(cara.page.getByTestId('home-suggestion')).toHaveCount(0) // nothing to suggest until plans are known
  await cara.page.getByRole('button', { name: 'Show my plans' }).click()

  // The bunny offers to ask about what just finished, in plain words, and about what is next.
  const suggestions = cara.page.getByTestId('home-suggestion')
  await expect(suggestions.first()).toHaveText(`How was ${DONE}?`)
  await expect(suggestions).toHaveCount(2)
  await expect(suggestions.nth(1)).toContainText(`How are you feeling about ${COMING}`)

  // Choosing it starts a conversation in the past tense, with no model call and nothing assumed.
  await suggestions.first().click()
  const words = cara.page.getByTestId('bunny-words')
  await expect(words).toContainText(`You had "${DONE}"`)
  await expect(words).toContainText('How did it go?')
  await expect(words).not.toContainText('You have')
  expect(replies).toHaveLength(0)

  // The same works from the list: a finished plan has the same single action.
  await expect(cara.page.getByRole('button', { name: `Reflect on this: ${DONE}` })).toBeVisible()
})

test('editing a written reflection to mention crisis shows where to get help, and nothing reaches a model', async ({ users }) => {
  const [cara] = await users(['Cara'])
  const replies = await setup(cara.page)
  await cara.page.goto('/journal')
  const eventId = `crisis-${run}`
  await seedJournal(cara.page, { title: DONE, notes: ['it was fine'], kind: 'reflection', eventId, eventTitle: DONE, eventStart: inMin(-90) })
  await cara.page.getByTestId('journal-view-list').click()
  const entry = cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })
  await expect(entry).toHaveCount(1, { timeout: 15_000 })
  await entry.getByRole('button', { name: `Edit reflection: ${DONE}` }).click()
  await cara.page.getByTestId('reflection-dialog').getByLabel('Your reflection').fill('I want to kill myself')
  await cara.page.getByRole('button', { name: 'Save changes' }).click()
  await expect(cara.page.getByTestId('reflection-saved')).toContainText('Saved in your Journal')
  await expect(cara.page.getByRole('link', { name: 'Call 988' })).toBeVisible()
  expect(replies).toHaveLength(0)
  await cara.page.getByRole('button', { name: 'Done' }).click()
  await cara.page.getByRole('button', { name: `Delete entry: ${DONE}` }).click()
  await cara.page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(cara.page.getByTestId('journal-reflection').filter({ hasText: DONE })).toHaveCount(0)
})
