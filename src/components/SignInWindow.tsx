import { AuthOverlay } from 'deepspace'
import { Bunny } from './Bunny'

/**
 * DeepSpace's sign-in window with Petirien's words. There is no separate "sign up": the first time someone continues
 * with Google or GitHub, their account is made, so the window says so. Use this instead of AuthOverlay directly.
 */
export function SignInWindow({ onClose }: { onClose: () => void }) {
  return (
    <AuthOverlay
      onClose={onClose}
      title="Sign in or sign up"
      description="Continue with Google or GitHub. If you're new, your account is created the first time."
      logo={<Bunny animated={false} className="mx-auto h-16 w-16" />}
    />
  )
}
