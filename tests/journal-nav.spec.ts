/**
 * Journal navigation and reading, and the "Turn this conversation into journal" button, in a real browser against the
 * REAL local database. Entries are seeded through the dev-only hook and the model is MOCKED, so nothing paid happens.
 * This proves: choosing a date in Month or Week opens that day; a journal entry's title on the calendar opens a reading
 * dialog (and Delete works from it); the journal button appears only when there is something to write about, asks the
 * server to write the saved conversation up, and exists both on Chat and in the floating bunny.
 * It does NOT prove the real model's wording or what a written entry looks like for a real conversation.
 * Uses its own account (Dana); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { seedJournal } from './seed'
import { tuck } from './tuck'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.setTimeout(120_000)

const run = String(Date.now() % 1e7)
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const pad = (n: number) => String(n).padStart(2, '0')

async function setup(page: Page) {
  await tuck(page)
  await page.route('**/api/actions/reflectReply', (r) => r.fulfill(ok({ status: 'ok', reply: 'That sounds like a long day. What was the hardest part?' })))
}

async function foldBunny(page: Page) {
  const toggle = page.getByTestId('floating-toggle')
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click()
}

/** Removes any journal entries this account has (an earlier failed run may have left some), through the List view. */
async function cleanUp(page: Page) {
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await page.waitForTimeout(1000) // let the stored entries arrive before looking for leftovers
  await foldBunny(page)
  await page.getByTestId('journal-view-list').click()
  for (let i = 0; i < 8; i++) {
    const del = page.getByRole('button', { name: /^Delete entry:/ })
    if ((await del.count()) === 0) break
    await del.first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForTimeout(500)
  }
}

