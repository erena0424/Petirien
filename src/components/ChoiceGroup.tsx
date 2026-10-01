import { useId } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Choice<T extends string | number> {
  value: T
  label: string
}

interface Props<T extends string | number> {
  legend: string
  hint?: string
  value: T | null
  onChange: (v: T) => void
  options: Choice<T>[]
  /** Layout: equal columns for scales, wrapping chips otherwise. */
  variant?: 'scale' | 'chips'
}

/**
 * Single-choice group built on native radio inputs, so keyboard and screen
 * reader behavior come from the browser. The selected state uses a check mark,
 * a darker border, and a tinted surface: it never relies on color alone.
 */
export function ChoiceGroup<T extends string | number>({
  legend,
  hint,
  value,
  onChange,
  options,
  variant = 'chips',
}: Props<T>) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div
        className={cn(
          'mt-3 gap-2',
          variant === 'scale' ? 'grid grid-cols-5' : 'flex flex-wrap',
        )}
      >
        {options.map((o) => {
          const selected = value === o.value
          return (
            <label key={String(o.value)} className="relative">
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-sm transition-colors',
                  'border-input bg-card text-foreground hover:bg-secondary',
                  'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                  selected && 'border-primary bg-secondary font-medium',
                )}
              >
                {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />}
                {o.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
