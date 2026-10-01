/** Words for the numeric scales and goals, shared by the form and the history. */

export const MOOD = [
  { value: 1, label: 'Very low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
]

export const ENERGY = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Lots' },
]

export const GOAL_LABELS: Record<string, string> = {
  calm: 'Calm down',
  express: 'Express something',
  connect: 'Feel connected',
  move: 'Get moving',
  break: 'Take a break',
}

export const label = (scale: { value: number; label: string }[], v: unknown): string =>
  scale.find((s) => s.value === v)?.label ?? ''

export const HELPFUL_LABELS: Record<string, string> = {
  yes: 'Useful',
  somewhat: 'A little useful',
  no: 'Not useful',
}
