import { AuthOverlay } from 'deepspace'
import { Bunny } from './Bunny'

/**
 * DeepSpace's sign-in window with Petirien's words. There is no separate "sign up": the first time someone continues
 * with Google or GitHub, their account is made. The email form in DeepSpace's window only signs in to an existing account (it
 * asks for a password straight away and cannot create one), so the window says so. Use this instead of AuthOverlay directly.
 */
export function SignInWindow({ onClose }: { onClose: () => void }) {
  return (
    <AuthOverlay
      onClose={onClose}
      title="Sign in or sign up"
      description="New here? Continue with Google or GitHub and your account is created the first time. Email sign-in only works for accounts that already exist."
      logo={<Bunny animated={false} className="mx-auto h-16 w-16" />}
    />
  )
}
