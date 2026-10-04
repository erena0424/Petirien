/**
 * POST /api/public/places: nearby places for a visitor who has not signed in.
 * Billed to the app owner, so: fixed kinds only, rounded location, shared one-day cache, and a daily cap for
 * all anonymous visitors together. See public-places.ts. Nothing about the visitor is stored.
 */

import type { Hono } from 'hono'
import { apiWorkerFetch } from 'deepspace/worker'
import type { AppContext } from '../../worker.js'
import { createActionTools } from './action-routes.js'
import {
  PUBLIC_USAGE_ID,
  isFresh,
  parsePublicRequest,
  publicCacheKey,
  publicDay,
  publicQuery,
  underCap,
} from './public-places.js'

type Row = Record<string, unknown>

export function registerPublicRoutes(app: Hono<AppContext>): void {
  app.post('/api/public/places', async (c) => {
    const body = await c.req.json().catch(() => null)
    const req = parsePublicRequest(body)
    if (!req) return c.json({ success: false, code: 'bad_request', error: 'Invalid request' }, 400)
    if (!c.env.APP_OWNER_JWT) return c.json({ success: false, code: 'unavailable', error: 'Unavailable' }, 503)

    const tools = createActionTools(c.env, c.env.OWNER_USER_ID ?? PUBLIC_USAGE_ID, '')
    const key = publicCacheKey(req)

    const cached = await tools.query<Row>('searchCache', { where: { query: key }, limit: 1 })
    const hit = cached.success ? cached.data.records[0] : undefined
    const hitData = hit?.data as Row | undefined
    if (hitData && isFresh(hitData.fetchedAt, Date.now())) return c.json({ success: true, data: hitData.results, fetchedAt: hitData.fetchedAt })

    const day = publicDay(new Date())
    const usage = await tools.query<Row>('usage', { where: { userId: PUBLIC_USAGE_ID, day }, limit: 1 })
    const row = usage.success ? usage.data.records[0] : undefined
    const count = typeof (row?.data as Row | undefined)?.count === 'number' ? ((row!.data as Row).count as number) : 0
    if (!underCap(count)) return c.json({ success: false, code: 'daily_limit', error: 'Daily limit reached' }, 429)
    // Count before searching, so a burst of requests cannot get past the cap while one is in flight.
    if (row) await tools.update('usage', row.recordId as string, { count: count + 1 })
    else await tools.create('usage', { userId: PUBLIC_USAGE_ID, day, count: 1 })

    const res = await apiWorkerFetch(c.env, '/api/integrations/serpapi/places-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.env.APP_OWNER_JWT}` },
      body: JSON.stringify({ q: publicQuery(req.kind), type: 'search', ll: `@${req.origin.lat},${req.origin.lng},15z`, hl: 'en' }),
    })
    const payload = (await res.json().catch(() => null)) as Row | null
    if (!res.ok || !payload || payload.success === false) {
      return c.json({ success: false, code: 'search_failed', error: 'Search failed' }, 502)
    }
    const results = payload.data
    const fetchedAt = Date.now()
    if (hit) await tools.update('searchCache', hit.recordId as string, { results, fetchedAt })
    else await tools.create('searchCache', { query: key, results, fetchedAt })
    return c.json({ success: true, data: results, fetchedAt })
  })
}
