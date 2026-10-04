import { useState } from 'react'
import { SignInWindow } from './SignInWindow'
import { Button } from '@/components/ui'
import { Bunny } from './Bunny'

/** The invitation after the samples: a deep violet band, so the page has one strong moment of contrast. */
export function SignInInvite() {
  const [signIn, setSignIn] = useState(false)
  return (
    <div data-testid="preview-signin" className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-12 text-center sm:px-8 md:flex-row md:justify-between md:text-left">
        <div className="max-w-2xl">
          <p className="text-3xl font-bold leading-tight sm:text-4xl">Talk it through, and keep it as a journal.</p>
          <p className="mt-2 text-lg opacity-95">Sign in to chat with the bunny, have your conversations turned into journal entries in your own words, and save the ideas you like.</p>
        </div>
        <Button className="min-h-14 shrink-0 rounded-full bg-card px-10 text-lg font-semibold text-primary hover:bg-secondary" onClick={() => setSignIn(true)}>
          Sign in
        </Button>
      </div>
      {signIn && <SignInWindow onClose={() => setSignIn(false)} />}
    </div>
  )
}
