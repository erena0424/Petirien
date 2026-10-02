import { useMemo, useRef, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { Rating, RatingInfo } from '../places/places'

interface Row {
  placeId: string
  name?: string
  rating: Rating
  /** When it was rated, in milliseconds. */
  ratedAt?: number
}

/**
 * What the person said about specific places: good, not right now, or never. Only the place's public id and name,
 * the rating and when it was given are stored, never where the person was. Pressing the same choice again takes it
 * back. "Not right now" ends by itself after a couple of weeks (see places.ts).
 */
export function usePlaceFeedback() {
  const query = useQuery<Row>('placeFeedback')
  const { createConfirmed, putConfirmed, removeConfirmed, ready } = useMutations<Row>('placeFeedback')
  const pending = useRef(new Set<string>())
  // Optimistic: the thumb answers at once; null means "taken back" until the server catches up.
  const [local, setLocal] = useState<Record<string, RatingInfo | null>>({})

  const stored = useMemo(() => new Map(query.records.map((r) => [r.data.placeId, r])), [query.records])
  const ratings = useMemo(() => {
    const m = new Map<string, RatingInfo>()
    for (const [id, r] of stored) m.set(id, { rating: r.data.rating, at: typeof r.data.ratedAt === 'number' ? r.data.ratedAt : Date.parse(r.createdAt) || 0 })
    for (const [id, v] of Object.entries(local)) {
      if (v === null) m.delete(id)
      else m.set(id, v)
    }
    return m
  }, [stored, local])

  async function rate(place: { id: string; name: string }, rating: Rating) {
    if (!ready || pending.current.has(place.id)) return
    pending.current.add(place.id)
    const current = ratings.get(place.id)?.rating
    const next: Rating | null = current === rating ? null : rating
    const at = Date.now()
    setLocal((l) => ({ ...l, [place.id]: next === null ? null : { rating: next, at } }))
    try {
      const row = stored.get(place.id)
      if (next === null) {
        if (row) await removeConfirmed(row.recordId)
      } else if (row) await putConfirmed(row.recordId, { rating: next, ratedAt: at })
      else await createConfirmed({ placeId: place.id, name: place.name.slice(0, 80), rating: next, ratedAt: at })
    } catch {
      /* a rejected write is shown as a toast by the data layer; the thumb goes back */
    } finally {
      pending.current.delete(place.id)
      setLocal((l) => {
        const { [place.id]: _gone, ...rest } = l
        void _gone
        return rest
      })
    }
  }

  return { status: query.status, ready, ratings, records: query.records, rate, remove: (recordId: string) => (ready ? removeConfirmed(recordId).catch(() => undefined) : Promise.resolve()) }
}
