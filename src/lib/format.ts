/** "6 min", "1 min", or "under 1 min". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return 'under 1 min'
  return `${Math.round(seconds / 60)} min`
}

/** Local time for a reset timestamp, e.g. "8:00 PM". */
export function formatResetTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'tomorrow'
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "Thu, Oct 1 · 3:15 PM" in the viewer's locale and time zone. */
export function formatCheckinDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}
