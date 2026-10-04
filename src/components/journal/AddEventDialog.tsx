import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui'

const field =
  'mt-1 block min-h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Add an event of your own to the calendar: what it is, which day, and optionally a time (no time means all day).
 * Saved to your account, shown on the Journal calendar and, when it is today or tomorrow, on Home.
 */
export function AddEventDialog({
  open,
  onClose,
  defaultDate,
  defaultTime = '',
  defaultEndTime = '',
  onAdd,
}: {
  open: boolean
  onClose: () => void
  /** "YYYY-MM-DD" the date starts on (the day being looked at). */
  defaultDate: string
  /** "HH:MM" from a click or drag on the calendar, or empty. */
  defaultTime?: string
  defaultEndTime?: string
  /** True when what was typed is usable and is being saved. */
  onAdd: (title: string, date: string, time: string, endTime: string) => boolean
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(defaultTime)
  const [endTime, setEndTime] = useState(defaultEndTime)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDate(defaultDate)
      setTime(defaultTime)
      setEndTime(defaultEndTime)
      setError('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open, defaultDate, defaultTime, defaultEndTime])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (onAdd(title, date, time, endTime)) onClose()
    else setError('Add what it is and a date, a time like 14:30 if you like, and an end that comes after the start.')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="add-event-dialog">
        <DialogTitle>Add an event</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">Something coming up, or something that just happened. Only you can see it.</DialogDescription>
        <form onSubmit={submit} className="space-y-3" aria-label="Add an event">
          <label className="block text-sm font-medium text-foreground">
            What is it?
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={field} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-0 flex-1 text-sm font-medium text-foreground">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="text-sm font-medium text-foreground">
              Time (optional)
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
            <label className="text-sm font-medium text-foreground">
              Until (optional)
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-foreground">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11 rounded-full px-6">
              Add
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
