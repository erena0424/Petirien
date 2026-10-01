import { Bookmark } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  saved: boolean
  onToggle: () => void
  /** What is being saved, for screen readers. */
  label: string
}

/** Save / Saved toggle. Pressed state is conveyed by the filled icon and the word, not color alone. */
export function SaveButton({ saved, onToggle, label }: Props) {
  return (
    <Button
      variant="outline"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove from saved: ${label}` : `Save: ${label}`}
    >
      <Bookmark aria-hidden className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
      {saved ? 'Saved' : 'Save'}
    </Button>
  )
}
