import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui'
import { formatCheckinDate } from '@/lib/format'
import type { ReflectOn } from '../ReflectionDialog'
import { JournalEntryCard, type JournalRecord } from './JournalEntryCard'

/** One journal entry opened from its title on the calendar, to read in full (with Edit and Delete as on the list). */
export function EntryDialog({
  record,
  onClose,
  onEdit,
  onDelete,
}: {
  record: JournalRecord | null
  onClose: () => void
  onEdit: (plan: ReflectOn) => void
  onDelete: (recordId: string) => void
}) {
  return (
    <Dialog open={record !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="entry-dialog">
        <DialogTitle className="sr-only">{record?.data.title ?? 'Journal entry'}</DialogTitle>
        <DialogDescription className="sr-only">{record ? formatCheckinDate(record.createdAt) : ''}</DialogDescription>
        {record && (
          <ul>
            <JournalEntryCard record={record} onEdit={onEdit} onDelete={onDelete} />
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
