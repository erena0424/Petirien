import { Link } from 'react-router-dom'
import { Button, Textarea } from '@/components/ui'
import type { CheckinInput } from '../../contract'
import { ENERGY, MOOD } from '@/lib/labels'
import { ChoiceGroup } from '../ChoiceGroup'

export interface FormValues {
  mood: number | null
  energy: number | null
  minutes: number | null
  goal: NonNullable<CheckinInput['goal']> | ''
  note: string
  screen: 'auto' | 'none'
}

export const EMPTY_FORM: FormValues = { mood: null, energy: null, minutes: 10, goal: '', note: '', screen: 'auto' }

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
    ...(v.screen === 'none' ? { screen: 'none' as const } : {}),
  }
}

interface Props {
  values: FormValues
  onChange: (v: FormValues) => void
  onSubmit: (input: CheckinInput) => void
  submitting: boolean
}

export function CheckinForm({ values, onChange, onSubmit, submitting }: Props) {
  const input = toInput(values)
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => onChange({ ...values, [k]: v })

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
      <ChoiceGroup legend="How much time do you have?" value={values.minutes} onChange={(v) => set('minutes', v)} options={MINUTES} />
      <ChoiceGroup
        legend="What would help most right now?"
        hint="Pick one, or skip it."
        value={values.goal}
        onChange={(v) => set('goal', v)}
        options={[...GOALS]}
      />

      <ChoiceGroup<'auto' | 'none'>
        legend="Screen or no screen?"
        hint="Videos only show up where they help, like guided meditation or stretching."
        value={values.screen}
        onChange={(v) => set('screen', v)}
        options={[
          { value: 'auto', label: 'Videos where they help' },
          { value: 'none', label: 'No screen, just ideas' },
        ]}
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

      <Button type="submit" size="lg" className="w-full" disabled={!input} loading={submitting}>
        Show me a few ideas
      </Button>
      {!input && (
        <p className="-mt-4 text-center text-xs text-muted-foreground">Choose how you feel and your energy to continue.</p>
      )}
    </form>
  )
}
