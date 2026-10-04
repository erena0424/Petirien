import { useMemo, useRef } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { Plan } from '../plans/plan'
import { newMyPlan, planFromRow, recordIdOf, type MyPlanRow } from '../plans/my-plans'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The events the person added by hand, saved to their own account. `add` returns whether what they typed was usable
 * (the save itself finishes a moment later, and waits for the connection to the database if the page has only just
 * opened); `remove` takes the plan's id.
 */
export function useMyPlans() {
  const query = useQuery<MyPlanRow>('myPlans')
  const { createConfirmed, removeConfirmed, ready } = useMutations<MyPlanRow>('myPlans')
  const readyRef = useRef(ready)
  readyRef.current = ready
  const busy = useRef(false)

  const plans = useMemo(
    () => query.records.map((r) => planFromRow(r.recordId, r.data)).filter((p): p is Plan => p !== null).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    [query.records],
  )

  /** Writes wait (a few seconds at most) for the database connection, which is not up in the first moments after a page opens. */
  async function whenReady(): Promise<boolean> {
    for (let i = 0; i < 80 && !readyRef.current; i++) await sleep(100)
    return readyRef.current
  }

  /** False when the title, date or time was not usable. True means it is being saved. */
  function add(title: string, date: string, time: string, endTime = ''): boolean {
    const row = newMyPlan(title, date, time, new Date(), endTime)
    if (!row || busy.current) return false
    busy.current = true
    void whenReady()
      .then((ok) => (ok ? createConfirmed(row) : undefined))
      .catch(() => undefined) // a rejected write is shown as a toast by the data layer
      .finally(() => {
        busy.current = false
      })
    return true
  }

  function remove(planId: string): void {
    const id = recordIdOf(planId)
    if (!id) return
    void whenReady()
      .then((ok) => (ok ? removeConfirmed(id) : undefined))
      .catch(() => undefined)
  }

  return { status: query.status, ready, plans, add, remove }
}
