import { describe, expect, it } from 'vitest'
import { BackupStatusFromJSON } from '@generated/api/models/BackupStatus'
import { backupSummaryOf, retentionText, unknownBackupSummary } from '@/lib/backups'

describe('backupSummaryOf', () => {
  it('lists the configuration and the files, in the order the API gives them', () => {
    const summary = backupSummaryOf(BackupStatusFromJSON({
      enabled: true,
      path: '/data/backups',
      keep: 7,
      files: [
        { name: 'maintenance.20260622-140000.tar.gz', size: 4_404_019, created_at: '2026-06-22T14:00:00Z' },
        { name: 'maintenance.20260621-140000.bak', size: 1_153_434, created_at: '2026-06-21T14:00:00Z' },
      ],
    }))

    expect(summary).toEqual({
      status: 'Enabled',
      directory: '/data/backups',
      retention: '7 backups',
      files: [
        { name: 'maintenance.20260622-140000.tar.gz', size: 4_404_019, createdAt: '2026-06-22T14:00:00.000Z' },
        { name: 'maintenance.20260621-140000.bak', size: 1_153_434, createdAt: '2026-06-21T14:00:00.000Z' },
      ],
    })
  })

  it('lists no file yet when backups are enabled and none was made', () => {
    expect(backupSummaryOf(BackupStatusFromJSON({ enabled: true, path: '/data/backups', keep: 1, files: [] })).files).toEqual([])
  })

  it('hides the list when backups are disabled, even if files are left', () => {
    const summary = backupSummaryOf(BackupStatusFromJSON({
      enabled: false,
      path: '/data/backups',
      keep: 0,
      files: [{ name: 'maintenance.20260621-140000.bak', size: 1, created_at: '2026-06-21T14:00:00Z' }],
    }))

    expect(summary.status).toBe('Disabled')
    expect(summary.files).toBeNull()
  })

  it('shows a dash for a missing directory', () => {
    expect(backupSummaryOf(BackupStatusFromJSON({ enabled: true, path: '', keep: 3, files: [] })).directory).toBe('—')
  })
})

describe('unknownBackupSummary', () => {
  it('reads as a disabled configuration with no directory', () => {
    expect(unknownBackupSummary).toEqual({ status: 'Disabled', directory: '—', retention: 'Unlimited', files: null })
  })
})

describe('retentionText', () => {
  it.each<[number, string]>([
    [0, 'Unlimited'],
    [1, '1 backup'],
    [2, '2 backups'],
    [7, '7 backups'],
  ])('%j: %j', (keep, expected) => {
    expect(retentionText(keep)).toBe(expected)
  })
})
