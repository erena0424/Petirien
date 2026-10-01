/**
 * Landing page: a STATIC, prerendered page (no providers, no auth call).
 * Keep it renderable without a browser.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { DISPLAY_NAME } from '../constants'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-3 text-sm font-medium text-primary">{DISPLAY_NAME}</p>
        <h1 className="mb-4 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          A quiet minute and a few gentle ideas
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground">
          Check in with how you feel, and get two or three manageable things to try that fit your energy and your time.
        </p>
        <Link
          to="/home"
          className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
        >
          Get started
        </Link>
        <p className="mt-10 max-w-sm text-xs text-muted-foreground">
          {DISPLAY_NAME} offers everyday emotional support and gentle ideas. It is not therapy or medical advice.
        </p>
      </div>
    </>
  )
}
