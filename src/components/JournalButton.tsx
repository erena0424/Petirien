import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'

/**
 * "Turn this conversation into journal": writes the open, saved conversation up as a Journal entry now (the bunny
 * also does it by itself after a while). Hidden until there is something of yours to write about, and for a chat
 * that is not being saved (the server only reads stored messages).
 */
export function JournalButton({ className }: { className?: string }) {
  const chat = useBunnyChat()
  const [status, setStatus] = useState<'idle' | 'writing' | 'done' | 'none' | 'unavailable'>('idle')
  const can = !!chat.conversationId && chat.thread.some((m) => m.role === 'user')
  if (!can) return null

  async function write() {
    setStatus('writing')
    const result = await chat.writeNotesNow()
    setStatus(result === 'ok' ? 'done' : result)
  }

  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={() => void write()} disabled={status === 'writing' || chat.sending} data-testid="journal-button">
        {status === 'writing' ? 'Writing…' : 'Turn this conversation into journal'}
      </Button>
      {status === 'done' && (
        <span data-testid="notes-written" className="ml-2 text-sm text-foreground">
          Added to your{' '}
          <Link to="/journal" className="font-medium text-primary underline underline-offset-4">
            Journal
          </Link>
          .
        </span>
      )}
      {status === 'unavailable' && <span data-testid="journal-unavailable" className="ml-2 text-sm text-foreground">The bunny is resting right now, so I can't write it up. Please try again a little later.</span>}
      {status === 'none' && <span className="ml-2 text-sm text-muted-foreground">Nothing new to write up yet.</span>}
    </div>
  )
}
