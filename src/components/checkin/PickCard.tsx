import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import type { Pick, VideoRef } from '../../contract'
import { SaveButton } from '../SaveButton'
import { Instructions } from './Instructions'
import type { Helpful } from './WatchPanel'

type VideoPick = Pick & { video: VideoRef }

interface Props {
  pick: Pick
  saved: boolean
  onWatch: () => void
  onReject: () => void
  onToggleSave: () => void
  onFeedback: (helpful: Helpful) => void
}

const OPTIONS: { value: Helpful; label: string }[] = [
  { value: 'yes', label: 'Yes, useful' },
  { value: 'somewhat', label: 'A little' },
  { value: 'no', label: 'Not really' },
]

export function PickCard(props: Props) {
  return props.pick.video ? <VideoCard {...props} pick={props.pick as VideoPick} /> : <IdeaCard {...props} />
}

function VideoCard({ pick, saved, onWatch, onReject, onToggleSave }: Props & { pick: VideoPick }) {
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

/** A screen-free idea: the activity and its steps, no video. */
function IdeaCard({ pick, saved, onToggleSave, onReject, onFeedback }: Props) {
  const [answered, setAnswered] = useState(false)
  return (
    <li
      data-testid="idea-card"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="p-4">
        <h3 className="text-base font-semibold leading-snug text-foreground">{pick.activityTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{pick.reason}</p>
      </div>
      <div className="px-4 pb-3">
        <Instructions activityId={pick.activityId} defaultOpen />
      </div>
      <div className="border-t border-border bg-background/60 px-4 py-3">
        <div className="mb-3">
          <SaveButton saved={saved} onToggle={onToggleSave} label={pick.activityTitle} />
        </div>
        {answered ? (
          <p data-testid="idea-thanks" className="text-sm text-foreground">
            Thanks for letting me know.
          </p>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground">If you try it, was it useful?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onFeedback(o.value)
                    setAnswered(true)
                  }}
                  aria-label={`${o.label}: ${pick.activityTitle}`}
                >
                  {o.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={onReject} aria-label={`Not this one: ${pick.activityTitle}`}>
                Not this one
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
