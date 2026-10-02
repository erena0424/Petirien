import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ENERGY, label } from '@/lib/labels'
import { useSavedIdeas } from '@/lib/use-saved-ideas'
import { useSavedVideos } from '@/lib/use-saved'
import { getActivity } from '../catalog'
import { clearChoice, clearPending, loadChoice, loadPending } from '../preview/pending'
import { thumbnailFor, watchUrlFor } from '../preview/preview'

/**
 * The other half of the preview: right after someone signs in, finish what they started. A sample they pressed Save on is
 * saved now, and the energy and time they picked are offered back, so they carry on where they were instead of starting
 * over. Shown once; it forgets what it held either way.
 */
export function ResumePreview() {
  const ideas = useSavedIdeas()
  const videos = useSavedVideos()
  const [choice, setChoice] = useState(() => loadChoice())
  const [savedTitle, setSavedTitle] = useState<string | null>(null)
  const ran = useRef(false)
  const ready = ideas.ready && videos.ready

  // Save what they pressed Save on, once the connection can take the write.
  useEffect(() => {
    if (!ready || ran.current) return
    const pending = loadPending()
    ran.current = true
    if (!pending) return
    clearPending() // forget it first, so a reload can never save it twice
    const activity = getActivity(pending.activityId)
    if (!activity) return
    void (async () => {
      if (pending.kind === 'idea') await ideas.save(pending.activityId)
      else {
        // Only our own words and the standard picture for the id: nothing from YouTube's metadata is stored here.
        await videos.save(
          { videoId: pending.videoId, title: activity.title, channel: '', thumbnail: thumbnailFor(pending.videoId), durationSec: 0, watchUrl: watchUrlFor(pending.videoId) },
          pending.activityId,
        )
      }
      setSavedTitle(activity.title)
    })()
  }, [ready])

  if (!savedTitle && !choice) return null
  const query = choice ? `?minutes=${choice.minutes}&energy=${choice.energy}` : ''
  return (
    <section aria-label="Welcome back" data-testid="resume" className="mb-8 rounded-2xl bg-accent p-4">
      {savedTitle && (
        <p data-testid="resume-saved" role="status" className="text-base font-semibold text-foreground">
          Saved: {savedTitle}. You&apos;ll find it under <Link to="/saved" className="text-primary underline underline-offset-4">Saved</Link>.
        </p>
      )}
      {choice && (
        <div data-testid="resume-choice" className={savedTitle ? 'mt-3' : ''}>
          <p className="text-base text-foreground">
            Welcome. Want to pick up where you left off? You had {label(ENERGY, choice.energy).toLowerCase()} energy and about {choice.minutes} minutes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/checkin${query}`}
              onClick={clearChoice}
              data-testid="resume-continue"
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Find ideas with this
            </Link>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                clearChoice()
                setChoice(null)
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
