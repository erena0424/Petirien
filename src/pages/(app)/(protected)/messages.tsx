/**
 * Messages: talk with the bunny like texting. Saved conversations are listed
 * on the side; a chat marked "Don't save this chat" never appears here.
 */

import { PageHeader } from '@/components/PageHeader'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmModal } from '@/components/ui'
import { BunnyThread } from '@/components/BunnyThread'
import { JournalButton } from '@/components/JournalButton'
import { useBunnyChat } from '@/lib/bunny-chat'
import { formatCheckinDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function MessagesPage() {
  const chat = useBunnyChat()
  const [deleting, setDeleting] = useState<string | null>(null)

  return (
    <div className="w-full">
      <PageHeader
        compact
        title="Chat"
        action={
          <Button variant="outline" className="rounded-full bg-card" onClick={() => chat.newConversation()}>
            <Plus aria-hidden className="h-4 w-4" />
            New conversation
          </Button>
        }
      >
        Talk to the bunny. Your conversations are saved here unless you choose not to.
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
        <div className="grid items-start gap-5 md:grid-cols-[16rem_1fr]">
          <nav aria-label="Conversations" className="md:max-h-[calc(100vh-15rem)] md:overflow-y-auto">
            {!chat.conversationsReady && <p className="text-sm text-muted-foreground">Loading…</p>}
            {chat.conversationsReady && chat.conversations.length === 0 && (
              <p data-testid="messages-empty" className="rounded-2xl bg-secondary p-4 text-sm text-foreground">
                No saved conversations yet. Say something to the bunny and it will show up here.
              </p>
            )}
            <ul className="flex max-h-44 gap-2 overflow-x-auto md:max-h-none md:flex-col md:overflow-x-visible" data-testid="conversation-list">
              {chat.conversations.map((c) => {
                const active = c.recordId === chat.conversationId
                return (
                  <li key={c.recordId} className="group relative min-w-[13rem] md:min-w-0">
                    <button
                      type="button"
                      data-testid="conversation-item"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        chat.open(c.recordId)
                      }}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 pr-11 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        active ? 'border-primary bg-secondary' : 'border-border bg-card',
                      )}
                    >
                      <span className="block truncate text-base font-semibold text-foreground">{c.data.title || 'Conversation'}</span>
                      <span className="block text-xs text-muted-foreground">{formatCheckinDate(new Date(c.data.lastMessageAt).toISOString())}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c.recordId)}
                      aria-label={`Delete conversation: ${c.data.title || 'Conversation'}`}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex h-[calc(100vh-15rem)] min-h-[30rem] flex-col rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
            <BunnyThread />
            <JournalButton className="mt-3 flex flex-wrap items-center border-t border-border pt-3" />
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
    </div>
  )
}
