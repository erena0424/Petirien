import { Button } from '@/components/ui'
import { formatCheckinDate } from '@/lib/format'
import type { JournalRow } from '@/lib/use-journal'
import { isReflection, readReflection } from '../../plans/reflection'
import type { ReflectOn } from '../ReflectionDialog'

export interface JournalRecord {
  recordId: string
  createdAt: string
  data: JournalRow
}

interface Props {
  record: JournalRecord
  onEdit: (plan: ReflectOn) => void
  onDelete: (recordId: string) => void
  /** A short version for the week view: title, a line of text, and no buttons. */
  compact?: boolean
  onOpen?: () => void
}

/** One Journal entry: the bunny's notes from a chat, or a reflection the person wrote about a plan. */
export function JournalEntryCard({ record: r, onEdit, onDelete, compact, onOpen }: Props) {
  const reflection = isReflection(r.data)
  const mine = reflection ? readReflection(r.data) : null

  if (compact) {
    const line = reflection ? mine!.text : (r.data.notes ?? [])[0]
    return (
      <li data-testid={reflection ? 'journal-reflection-compact' : 'journal-entry-compact'}>
        <button
          type="button"
          onClick={onOpen}
          className="w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="block text-xs font-medium text-muted-foreground">{reflection ? 'Reflection' : 'Bunny note'}</span>
          <span className="mt-0.5 block text-sm font-semibold leading-snug text-foreground">{r.data.title}</span>
          {line && <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-muted-foreground">{line}</span>}
        </button>
      </li>
    )
  }

  if (reflection) {
    return (
      <li data-testid="journal-reflection" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reflection{r.data.eventStart ? ` · ${formatCheckinDate(r.data.eventStart)}` : ''}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-foreground">{r.data.title}</h2>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!r.data.eventId}
              onClick={() => r.data.eventId && onEdit({ id: r.data.eventId, title: r.data.title, start: r.data.eventStart ?? r.createdAt })}
              aria-label={`Edit reflection: ${r.data.title}`}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(r.recordId)} aria-label={`Delete entry: ${r.data.title}`}>
              Delete
            </Button>
          </div>
        </div>
        {mine!.feeling && (
          <p className="mt-3">
            <span className="rounded-full bg-accent px-3 py-1 text-sm text-foreground">{mine!.feeling}</span>
          </p>
        )}
        {mine!.text && <p className="font-hand mt-3 whitespace-pre-wrap text-base text-foreground">{mine!.text}</p>}
      </li>
    )
  }

  return (
    <li data-testid="journal-entry" className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {formatCheckinDate(r.createdAt)}
            {r.data.eventTitle ? ` · About ${r.data.eventTitle}` : ''}
          </p>
          <h2 className="mt-1 text-lg font-bold leading-snug text-foreground">{r.data.title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(r.recordId)} aria-label={`Delete entry: ${r.data.title}`}>
          Delete
        </Button>
      </div>
      <ul className="font-hand mt-3 list-disc space-y-1.5 pl-5 text-base text-foreground">
        {(r.data.notes ?? []).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {(r.data.feelings ?? []).length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Feelings">
          {(r.data.feelings ?? []).map((f) => (
            <li key={f} className="rounded-full bg-secondary px-3 py-1 text-sm text-foreground">
              {f}
            </li>
          ))}
        </ul>
      )}
      {r.data.bunnyNote && <p className="mt-3 text-sm italic text-muted-foreground">{r.data.bunnyNote}</p>}
    </li>
  )
}
