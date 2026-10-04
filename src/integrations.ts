/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default). Works for anonymous users.
 * - 'user': The calling user pays. Requires sign-in.
 *
 * Integrations not listed here default to 'developer'.
 *
 * IMPORTANT: any integration backed by per-user OAuth tokens (Google,
 * etc.) must be 'user' — the api-worker looks up the row keyed by the
 * JWT subject. With 'developer' the app owner's JWT is forwarded and
 * the handler operates on the app owner's connected account regardless
 * of who's signed in client-side.
 */

export const integrations: Record<string, { billing: 'developer' | 'user' }> = {
  google: { billing: 'user' },
  // Each signed-in person pays for their own check-ins (free plan: 500 credits,
  // 1 credit = $0.01). Sign-in is required anyway; no anonymous spend.
  // Video search and details cost about a cent each, so the app owner pays here too (DeepSpace's own YouTube integration is
  // the only video source), bounded by an app-wide daily limit (src/server/owner-cap.ts).
  youtube: { billing: 'developer' },
  // The bunny, check-in interpretation and journal entries cost about a tenth of a cent a call, so the app owner pays and
  // nobody needs credits to try Petirien. Bounded two ways: per-account daily limits and an app-wide daily limit (src/server/model-cap.ts).
  anthropic: { billing: 'developer' },
  // Places near the person: about 3 cents a search, so it is billed to the person who asks, like the others.
  serpapi: { billing: 'user' },
}
