import { useMemo, useRef } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { Plan } from '../plans/plan'
import { newMyPlan, planFromRow, recordIdOf, type MyPlanRow } from '../plans/my-plans'

/**
 * The events the person added by hand, saved to their own account. `add` returns whether what they typed was usable
 * (the save itself finishes a moment later); `remove` takes the plan's id.
 */
export function useMyPlans() {
  const query = useQuery<MyPlanRow>('myPlans')
  const { createConfirmed, removeConfirmed, ready } = useMutations<MyPlanRow>('myPlans')
  const busy = useRef(false)

  const plans = useMemo(
    () => query.records.map((r) => planFromRow(r.recordId, r.data)).filter((p): p is Plan => p !== null).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    [query.records],
  )

  /** False when the title, date or time was not usable. True means it is being saved. */
  function add(title: string, date: string, time: string): boolean {
    const row = newMyPlan(title, date, time, new Date())
    if (!row || !ready || busy.current) return false
    busy.current = true
    void createConfirmed(row)
      .catch(() => undefined) // a rejected write is shown as a toast by the data layer
      .finally(() => {
        busy.current = false
      })
    return true
  }

  function remove(planId: string): void {
    const id = recordIdOf(planId)
    if (id && ready) void removeConfirmed(id).catch(() => undefined)
  }

  return { status: query.status, ready, plans, add, remove }
}
