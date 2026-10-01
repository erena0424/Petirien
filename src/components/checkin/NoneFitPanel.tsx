import { Button } from '@/components/ui'

export type ReasonChip = 'too_long' | 'too_much_effort' | 'not_my_thing' | 'different_kind'

const REASONS: { value: ReasonChip; label: string }[] = [
  { value: 'too_long', label: 'Too long' },
  { value: 'too_much_effort', label: 'Too much effort' },
  { value: 'not_my_thing', label: 'Not my thing' },
  { value: 'different_kind', label: 'Something different' },
]

interface Props {
  canRetry: boolean
  loading: boolean
  onReason: (r: ReasonChip) => void
  onStartOver: () => void
}

export function NoneFitPanel({ canRetry, loading, onReason, onStartOver }: Props) {
  if (!canRetry) {
    return (
      <div data-testid="none-fit-done" className="rounded-2xl border border-border bg-secondary p-5">
        <p className="text-sm text-foreground">
          That&apos;s okay. Nothing has to fit today, and resting counts too. Your saved videos will be here when you want them.
        </p>
        <Button className="mt-4" variant="outline" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    )
  }
  return (
    <div data-testid="none-fit" className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">None of these fit?</h3>
      <p className="mt-1 text-sm text-muted-foreground">Tell me what was off and I&apos;ll try again.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <Button key={r.value} variant="outline" disabled={loading} onClick={() => onReason(r.value)}>
            {r.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
