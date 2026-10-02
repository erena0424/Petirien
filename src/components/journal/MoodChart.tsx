import { Link } from 'react-router-dom'
import { ENERGY, MOOD, label } from '@/lib/labels'
import type { View } from '../../journal/calendar'
import { dailyAverages, inRange, linePath, summarize, toPoints, toXY, type CheckinPoint, type Dims } from '../../journal/mood'
import { chartRange } from '../../journal/mood'
import type { CheckinRow } from '@/lib/use-checkins'

const DIMS: Dims = { width: 640, height: 230, padLeft: 34, padRight: 16, padTop: 14, padBottom: 34 }

const dateLabel = (d: Date, withTime = false) =>
  withTime ? d.toLocaleTimeString([], { hour: 'numeric' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })

/**
 * How mood and energy have been over the range on screen, from check-ins: two lines on a 1 to 5 scale, drawn so they
 * differ by shape and not just color (mood: solid, round markers; energy: dashed, square markers), with a calm sentence
 * and the same numbers as a table for anyone who cannot see the chart. Low is never styled as bad.
 */
export function MoodChart({ rows, view, anchor }: { rows: { createdAt: string; data: CheckinRow }[]; view: View; anchor: Date }) {
  const { from, to } = chartRange(view, anchor, new Date())
  const points = inRange(toPoints(rows), from, to)
  const summary = summarize(points)
  // One point per day for a month, week or the list; every check-in for a single day.
  const dayView = view === 'day'
  const series: { at: number; mood: number; energy: number }[] = dayView ? points : dailyAverages(points)
  const mood = series.map((p) => toXY(p.at, p.mood, from, to, DIMS))
  const energy = series.map((p) => toXY(p.at, p.energy, from, to, DIMS))
  const ticks = dayView ? [0, 6, 12, 18, 24].map((h) => new Date(from.getFullYear(), from.getMonth(), from.getDate(), h)) : [from, new Date((from.getTime() + to.getTime()) / 2), new Date(to.getTime() - 86_400_000)]

  return (
    <section data-testid="mood-chart" aria-labelledby="mood-heading" className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 id="mood-heading" className="text-lg font-bold text-foreground">
        Mood and energy
      </h2>

      {!summary ? (
        <p data-testid="mood-empty" className="mt-2 text-sm text-muted-foreground">
          No check-ins in this stretch yet. A check-in takes a moment, and it shows up here.{' '}
          <Link to="/checkin" className="font-medium text-primary underline-offset-4 hover:underline">
            Check in
          </Link>
        </p>
      ) : (
        <>
          <p data-testid="mood-summary" className="mt-1 text-sm text-foreground">
            {summary.text}
          </p>
          <svg
            viewBox={`0 0 ${DIMS.width} ${DIMS.height}`}
            role="img"
            aria-label={`Chart of mood and energy from 1 to 5. ${summary.text}`}
            className="mt-3 h-auto w-full"
            data-testid="mood-svg"
          >
            {[1, 2, 3, 4, 5].map((v) => {
              const y = toXY(from.getTime(), v, from, to, DIMS).y
              return (
                <g key={v}>
                  <line x1={DIMS.padLeft} x2={DIMS.width - DIMS.padRight} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                  <text x={DIMS.padLeft - 8} y={y + 4} textAnchor="end" fontSize={12} fill="var(--color-muted-foreground)">
                    {v}
                  </text>
                </g>
              )
            })}
            {ticks.map((t, i) => (
              <text
                key={i}
                x={toXY(t.getTime(), 3, from, to, DIMS).x}
                y={DIMS.height - 10}
                // the first and last labels hang inward, so neither is cut off at the edge
                textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fill="var(--color-muted-foreground)"
              >
                {dateLabel(t, dayView)}
              </text>
            ))}
            <path d={linePath(energy)} fill="none" stroke="var(--color-energy)" strokeWidth={2.5} strokeDasharray="7 5" data-testid="energy-line" />
            <path d={linePath(mood)} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} data-testid="mood-line" />
            {energy.map((p, i) => (
              <rect key={`e${i}`} x={p.x - 4.5} y={p.y - 4.5} width={9} height={9} fill="var(--color-card)" stroke="var(--color-energy)" strokeWidth={2} data-testid="energy-point" />
            ))}
            {mood.map((p, i) => (
              <circle key={`m${i}`} cx={p.x} cy={p.y} r={5} fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth={2.5} data-testid="mood-point" />
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Mood</span>: solid line, round markers. <span className="font-medium text-foreground">Energy</span>: dashed line,
            square markers. 1 is lowest and 5 is highest.
          </p>
          <details className="mt-2" data-testid="mood-table">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-primary">See the numbers</summary>
            <table className="mt-1 w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    When
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Mood
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Energy
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p: CheckinPoint) => (
                  <tr key={p.at} className="border-t border-border text-foreground">
                    <td className="py-1 pr-3">
                      {new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(p.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="py-1 pr-3">
                      {p.mood} · {label(MOOD, p.mood)}
                    </td>
                    <td className="py-1">
                      {p.energy} · {label(ENERGY, p.energy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}
