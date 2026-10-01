/**
 * Journal: the notes the bunny wrote after your chats, saved by you.
 * Private to the signed-in person. Only the summary is stored, never the chat.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmModal, Button } from '@/components/ui'
import { Bunny } from '@/components/Bunny'
import { formatCheckinDate } from '@/lib/format'
import { useJournal } from '@/lib/use-journal'

export default function JournalPage() {
  const journal = useJournal()
  const [deleting, setDeleting] = useState<string | null>(null)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Journal</h1>
      <p className="mt-2 text-base text-muted-foreground">
        The bunny&apos;s notes from when you talked. Only you can see them, and only the notes are kept, never the chat.
      </p>

      <div className="mt-8">
        {journal.status === 'loading' && (
          <p role="status" className="py-12 text-center text-muted-foreground">
            Loading your journal…
          </p>
        )}

        {journal.status === 'error' && (
          <div role="alert" className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium text-foreground">We couldn&apos;t load your journal.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and reload the page.</p>
          </div>
        )}

        {journal.status === 'ready' && journal.records.length === 0 && (
          <div data-testid="journal-empty" className="flex flex-col items-center py-12 text-center">
            <Bunny className="w-48 sm:w-60" />
            <p className="mt-4 text-lg font-semibold text-foreground">Nothing here yet</p>
            <p className="mt-1 max-w-xs text-muted-foreground">Tell the bunny something on Home, and save the notes when you&apos;re done.</p>
            <Link
              to="/home"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Talk to the bunny
            </Link>
          </div>
        )}

        {journal.status === 'ready' && journal.records.length > 0 && (
          <ul className="space-y-4" data-testid="journal-list">
            {journal.records.map((r) => (
              <li
                key={r.recordId}
                data-testid="journal-entry"
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{formatCheckinDate(r.createdAt)}</p>
                    <h2 className="mt-1 text-lg font-bold leading-snug text-foreground">{r.data.title}</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(r.recordId)} aria-label={`Delete entry: ${r.data.title}`}>
                    Delete
                  </Button>
                </div>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
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
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const id = deleting
          setDeleting(null)
          if (id) void journal.remove(id)
        }}
        title="Delete this entry?"
        description="This removes the bunny's notes. It can't be undone."
        confirmText="Delete"
      />
    </div>
  )
}