test('choosing a date in the Month or the Week opens that day', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await setup(page)
  await page.goto('/journal')
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await foldBunny(page)

  // Month: the 15th is always on screen. Choosing it opens that day.
  await page.getByTestId('journal-view-month').click()
  const now = new Date()
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-15`
  await page.locator(`[data-testid="journal-day"][data-date="${key}"]`).click()
  await expect(page.getByTestId('journal-view-day')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('time-column')).toHaveAttribute('data-date', key)

  // Week: choosing a day's heading opens that day too. The second column is the Monday of the week of the 15th.
  await page.getByTestId('journal-view-week').click()
  const d = new Date(now.getFullYear(), now.getMonth(), 15)
  const monday = new Date(d.getFullYear(), d.getMonth(), 15 - d.getDay() + 1)
  const mondayKey = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
  await expect(page.getByTestId('time-column').nth(1)).toHaveAttribute('data-date', mondayKey)
  await page.getByTestId('journal-week').getByRole('button').filter({ hasText: /^[A-Z][a-z]{2}\d{1,2}$/ }).nth(1).click()
  await expect(page.getByTestId('journal-view-day')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('time-column')).toHaveAttribute('data-date', mondayKey)
})

test('an entry title on the calendar opens the entry to read, and it can be deleted from there', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await setup(page)
  const TITLE = `A long day at work ${run}`
  await page.goto('/journal')
  await expect(page.getByTestId('journal-range')).toBeVisible()
  await cleanUp(page)
  await seedJournal(page, { title: TITLE, notes: ['I felt tired today.', 'The meeting ran long', 'I wanted to go home.'], feelings: ['tired'], bunnyNote: 'Thanks for telling me.' })

  // Month: the title is a chip in today's cell.
  await page.getByTestId('journal-view-month').click()
  const chip = page.getByTestId('month-entry').filter({ hasText: TITLE })
  await expect(chip).toBeVisible()
  await chip.click()
  const dialog = page.getByTestId('entry-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(TITLE)
  // Written as sentences in one passage, not bullets, and the missing full stop was added.
  await expect(dialog.getByTestId('journal-prose')).toHaveText('I felt tired today. The meeting ran long. I wanted to go home.')
  await expect(dialog.locator('ul.list-disc')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Week: the title is a marker at the time it was written. It opens the same dialog.
  await page.getByTestId('journal-view-week').click()
  await foldBunny(page) // the open chat sits over the right edge, where the markers are
  const marker = page.getByTestId('journal-marker').filter({ hasText: TITLE })
  // The page scrolls smoothly, which makes a click wait for the marker to stop moving: bring it into view at once.
  await marker.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await marker.click()
  await expect(page.getByTestId('entry-dialog')).toContainText(TITLE)

  // Delete from the dialog: it asks first, and then the entry is gone.
  await page.getByTestId('entry-dialog').getByRole('button', { name: `Delete entry: ${TITLE}` }).click()
  await expect(page.getByTestId('entry-dialog')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByTestId('journal-marker').filter({ hasText: TITLE })).toHaveCount(0)
})

test('"Turn this conversation into journal" appears only when there is something to write, asks the server, and is in the floating bunny too', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await setup(page)
  const asked: any[] = []
  await page.route('**/api/actions/summarizeConversation', (r) => {
    asked.push(r.request().postDataJSON())
    return r.fulfill(ok({ status: 'ok' }))
  })

  await page.goto('/messages')
  await page.getByRole('button', { name: 'New conversation' }).click()
  await expect(page.getByTestId('journal-button')).toHaveCount(0) // nothing said yet
  await page.getByLabel('Tell the bunny something').fill('Work was a lot today and I feel wiped out.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByTestId('chat-bunny')).toBeVisible()
  const button = page.getByTestId('journal-button')
  await expect(button).toHaveText('Turn this conversation into journal')
  await button.click()
  await expect(page.getByTestId('notes-written')).toContainText('Added to your Journal')
  // (The app also writes notes by itself for old quiet chats, without `force`; only the button's own request is checked.)
  const forced = asked.filter((a) => a.force === true)
  expect(forced).toHaveLength(1)
  expect(typeof forced[0].conversationId).toBe('string')
  expect(JSON.stringify(forced[0])).not.toContain('wiped out') // the server reads the stored chat; the browser sends only the id

  // A chat that is not being saved has nothing stored to write from, so the button is not offered.
  await page.getByRole('button', { name: 'New conversation' }).click()
  await page.getByLabel("Don't save this chat").check()
  await page.getByLabel('Tell the bunny something').fill('Just thinking out loud.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByTestId('chat-bunny')).toBeVisible()
  await expect(page.getByTestId('journal-button')).toHaveCount(0)

  // The floating bunny has the same button, once its saved conversation has something of yours in it.
  await page.goto('/preferences')
  const toggle = page.getByTestId('floating-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await page.getByLabel('Tell the bunny something').fill('Another long day.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByTestId('bunny-words')).toContainText('long day')
  await expect(page.getByTestId('journal-button')).toBeVisible()
})

test('when the app cannot use the model right now, the person is told so plainly, for a reply and for the journal button', async ({ users }) => {
  const [dana] = await users(['Dana'])
  const page = dana.page
  await tuck(page)
  // The model is unavailable (the app's daily limit, or the owner's credits); the app turns that into a plain status.
  await page.route('**/api/actions/reflectReply', (r) => r.fulfill(ok({ status: 'unavailable' })))
  await page.route('**/api/actions/summarizeConversation', (r) => r.fulfill(ok({ status: 'unavailable' })))
  await page.goto('/messages')
  await page.getByRole('button', { name: 'New conversation' }).click()
  await page.getByLabel('Tell the bunny something').fill('Work was a lot today.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByTestId('chat-error')).toContainText('resting right now')
  await expect(page.getByTestId('chat-error')).not.toContainText("couldn't answer")
  // The journal button says the same, instead of "nothing new to write up".
  await page.getByTestId('journal-button').click()
  await expect(page.getByTestId('journal-unavailable')).toContainText('resting right now')
})
