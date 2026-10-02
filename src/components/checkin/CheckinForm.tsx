import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Textarea } from '@/components/ui'
import type { CheckinInput } from '../../contract'
import { ENERGY, GOAL_LABELS, MOOD } from '@/lib/labels'
import type { ScreenMode } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { ChoiceGroup } from '../ChoiceGroup'
import { CalendarFit } from './CalendarFit'

export interface FormValues {
  mood: number | null
  energy: number | null
  minutes: number | null
  goal: NonNullable<CheckinInput['goal']> | ''
  note: string
  screen: ScreenMode
  place: PlaceMode
}

export type PlaceMode = 'auto' | 'in' | 'out'

export const EMPTY_FORM: FormValues = { mood: null, energy: null, minutes: 10, goal: '', note: '', screen: 'auto', place: 'auto' }

const MINUTES = [5, 10, 15, 20, 30].map((m) => ({ value: m, label: `${m} min` }))
const GOALS = [
  { value: 'calm', label: 'Calm down' },
  { value: 'express', label: 'Express something' },
  { value: 'connect', label: 'Feel connected' },
  { value: 'move', label: 'Get moving' },
  { value: 'break', label: 'Take a break' },
  { value: '', label: 'Not sure' },
] as const

export function toInput(v: FormValues): CheckinInput | null {
  if (v.mood === null || v.energy === null || v.minutes === null) return null
  const note = v.note.trim()
  return {
    mood: v.mood,
    energy: v.energy,
    minutes: v.minutes,
    ...(v.goal ? { goal: v.goal } : {}),
    ...(note ? { note } : {}),
    ...(v.screen !== 'auto' ? { screen: v.screen } : {}),
    ...(v.place !== 'auto' ? { place: v.place } : {}),
  }
}

interface Props {
  values: FormValues
  onChange: (v: FormValues) => void
  onSubmit: (input: CheckinInput) => void
  submitting: boolean
}

export const SCREEN_CHOICES: { value: ScreenMode; label: string }[] = [
  { value: 'auto', label: 'Not sure' },
  { value: 'video', label: 'Videos are fine' },
  { value: 'none', label: 'No screen' },
]

export const PLACE_CHOICES: { value: PlaceMode; label: string }[] = [
  { value: 'auto', label: 'Not sure' },
  { value: 'in', label: 'Stay in' },
  { value: 'out', label: 'Go outside' },
]

/** One line describing what will be used if the person leaves "More options" alone. */
export function optionsSummary(v: FormValues): string {
  const screen = { auto: 'a mix of videos and ideas', video: 'videos', none: 'no screen' }[v.screen]
  const place = { auto: 'inside or outside', in: 'staying in', out: 'going outside' }[v.place]
  return [`${v.minutes ?? 10} min`, v.goal ? GOAL_LABELS[v.goal]?.toLowerCase() : 'any kind of help', screen, place].join(' · ')
}

interface Props {
  values: FormValues
  onChange: (v: FormValues) => void
  onSubmit: (input: CheckinInput) => void
  submitting: boolean
}

/**
 * Two questions up front (mood, energy). Everything else has a sensible default
 * and sits behind "More options", so a worn-out person is never asked to decide
 * more than they want to.
 */
export function CheckinForm({ values, onChange, onSubmit, submitting }: Props) {
  const input = toInput(values)
  const [more, setMore] = useState(false)
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => onChange({ ...values, [k]: v })
  // The calendar answer arrives later; apply it to what the form holds then, not to what it held when the button was pressed.
  const latest = useRef(values)
  latest.current = values

  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault()
        if (input && !submitting) onSubmit(input)
      }}
    >
      <ChoiceGroup legend="How are you feeling?" variant="scale" value={values.mood} onChange={(v) => set('mood', v)} options={MOOD} />
      <ChoiceGroup legend="How much energy do you have?" variant="scale" value={values.energy} onChange={(v) => set('energy', v)} options={ENERGY} />

      <div>
        <button
          type="button"
          aria-expanded={more}
          aria-controls="more-options"
          onClick={() => setMore((m) => !m)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">More options</span>
            <span data-testid="options-summary" className="block text-sm text-muted-foreground">
              {optionsSummary(values)}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', more && 'rotate-180')} />
        </button>

        <div id="more-options" hidden={!more} className="mt-6 space-y-7">
          <ChoiceGroup legend="How much time do you have?" value={values.minutes} onChange={(v) => set('minutes', v)} options={MINUTES} />
          <CalendarFit onMinutes={(m) => onChange({ ...latest.current, minutes: m })} />
          <ChoiceGroup
            legend="What would help most right now?"
            hint="Pick one, or leave it as Not sure."
            value={values.goal}
            onChange={(v) => set('goal', v)}
            options={[...GOALS]}
          />
          <ChoiceGroup
            legend="Screen or no screen?"
            hint="Not sure shows a mix: a video where it helps, and plain ideas."
            value={values.screen}
            onChange={(v) => set('screen', v)}
            options={SCREEN_CHOICES}
          />
          <ChoiceGroup<PlaceMode>
            legend="Inside or outside?"
            hint="Outside can suggest a walk to a place nearby. Your location is only used if you allow it, and it isn't saved."
            value={values.place}
            onChange={(v) => set('place', v)}
            options={PLACE_CHOICES}
          />
          <div>
            <label htmlFor="checkin-note" className="text-sm font-medium text-foreground">
              Anything you want to add? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="checkin-note"
              value={values.note}
              maxLength={1000}
              rows={3}
              onChange={(e) => set('note', e.target.value)}
              className="mt-2 border-input bg-card"
              placeholder="A few words about your day, if you like"
            />
            <p className="mt-2 text-xs text-muted-foreground" data-testid="note-privacy">
              Your note is sent to an AI service to help choose ideas. Leave it blank if you would rather not share.{' '}
              <Link to="/privacy" className="underline underline-offset-4">
                How your data is used
              </Link>
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!input} loading={submitting}>
        Show me a few ideas
      </Button>
      {!input && (
        <p className="-mt-4 text-center text-xs text-muted-foreground">Choose how you feel and your energy to continue.</p>
      )}
    </form>
  )
}
