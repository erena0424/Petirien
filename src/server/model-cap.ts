/**
 * The app-wide daily limit on model (Anthropic) calls, which the app owner pays for. Per-account limits already exist
 * (80 chat messages, 25 check-ins a day); this one bounds the total across every account, so many new accounts cannot
 * add up to more than a small, known amount a day. Pure rules only, so they can be tested.
 */

/** Model calls per day for the whole app (about $0.001 each, so about $0.60 at most). */
export const MODEL_DAILY_CAP = 600
/** The usage row the app-wide count lives on. Not a real user id. */
export const MODEL_USAGE_ID = 'app-model-calls'

export const modelDay = (now: Date) => now.toISOString().slice(0, 10)
export const underModelCap = (count: number) => count < MODEL_DAILY_CAP

/** Whether this endpoint is one the app owner pays for and the app-wide limit applies to. */
export const isOwnerPaidModelCall = (endpoint: string) => endpoint.startsWith('anthropic/')
