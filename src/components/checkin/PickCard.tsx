import { Play } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import type { Pick } from '../../contract'
import { SaveButton } from '../SaveButton'
import { Instructions } from './Instructions'

interface Props {
  pick: Pick
  saved: boolean
  onWatch: () => void
  onReject: () => void
  onToggleSave: () => void
}

export function PickCard({ pick, saved, onWatch, onReject, onToggleSave }: Props) {
  const { video } = pick
  const length = formatDuration(video.durationSec)
  return (
    <li
      data-testid="pick-card"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="flex gap-4 p-4">
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="hidden h-20 w-36 shrink-0 rounded-lg bg-muted object-cover sm:block"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{pick.activityTitle}</p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{video.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {[length, video.channel].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{pick.reason}</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <Instructions activityId={pick.activityId} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-4 py-3">
        <Button onClick={onWatch} aria-label={`Watch: ${video.title}`}>
          <Play aria-hidden className="h-4 w-4" />
          Watch
        </Button>
        <SaveButton saved={saved} onToggle={onToggleSave} label={video.title} />
        <Button variant="ghost" onClick={onReject} aria-label={`Not this one: ${video.title}`}>
          Not this one
        </Button>
      </div>
    </li>
  )
}
