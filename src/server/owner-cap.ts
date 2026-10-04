/**
 * App-wide daily limits on the paid calls the app owner pays for. Per-account limits already exist (80 chat messages,
 * 25 check-ins a day); these bound the total across every account, so many new accounts cannot add up to more than a
 * small, known amount a day. Pure rules only, so they can be tested.
 */

/** Calls per day for the whole app, by integration. Anything not listed here cannot be owner-paid at all. */
export const OWNER_DAILY_CAPS: Record<string, number> = {
  /** The bunny, check-in interpretation, journal entries: about $0.001 a call, so about $0.60 at most. */
  anthropic: 600,
  /** Video search ($0.013) and details ($0.0065): about $1.50 at most. */
  youtube: 120,
}

export const ownerUsageId = (integration: string) => `app-calls-${integration}`
export const ownerDay = (now: Date) => now.toISOString().slice(0, 10)
export const ownerCap = (integration: string): number => OWNER_DAILY_CAPS[integration] ?? 0
export const underOwnerCap = (integration: string, count: number) => count < ownerCap(integration)
