import { getAuthToken } from 'deepspace'

/** Calls a server action. Resolves `null` on any failure; callers treat this as best-effort. */
export async function callAction<T>(name: string, body: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const token = await getAuthToken()
    if (!token) return null
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T } | null
    return res.ok && json?.success ? (json.data ?? null) : null
  } catch {
    return null
  }
}
