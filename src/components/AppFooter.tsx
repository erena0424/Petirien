import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui'
import { SupportCard } from './SupportCard'
import { DISPLAY_NAME } from '../constants'

/** Shown on every screen: what this app is, and a way to reach support at any time. */
export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-border bg-[var(--color-footer,var(--color-background))] px-4 py-1.5">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          {DISPLAY_NAME} is everyday emotional support, not therapy or medical advice.
        </p>
        <Dialog>
          <DialogTrigger
            data-testid="footer-support"
            className="min-h-11 shrink-0 rounded-lg px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Need support now?
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Support resources</DialogTitle>
            <DialogDescription className="sr-only">Free, private crisis and support services.</DialogDescription>
            <SupportCard bare />
          </DialogContent>
        </Dialog>
      </div>
    </footer>
  )
}
