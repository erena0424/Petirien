/**
 * Check-in flow: form → ideas → watch → feedback.
 * One state machine on one page; the server action does the thinking.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutations } from 'deepspace'
import { Button } from '@/components/ui'
import { formatResetTime } from '@/lib/format'
import { requestRecommendations } from '@/lib/recommend-client'
import { usePreferences } from '@/lib/use-preferences'
import { useSavedVideos } from '@/lib/use-saved'
import { CheckinForm, EMPTY_FORM, type FormValues } from '@/components/checkin/CheckinForm'
import { NoneFitPanel, type ReasonChip } from '@/components/checkin/NoneFitPanel'
import { Instructions } from '@/components/checkin/Instructions'
import { PickCard } from '@/components/checkin/PickCard'
import { WatchPanel, type Helpful } from '@/components/checkin/WatchPanel'
import { Bunny } from '@/components/Bunny'
import { CompanionSays } from '@/components/CompanionSays'
import { SupportCard } from '@/components/SupportCard'
import type { CheckinInput, Pick, RecommendResponse } from '../../../contract'

type Stage =
  | { kind: 'form' }
  | { kind: 'loading' }
  | { kind: 'result'; res: RecommendResponse }

/** After this many retries we stop asking and say it is fine to rest. */
const MAX_RETRIES = 2

export default function CheckinPage() {
  const { put, ready } = useMutations<Record<string, unknown>>('suggestions')
  const saved = useSavedVideos()
  const preferences = usePreferences()

  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const [watching, setWatching] = useState<Pick | null>(null)
  const [hidden, setHidden] = useState<string[]>([]) // suggestion ids the person said no to
  const [excluded, setExcluded] = useState<string[]>([]) // activity ids to avoid next time
  const [retries, setRetries] = useState(0)
  const [checkinId, setCheckinId] = useState<string | undefined>()
  const lastInput = useRef<CheckinInput | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // Start from the person's usual time, once, unless they already changed it.
  const appliedUsual = useRef(false)
  useEffect(() => {
    if (appliedUsual.current || preferences.status !== 'ready') return
    appliedUsual.current = true
    const usual = preferences.prefs.defaultMinutes
    if (usual) setValues((v) => (v.minutes === EMPTY_FORM.minutes ? { ...v, minutes: usual } : v))
  }, [preferences.status, preferences.prefs.defaultMinutes])

  // Move focus to the new content so screen reader users hear what changed.
  useEffect(() => {
    if (stage.kind !== 'form') heading.current?.focus()
  }, [stage.kind, watching])

  const write = (id: string, patch: Record<string, unknown>) => {
    if (ready && id) void put(id, patch)
  }

  async function run(input: CheckinInput, opts: { exclude: string[]; checkinId?: string }) {
    lastInput.current = input
    setStage({ kind: 'loading' })
    const res = await requestRecommendations({
      ...input,
      ...(opts.exclude.length ? { excludeActivityIds: opts.exclude } : {}),
      ...(opts.checkinId ? { checkinId: opts.checkinId } : {}),
    })
    if ('checkinId' in res) setCheckinId(res.checkinId)
    setHidden([])
    setStage({ kind: 'result', res })
  }

  function startOver() {
    setStage({ kind: 'form' })
    setWatching(null)
    setHidden([])
    setExcluded([])
    setRetries(0)
    setCheckinId(undefined)
  }

  function submit(input: CheckinInput) {
    setExcluded([])
    setRetries(0)
    setWatching(null)
    void run(input, { exclude: [] })
  }

  function reject(p: Pick) {
    write(p.suggestionId, { status: 'rejected' })
    setHidden((h) => [...h, p.suggestionId])
    setExcluded((e) => [...e, p.activityId])
  }

  function noneFit(res: Extract<RecommendResponse, { status: 'ok' }>, reason: ReasonChip) {
    for (const p of res.picks) write(p.suggestionId, { status: 'rejected', reasonChip: reason })
    const next = [...new Set([...excluded, ...res.picks.map((p) => p.activityId)])]
    setExcluded(next)
    setRetries((n) => n + 1)
    if (lastInput.current) void run(lastInput.current, { exclude: next, checkinId })
  }

  function toggleSave(p: Pick) {
    if (saved.isSaved(p.video.videoId)) {
      void saved.unsave(p.video.videoId)
    } else {
      void saved.save(p.video, p.activityId)
      write(p.suggestionId, { status: 'saved' })
    }
  }

  function watch(p: Pick) {
    write(p.suggestionId, { status: 'opened' })
    setWatching(p)
  }

  function feedback(helpful: Helpful) {
    if (watching) write(watching.suggestionId, { helpful })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {stage.kind === 'form' && (
        <>
          <div className="mb-8 flex items-center gap-4">
            <Bunny className="w-28 shrink-0 sm:w-40" />
            <div>
              <h1 ref={heading} className="text-2xl font-bold tracking-tight text-foreground">
                How&apos;s today going?
              </h1>
              <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                A few taps is enough. I&apos;ll find something small that fits.
              </p>
            </div>
          </div>
          <CheckinForm values={values} onChange={setValues} onSubmit={submit} submitting={false} />
        </>
      )}

      {stage.kind === 'loading' && (
        <div role="status" aria-live="polite" data-testid="loading" className="flex flex-col items-center gap-4 py-24 text-center">
          <Bunny className="w-48 sm:w-64" />
          <p className="text-base font-medium text-foreground">Looking for a few things for you…</p>
          <p className="text-sm text-muted-foreground">This can take several seconds.</p>
        </div>
      )}

      {stage.kind === 'result' && watching && (
        <WatchPanel
          key={watching.suggestionId}
          pick={watching}
          saved={saved.isSaved(watching.video.videoId)}
          onToggleSave={() => toggleSave(watching)}
          onBack={() => setWatching(null)}
          onStartOver={startOver}
          onFeedback={feedback}
        />
      )}

      {stage.kind === 'result' && !watching && (
        <Result
          res={stage.res}
          hidden={hidden}
          retries={retries}
          headingRef={heading}
          isSaved={saved.isSaved}
          onWatch={watch}
          onReject={reject}
          onToggleSave={toggleSave}
          onNoneFit={(r) => stage.res.status === 'ok' && noneFit(stage.res, r)}
          onRetrySame={() => lastInput.current && void run(lastInput.current, { exclude: excluded, checkinId })}
          onEdit={() => setStage({ kind: 'form' })}
          onStartOver={startOver}
        />
      )}
    </div>
  )
}

