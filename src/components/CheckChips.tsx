import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TagOption } from '@/lib/preferences'

interface Props {
  legend: string
  hint?: string
  options: TagOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Tags that cannot be chosen here (already chosen in the opposite list). */
  disabledTags?: string[]
}

/**
 * Multi-choice chips on native checkboxes (keyboard and screen reader support
 * come from the browser). Selected = check mark + darker border + tinted
 * surface, never color alone.
 */
export function CheckChips({ legend, hint, options, selected, onChange, disabledTags = [] }: Props) {
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  return (
    <fieldset className="min-w-0">
      <legend className="text-base font-semibold text-foreground">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.tag)
          const disabled = disabledTags.includes(o.tag)
          return (
            <label key={o.tag} className={cn('relative', disabled && 'opacity-50')}>
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() => toggle(o.tag)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                  'border-input bg-card text-foreground hover:bg-secondary peer-disabled:cursor-not-allowed',
                  'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                  on && 'border-primary bg-secondary font-medium',
                )}
              >
                {on && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />}
                {o.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
