/**
 * Messages: talk with the bunny like texting. Saved conversations are listed
 * on the side; a chat marked "Don't save this chat" never appears here.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button, ConfirmModal } from '@/components/ui'
import { BunnyThread } from '@/components/BunnyThread'
import { useBunnyChat } from '@/lib/bunny-chat'
import { formatCheckinDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function MessagesPage() {
  const chat = useBunnyChat()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [noteStatus, setNoteStatus] = useState<'idle' | 'writing' | 'done' | 'none'>('idle')

  const canWriteNotes = !!chat.conversationId && chat.thread.some((m) => m.role === 'user')

  async function writeNotes() {
    setNoteStatus('writing')
    setNoteStatus((await chat.writeNotesNow()) ? 'done' : 'none')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="mt-1 text-base text-muted-foreground">Talk to the bunny. Your conversations are saved here unless you choose not to.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setNoteStatus('idle')
            chat.newConversation()
          }}
        >
          <Plus aria-hidden className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-[15rem_1fr]">
        <nav aria-label="Conversations" className="md:max-h-[70vh] md:overflow-y-auto">
          {!chat.conversationsReady && <p className="text-sm text-muted-foreground">Loading…</p>}
          {chat.conversationsReady && chat.conversations.length === 0 && (
            <p data-testid="messages-empty" className="rounded-xl bg-secondary p-4 text-sm text-foreground">
              No saved conversations yet. Say something to the bunny and it will show up here.
            </p>
          )}
          <ul className="max-h-48 space-y-2 overflow-y-auto md:max-h-none" data-testid="conversation-list">
            {chat.conversations.map((c) => {
              const active = c.recordId === chat.conversationId
              return (
                <li key={c.recordId} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    data-testid="conversation-item"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setNoteStatus('idle')
                      chat.open(c.recordId)
                    }}
                    className={cn(
                      'min-w-0 flex-1 rounded-xl border px-3 py-2 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      active ? 'border-primary bg-secondary' : 'border-border bg-card',
                    )}
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">{c.data.title || 'Conversation'}</span>
                    <span className="block text-xs text-muted-foreground">{formatCheckinDate(new Date(c.data.lastMessageAt).toISOString())}</span>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c.recordId)} aria-label={`Delete conversation: ${c.data.title || 'Conversation'}`}>
                    Delete
                  </Button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex min-h-[calc(100vh-16rem)] flex-col justify-end rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          <BunnyThread />
          {canWriteNotes && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
              <Button variant="outline" size="sm" onClick={() => void writeNotes()} disabled={noteStatus === 'writing' || chat.sending}>
                {noteStatus === 'writing' ? 'Writing notes…' : 'Write notes about this now'}
              </Button>
              {noteStatus === 'done' && (
                <span data-testid="notes-written" className="text-foreground">
                  Added to your <Link to="/journal" className="font-medium text-primary underline underline-offset-4">Journal</Link>.
                </span>
              )}
              {noteStatus === 'none' && <span className="text-muted-foreground">Nothing new to write up yet.</span>}
              <span className="text-xs text-muted-foreground">The bunny also writes notes by itself after a while.</span>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const id = deleting
          setDeleting(null)
          if (id) void chat.deleteConversation(id)
        }}
        title="Delete this conversation?"
        description="This removes the messages. Any notes the bunny wrote about it stay in your Journal; you can delete them there."
        confirmText="Delete"
      />
    </div>
  )
}