interface ResultProps {
  res: RecommendResponse
  hidden: string[]
  retries: number
  headingRef: React.RefObject<HTMLHeadingElement | null>
  isSaved: (videoId: string) => boolean
  onWatch: (p: Pick) => void
  onReject: (p: Pick) => void
  onToggleSave: (p: Pick) => void
  onNoneFit: (r: ReasonChip) => void
  onRetrySame: () => void
  onEdit: () => void
  onStartOver: () => void
}

const Companion = CompanionSays

function Result(p: ResultProps) {
  const { res } = p

  if (res.status === 'support') {
    return (
      <div className="space-y-5" data-testid="support-result">
        <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          I&apos;m glad you said something
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          It sounds like things may be really hard right now. You deserve support from a real person, and it is okay to reach out.
        </p>
        <SupportCard heading="Talk to someone now" />
        <Button variant="ghost" onClick={p.onStartOver}>
          Back to check-in
        </Button>
      </div>
    )
  }

  if (res.status === 'capped') {
    return (
      <div className="space-y-4" data-testid="capped-result">
        <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          That&apos;s enough for today
        </h1>
        <Companion>
          You&apos;ve reached today&apos;s limit for new ideas. It resets around {formatResetTime(res.resetsAt)}. Resting counts too.
        </Companion>
        <Button variant="outline" onClick={p.onStartOver}>
          Back
        </Button>
      </div>
    )
  }

  if (res.status === 'error') {
    return (
      <div className="space-y-4" role="alert" data-testid="error-result">
        <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          That didn&apos;t work
        </h1>
        <Companion>{res.message}</Companion>
        <div className="flex flex-wrap gap-2">
          <Button onClick={p.onRetrySame}>Try again</Button>
          <Button variant="ghost" onClick={p.onEdit}>
            Change my answers
          </Button>
        </div>
      </div>
    )
  }

  if (res.status === 'nothing_fits') {
    return (
      <div className="space-y-4" data-testid="nothing-fits-result">
        <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          Nothing small enough
        </h1>
        <Companion>{res.reply}</Companion>
        <Button variant="outline" onClick={p.onEdit}>
          Change time or energy
        </Button>
      </div>
    )
  }

  if (res.status === 'no_video') {
    return (
      <div className="space-y-5" data-testid="no-video-result">
        <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
          A few ideas
        </h1>
        <Companion>{res.reply}</Companion>
        <p className="text-sm text-muted-foreground">
          Videos aren&apos;t loading right now, so here are the ideas on their own. You can try again in a moment.
        </p>
        <ul className="space-y-3">
          {res.activities.map((a) => (
            <li key={a.activityId} className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">{a.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{a.blurb}</p>
              <div className="mt-2">
                <Instructions activityId={a.activityId} defaultOpen />
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button onClick={p.onRetrySame}>Try again</Button>
          <Button variant="ghost" onClick={p.onStartOver}>
            Start over
          </Button>
        </div>
      </div>
    )
  }

  const visible = res.picks.filter((pick) => !p.hidden.includes(pick.suggestionId))
  return (
    <div className="space-y-5" data-testid="ok-result">
      <h1 ref={p.headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none">
        Here are a few ideas
      </h1>
      <Companion>{res.reply}</Companion>
      {visible.length > 0 && (
        <ul className="space-y-4">
          {visible.map((pick) => (
            <PickCard
              key={pick.suggestionId}
              pick={pick}
              saved={p.isSaved(pick.video.videoId)}
              onWatch={() => p.onWatch(pick)}
              onReject={() => p.onReject(pick)}
              onToggleSave={() => p.onToggleSave(pick)}
            />
          ))}
        </ul>
      )}
      <NoneFitPanel
        canRetry={p.retries < MAX_RETRIES}
        loading={false}
        onReason={p.onNoneFit}
        onStartOver={p.onStartOver}
      />
    </div>
  )
}
