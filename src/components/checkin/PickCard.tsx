import { Play } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import type { Pick, VideoRef } from '../../contract'
import { SaveButton } from '../SaveButton'
import { getActivity } from '../../catalog'
import { Instructions } from './Instructions'
import { PlaceSuggestions } from '../PlaceSuggestions'
import { SuggestionFeedback } from './SuggestionFeedback'

type VideoPick = Pick & { video: VideoRef }

interface Props {
  pick: Pick
  saved: boolean
  onWatch: () => void
  onReject: () => void
  onToggleSave: () => void
  onFeedback: (helpful: 'yes' | 'no') => void
  canSave?: boolean
}


export function PickCard(props: Props) {
  return props.pick.video ? <VideoCard {...props} pick={props.pick as VideoPick} /> : <IdeaCard {...props} />
}

function VideoCard({ pick, saved, canSave = true, onWatch, onReject, onToggleSave, onFeedback }: Props & { pick: VideoPick }) {
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
          className="h-14 w-24 shrink-0 rounded-lg bg-muted object-cover sm:h-20 sm:w-36"
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
        <SaveButton saved={saved} onToggle={onToggleSave} label={video.title} disabled={!canSave} />
        <Button variant="ghost" onClick={onReject} aria-label={`Not this one: ${video.title}`}>
          Not this one
        </Button>
        <div className="ml-auto">
          <SuggestionFeedback title={video.title} onRate={onFeedback} />
        </div>
      </div>
    </li>
  )
}

/** A screen-free idea: the activity and its steps, no video. */
function IdeaCard({ pick, saved, canSave = true, onToggleSave, onReject, onFeedback }: Props) {
  const places = !!getActivity(pick.activityId)?.places
  return (
    <li
      data-testid="idea-card"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
    >
      {places ? (
        // A place to visit: concrete places, each with its own thumbs, instead of a title and a menu.
        <div className="p-4">
          <PlaceSuggestions />
          <div className="mt-3">
            <Instructions activityId={pick.activityId} />
          </div>
        </div>
      ) : (
        <>
          <div className="p-4">
            <h3 className="text-base font-semibold leading-snug text-foreground">{pick.activityTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{pick.reason}</p>
          </div>
          <div className="px-4 pb-3">
            <Instructions activityId={pick.activityId} defaultOpen />
          </div>
        </>
      )}
      <div className="border-t border-border bg-background/60 px-4 py-3">
        <div className="mb-3">
          <SaveButton saved={saved} onToggle={onToggleSave} label={pick.activityTitle} disabled={!canSave} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Good or not for me is on each specific place, not on going outside as a whole. */}
          {!places && <SuggestionFeedback title={pick.activityTitle} onRate={onFeedback} />}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onReject} aria-label={`Not this one: ${pick.activityTitle}`}>
            Not this one
          </Button>
        </div>
      </div>
    </li>
  )
}
