/**
 * The floating bunny, in a real browser against the REAL local server, with no
 * paid calls (reflectReply is mocked; this proves layout, moving, sizes, storage
 * of position, and keyboard use, NOT the model's replies).
 * Uses its own account (Eli); specs run one at a time.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 5, 'Needs 5 usable test accounts.')
test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

async function mock(page: Page) {
  await page.route('**/api/actions/homeIdeas', (route) => route.fulfill(json({ status: 'ok', ideas: [] }))) // Home would otherwise search YouTube
  await page.route('**/api/actions/reflectReply', (route) => route.fulfill(json({ status: 'ok', reply: 'That sounds like a lot. What felt heaviest?' })))
  await page.route('**/api/actions/summarizeConversation', (route) => route.fulfill(json({ status: 'ok' })))
}

const overlaps = (a: any, b: any) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

test('the bunny floats on every page except Messages, and never covers the support link', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  await mock(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('floatCleared')) return // only on the first load, so a reload can prove it remembers
    sessionStorage.setItem('floatCleared', '1')
    localStorage.removeItem('petirien.bunnyFloat')
  })

  await page.goto('/home')
  await expect(page.getByTestId('floating-toggle')).toBeVisible()
  await page.goto('/messages')
  await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible()
  await expect(page.getByTestId('floating-bunny')).toHaveCount(0)
  // Every bunny picture on Messages really loaded (a broken image shows a small empty box).
  await page.getByRole('button', { name: 'New conversation' }).click()
  await page.waitForFunction(() => Array.from(document.images).filter((i) => i.src.includes('bunny')).every((i) => i.complete && i.naturalWidth > 0))
  expect(await page.evaluate(() => Array.from(document.images).filter((i) => i.src.includes('bunny')).length)).toBeGreaterThan(0)

  await page.goto('/preferences')
  const toggle = page.getByTestId('floating-toggle')
  await expect(toggle).toBeVisible()
  await expect(page.getByTestId('bunny-words')).toHaveCount(0) // it starts folded: just the bunny
  await toggle.click()
  await expect(page.getByTestId('bunny-words')).toContainText(/Say something/)

  // Sizes: three, and bigger really is bigger.
  const width = async () => (await toggle.boundingBox())!.width
  const large = await width()
  expect(large).toBeGreaterThanOrEqual(280) // starts as big as the old Home bunny
  await expect(page.getByRole('button', { name: 'Bigger bunny' })).toBeDisabled()
  await page.getByRole('button', { name: 'Smaller bunny' }).click()
  const medium = await width()
  expect(medium).toBeLessThan(large)
  await page.getByRole('button', { name: 'Smaller bunny' }).click()
  expect(await width()).toBeLessThan(medium)
  await expect(page.getByRole('button', { name: 'Smaller bunny' })).toBeDisabled()
  await page.getByRole('button', { name: 'Bigger bunny' }).click()
  await page.getByRole('button', { name: 'Bigger bunny' }).click()

  // Always open on a computer: the text box is right under the bunny's words, no click needed.
  const panel = page.getByTestId('floating-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('The bunny is an AI')
  const wordsBox = (await page.getByTestId('bunny-words').boundingBox())!
  const inputBox = (await page.getByLabel('Tell the bunny something').boundingBox())!
  expect(inputBox.y).toBeGreaterThanOrEqual(wordsBox.y + wordsBox.height - 2) // below the words, not beside them
  expect(Math.abs(inputBox.x - wordsBox.x)).toBeLessThan(20)
  await page.getByLabel('Tell the bunny something').fill('rough day')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByTestId('floating-thread')).toContainText('What felt heaviest?')

  // Older messages shrink, fade, and finally disappear; the latest stay full size.
  for (let i = 2; i <= 5; i++) {
    await page.getByLabel('Tell the bunny something').fill(`message number ${i}`)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByTestId('bunny-words')).toContainText('What felt heaviest?')
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled() // text box empty again
  }
  await page.waitForTimeout(600) // let the size and fade transitions finish
  const items = page.getByTestId('floating-thread').locator('> li')
  await expect(items).toHaveCount(5) // 10 messages sent and answered, only the newest five still show
  await expect(page.getByTestId('floating-thread')).not.toContainText('rough day')
  const looks = await items.evaluateAll((els) => els.map((e) => ({ size: parseFloat(getComputedStyle(e).fontSize), opacity: parseFloat(getComputedStyle(e).opacity) })))
  for (let i = 1; i < looks.length; i++) {
    expect(looks[i]!.size).toBeGreaterThanOrEqual(looks[i - 1]!.size) // newer is never smaller
    expect(looks[i]!.opacity).toBeGreaterThanOrEqual(looks[i - 1]!.opacity)
  }
  expect(looks[looks.length - 1]!.opacity).toBe(1)
  expect(looks[0]!.opacity).toBeLessThan(looks[looks.length - 1]!.opacity)
  expect(looks[0]!.size).toBeLessThan(looks[looks.length - 1]!.size)

  // Tap the bunny: the chat goes and only the bunny stays. Tap again: the text box and past messages come back.
  await toggle.click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('bunny-words')).toHaveCount(0)
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('floating-thread')).toContainText('What felt heaviest?') // the conversation is still there
  await expect(page.getByLabel('Tell the bunny something')).toBeVisible()
  // Hidden stays hidden after a reload.
  await toggle.click()
  await page.reload()
  await expect(page.getByTestId('floating-toggle')).toBeVisible()
  await expect(page.getByTestId('floating-panel')).toHaveCount(0)
  await page.getByTestId('floating-toggle').click()
  await expect(page.getByTestId('floating-panel')).toBeVisible()

  // Dragged anywhere, even far past the corner: it stays on screen and above the footer.
  const box = (await toggle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(5, 5, { steps: 8 })
  await page.mouse.up()
  const moved = (await toggle.boundingBox())!
  expect(moved.x).toBeLessThan(box.x)
  expect(moved.y).toBeLessThan(box.y)
  expect(moved.x).toBeGreaterThanOrEqual(0)
  expect(moved.y).toBeGreaterThanOrEqual(0)
  // The whole thing (bunny and conversation) still fits the window and does not cover the support link.
  const p = (await panel.boundingBox())!
  const vp = page.viewportSize()!
  expect(p.x + p.width).toBeLessThanOrEqual(vp.width)
  expect(p.y).toBeGreaterThanOrEqual(0)
  expect(overlaps(p, (await page.getByTestId('footer-support').boundingBox())!)).toBe(false)

  // Where you left it, and the size, are remembered after a reload.
  const before = (await toggle.boundingBox())!
  await page.reload()
  const after = (await page.getByTestId('floating-toggle').boundingBox())!
  expect(Math.abs(after.x - before.x)).toBeLessThan(2)
  expect(Math.abs(after.y - before.y)).toBeLessThan(2)
  expect(Math.abs(after.width - before.width)).toBeLessThan(2)
  expect(overlaps(after, (await page.getByTestId('footer-support').boundingBox())!)).toBe(false)

  // Keyboard: arrow keys move it.
  const t2 = page.getByTestId('floating-toggle')
  await t2.focus()
  const k0 = (await t2.boundingBox())!
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  const k1 = (await t2.boundingBox())!
  expect(k1.x).toBeGreaterThan(k0.x)
  expect(k1.y).toBeGreaterThan(k0.y)
})

test('on a phone it is docked, not draggable, opens as a sheet, and the page does not scroll sideways', async ({ users }) => {
  const [eli] = await users(['Eli'])
  const page = eli.page
  await mock(page)
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/preferences')
  const toggle = page.getByTestId('floating-toggle')
  await expect(toggle).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bigger bunny' })).toHaveCount(0)
  const box = (await toggle.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(20, 20, { steps: 5 })
  await page.mouse.up()
  const still = (await toggle.boundingBox())!
  expect(Math.abs(still.x - box.x)).toBeLessThan(2) // docked: the drag attempt moved nothing
  expect(Math.abs(still.y - box.y)).toBeLessThan(2)
  await toggle.click()
  await expect(page.getByTestId('floating-panel')).toBeVisible()
  const sheet = (await page.getByTestId('floating-panel').boundingBox())!
  expect(sheet.x).toBeGreaterThanOrEqual(0)
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(375)
  expect(overlaps(sheet, (await page.getByTestId('footer-support').boundingBox())!)).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Close chat' }).click()
  const back = (await toggle.boundingBox())!
  expect(Math.abs(back.x - box.x)).toBeLessThan(2)
})
