import { Link } from 'react-router-dom'
import { useBunnyChat } from '@/lib/bunny-chat'

/** Shown only when the bunny thinks a small idea might help. Optional, quiet, and never the only way forward. */
export function OfferLink() {
  const chat = useBunnyChat()
  if (!chat.offerHref || chat.sending || chat.error) return null
  return (
    <Link
      to={chat.offerHref}
      data-testid="bunny-offer"
      className="inline-flex min-h-10 items-center self-start rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Find a small idea
    </Link>
  )
}
