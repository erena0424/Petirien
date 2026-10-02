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

/** Check-ins (mood and energy) in the REAL local database, dev build only, for the signed-in test account. */
export async function seedCheckin(page: Page, row: { mood: number; energy: number; goal?: string; note?: string; minutes?: number }) {
  return retryUntilReady(page, 'seedCheckin', row)
}

/** Removes every check-in this test account has, so a test starts from nothing. */
export async function clearCheckins(page: Page) {
  await page.waitForFunction(() => typeof (window as unknown as { __petirien?: { clearCheckins?: unknown } }).__petirien?.clearCheckins === 'function')
  await page.waitForTimeout(1200) // let the stored check-ins arrive first
  await retryUntilReady(page, 'clearCheckins', undefined)
}

async function retryUntilReady(page: Page, fn: string, arg: unknown) {
  await page.waitForFunction((name) => typeof (window as unknown as { __petirien?: Record<string, unknown> }).__petirien?.[name] === 'function', fn)
  let lastError = ''
  for (let i = 0; i < 40; i++) {
    const result = await page.evaluate(
      async ([name, a]) => {
        try {
          return { value: await (window as unknown as { __petirien: Record<string, (x?: unknown) => Promise<unknown>> }).__petirien[name as string]!(a) ?? 'done' }
        } catch (e) {
          return { error: String(e) }
        }
      },
      [fn, arg] as const,
    )
    if ('value' in result) return result.value as string
    lastError = result.error ?? ''
    if (!/not ready/i.test(lastError)) break
    await page.waitForTimeout(250)
  }
  expect(lastError, fn).toBe('')
  return ''
}
