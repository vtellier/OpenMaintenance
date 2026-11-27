import type { BackupStatus } from '@generated/api/models/BackupStatus'
import { BackupFileRow, toBackupFileRow } from '@/lib/rows'

// Settings → Backup: a read-only view of the backup configuration and of the
// backups made so far (doc/gui/settings.md, "Backup"). The page only renders
// the lines below.

export interface BackupSummary {
  /** "Enabled" or "Disabled". */
  status: string
  /** The backup directory, or "—" when the backend gives none. */
  directory: string
  /** How many backups are kept: "Unlimited", "1 backup", "7 backups". */
  retention: string
  /**
   * The backup files to list, in the API's order (newest first), or null when
   * backups are disabled: the list is then hidden, "No backups yet." included.
   */
  files: BackupFileRow[] | null
}

/** The Backup section's lines for the backend's backup status. */
export function backupSummaryOf(status: BackupStatus): BackupSummary {
  return {
    status: status.enabled ? 'Enabled' : 'Disabled',
    directory: status.path || '—',
    retention: retentionText(status.keep),
    files: status.enabled ? (status.files ?? []).map(toBackupFileRow) : null,
  }
}

/**
 * What the Backup section shows when the backup status could not be loaded:
 * the lines of a disabled configuration with no directory, as `pre-react`
 * showed them. No error is shown.
 */
export const unknownBackupSummary: BackupSummary = backupSummaryOf({ enabled: false, path: '', keep: 0, files: [] })

/** The retention line: 0 keeps every backup. */
export function retentionText(keep: number): string {
  if (keep === 0) return 'Unlimited'
  return keep + (keep === 1 ? ' backup' : ' backups')
}
