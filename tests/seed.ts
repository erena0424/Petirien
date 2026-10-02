import type { Page } from '@playwright/test'
import { expect } from 'deepspace/testing'

/**
 * Puts an entry in the REAL local Journal (dev build only). Entries are normally written by the model, which tests must
 * never call, so this is the one way for a browser test to have something to look at. Uses the signed-in test account.
 */
export async function seedJournal(
  page: Page,
  row: { title: string; notes?: string[]; feelings?: string[]; bunnyNote?: string; kind?: string; eventId?: string; eventTitle?: string; eventStart?: string },
) {
  await page.waitForFunction(() => typeof (window as unknown as { __petirien?: { seedJournal?: unknown } }).__petirien?.seedJournal === 'function')
  // The connection to the local database takes a moment after the page loads; writes before then are refused, so try again.
  let lastError = ''
  for (let i = 0; i < 40; i++) {
    const result = await page.evaluate(async (r) => {
      try {
        return { id: await (window as unknown as { __petirien: { seedJournal: (x: unknown) => Promise<string> } }).__petirien.seedJournal(r) }
      } catch (e) {
        return { error: String(e) }
      }
    }, row)
    if ('id' in result && result.id) return result.id
    lastError = 'error' in result ? (result.error ?? '') : ''
    if (!/not ready/i.test(lastError)) break
    await page.waitForTimeout(250)
  }
  expect(lastError, 'seeding a journal entry').toBe('')
  return ''
}
