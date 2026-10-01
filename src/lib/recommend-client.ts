import { getAuthToken } from 'deepspace'
import type { CheckinInput, RecommendResponse } from '../contract'

const KNOWN: RecommendResponse['status'][] = ['ok', 'no_video', 'support', 'nothing_fits', 'capped', 'error']

const GENERIC_ERROR = 'Something went wrong. Please try again in a moment.'

/** Pure: turn an HTTP status + parsed body into a RecommendResponse. Never throws. */
export function toResponse(httpStatus: number, body: unknown): RecommendResponse {
  if (httpStatus === 401) return { status: 'error', message: 'Please sign in again to continue.' }
  const b = body as { success?: boolean; data?: { status?: unknown } } | null
  const status = b?.data?.status
  if (httpStatus >= 200 && httpStatus < 300 && b?.success && typeof status === 'string' && KNOWN.includes(status as never)) {
    return b.data as RecommendResponse
  }
  return { status: 'error', message: GENERIC_ERROR }
}

/** Calls the `recommend` server action. Always resolves; failures become `status: 'error'`. */
export async function requestRecommendations(input: CheckinInput, signal?: AbortSignal): Promise<RecommendResponse> {
  try {
    const token = await getAuthToken()
    if (!token) return { status: 'error', message: 'Please sign in again to continue.' }
    const res = await fetch('/api/actions/recommend', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    })
    const body = await res.json().catch(() => null)
    return toResponse(res.status, body)
  } catch {
    return { status: 'error', message: "We couldn't reach the server. Check your connection and try again." }
  }
}
