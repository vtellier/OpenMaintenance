import { describe, expect, it } from 'vitest'
import { BackupFileFromJSON } from '@generated/api/models/BackupFile'
import { EquipmentFromJSON } from '@generated/api/models/Equipment'
import { FileInfoFromJSON } from '@generated/api/models/FileInfo'
import { GroupFromJSON } from '@generated/api/models/Group'
import { InterventionFromJSON } from '@generated/api/models/Intervention'
import { TaskFromJSON } from '@generated/api/models/Task'
import { toApiDateTime } from '@/lib/calendar-date'
import { toBackupFileRow, toEquipmentRow, toFileRow, toGroupRow, toInterventionRow, toTaskRow } from '@/lib/rows'

// This file runs once per timezone (Vitest projects in vite.config.ts). The
// API objects are parsed from JSON by the generated client, as pages get them.

// A calendar date the API sends as 'YYYY-MM-DD' reads back as that day in
// every timezone. These are easy to get wrong: DST changes in Europe and the
// US, the turn of the year, a leap day.
const DAYS = ['2026-03-08', '2026-03-29', '2026-10-25', '2026-11-01', '2025-12-31', '2026-01-01', '2024-02-29']

// The intervention date is still a timestamp (#72). 22:30 UTC is already the
// next day east of UTC; 10:30 UTC is still the previous day at UTC−11 and
// already the next day at UTC+14.
const LATE_UTC = '2026-06-21T22:30:00Z'
const MORNING_UTC = '2026-06-22T10:30:00Z'
const LOCAL_DAY: Record<string, Record<string, string>> = {
  'UTC': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-22' },
  'Europe/Paris': { [LATE_UTC]: '2026-06-22', [MORNING_UTC]: '2026-06-22' },
  'Pacific/Kiritimati': { [LATE_UTC]: '2026-06-22', [MORNING_UTC]: '2026-06-23' },
  'America/New_York': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-22' },
  'Pacific/Pago_Pago': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-21' },
}
const TZ = process.env.TZ

// The local date of an instant, computed by Intl rather than by Date getters.
function localDayByIntl(instant: string): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(instant))
}

// A row holds no Date: Arrow.js wraps one held in reactive state in a Proxy
// that loses its methods.
function expectNoDate(row: object) {
  for (const [key, value] of Object.entries(row)) {
    expect(value instanceof Date, key + ' is a Date').toBe(false)
  }
}

describe('toEquipmentRow', () => {
  it('holds its calendar dates as days and its timestamps as ISO strings, and keeps the rest', () => {
    const row = toEquipmentRow(EquipmentFromJSON({
      id: 3, name: 'Engine', description: 'Main', icon: '⚙️', group_id: 2,
      commissioned_at: '2024-02-29', decommissioned_at: '2026-03-29',
      tracks_hours: true, hours: 120,
      hours_updated_at: LATE_UTC, created_at: '2026-01-01T08:00:00Z', updated_at: '2026-06-22T10:30:00Z',
    }))

    expect(row).toEqual({
      id: 3, name: 'Engine', description: 'Main', icon: '⚙️', groupId: 2,
      commissionedAt: '2024-02-29', decommissionedAt: '2026-03-29',
      tracksHours: true, hours: 120,
      hoursUpdatedAt: '2026-06-21T22:30:00.000Z', createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-06-22T10:30:00.000Z',
    })
    expectNoDate(row)
  })

  it('reads every commissioning and decommissioning day as the day the API sends', () => {
    for (const day of DAYS) {
      const row = toEquipmentRow(EquipmentFromJSON({ id: 1, commissioned_at: day, decommissioned_at: day }))
      expect(row.commissionedAt).toBe(day)
      expect(row.decommissionedAt).toBe(day)
    }
  })

  it('has no date where the API gives none: in service, never read', () => {
    const row = toEquipmentRow(EquipmentFromJSON({ id: 1, name: 'Trailer', decommissioned_at: null }))

    expect(row.commissionedAt).toBeUndefined()
    expect(row.decommissionedAt).toBeUndefined()
    expect(row.hoursUpdatedAt).toBeUndefined()
    expect(row.createdAt).toBeUndefined()
  })
})

describe('toTaskRow', () => {
  it('holds its calendar dates as days and its timestamps as ISO strings, and keeps the rest', () => {
    const row = toTaskRow(TaskFromJSON({
      id: 10, equipment_id: 3, name: 'Replace CO2 cartridge', description: '', kind: 'expiry',
      current_expiry_date: '2031-04-30', due_status: 'ok', next_due_date: '2031-04-30',
      due_trigger: 'date', due_in_days: 1800, urgency: 0.1,
      created_at: '2026-01-01T08:00:00Z', updated_at: LATE_UTC,
    }))

    expect(row).toEqual({
      id: 10, equipmentId: 3, name: 'Replace CO2 cartridge', description: '', kind: 'expiry',
      currentExpiryDate: '2031-04-30', dueStatus: 'ok', nextDueDate: '2031-04-30',
      dueTrigger: 'date', dueInDays: 1800, urgency: 0.1,
      createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-06-21T22:30:00.000Z',
    })
    expectNoDate(row)
  })

  it('reads the next due day as the day the API sends, not a UTC timestamp', () => {
    for (const day of DAYS) {
      expect(toTaskRow(TaskFromJSON({ id: 10, next_due_date: day })).nextDueDate).toBe(day)
    }
  })

  it('reads every current expiry day as the day the API sends', () => {
    for (const day of DAYS) {
      expect(toTaskRow(TaskFromJSON({ id: 10, current_expiry_date: day })).currentExpiryDate).toBe(day)
    }
  })

  it('has no date where the API gives none: never done, no part fitted', () => {
    const row = toTaskRow(TaskFromJSON({ id: 10, name: 'Oil change', current_expiry_date: null }))

    expect(row.nextDueDate).toBeUndefined()
    expect(row.currentExpiryDate).toBeUndefined()
  })
})

describe('toInterventionRow', () => {
  it('holds its dates as days and its timestamps as ISO strings, and keeps the rest', () => {
    const row = toInterventionRow(InterventionFromJSON({
      id: 7, task_id: 12, equipment_id: 2, date: toApiDateTime('2026-05-13').toISOString(),
      location: 'Marina', performed_by: 'Self', comments: 'ok', hours_at: 110,
      expiry_date: '2031-04-30', created_at: '2026-05-13T09:00:00Z', updated_at: MORNING_UTC, photo_count: 2,
    }))

    expect(row).toEqual({
      id: 7, taskId: 12, equipmentId: 2, date: '2026-05-13',
      location: 'Marina', performedBy: 'Self', comments: 'ok', hoursAt: 110,
      expiryDate: '2031-04-30', createdAt: '2026-05-13T09:00:00.000Z', updatedAt: '2026-06-22T10:30:00.000Z', photoCount: 2,
    })
    expectNoDate(row)
  })

  it('reads the date as the local day of its timestamp', () => {
    for (const instant of [LATE_UTC, MORNING_UTC]) {
      const date = toInterventionRow(InterventionFromJSON({ id: 7, date: instant })).date
      expect(date).toBe(localDayByIntl(instant))
      if (TZ && TZ in LOCAL_DAY) expect(date).toBe(LOCAL_DAY[TZ][instant])
    }
  })

  it('reads back the day the form sent', () => {
    for (const day of DAYS) {
      expect(toInterventionRow(InterventionFromJSON({ id: 7, date: toApiDateTime(day).toISOString() })).date).toBe(day)
    }
  })

  it("reads every part's expiry day as the day the API sends", () => {
    for (const day of DAYS) {
      expect(toInterventionRow(InterventionFromJSON({ id: 7, expiry_date: day })).expiryDate).toBe(day)
    }
  })

  it('keeps an exceptional intervention as one, with no expiry date', () => {
    const row = toInterventionRow(InterventionFromJSON({ id: 8, task_id: null, equipment_id: 2, exceptional_label: 'Broken impeller', expiry_date: null }))

    expect(row.taskId).toBeUndefined()
    expect(row.equipmentId).toBe(2)
    expect(row.exceptionalLabel).toBe('Broken impeller')
    expect(row.expiryDate).toBeUndefined()
  })
})

describe('toGroupRow', () => {
  it('holds its timestamps as ISO strings and keeps the rest', () => {
    const row = toGroupRow(GroupFromJSON({ id: 2, name: 'Winches', icon: '🗂️', created_at: LATE_UTC, updated_at: MORNING_UTC }))

    expect(row).toEqual({ id: 2, name: 'Winches', icon: '🗂️', createdAt: '2026-06-21T22:30:00.000Z', updatedAt: '2026-06-22T10:30:00.000Z' })
    expectNoDate(row)
  })

  it('has no timestamp where the API gives none', () => {
    expect(toGroupRow(GroupFromJSON({ id: 2, name: 'Winches' }))).toEqual({ id: 2, name: 'Winches', createdAt: undefined, updatedAt: undefined })
  })
})

describe('toFileRow', () => {
  it('holds the upload time as an ISO string and keeps the rest', () => {
    const row = toFileRow(FileInfoFromJSON({
      name: 'abc123.pdf', original_name: 'manual.pdf', size: 2048, mime_type: 'application/pdf',
      uploaded_at: LATE_UTC, url: '/api/files/abc123.pdf', missing: false,
    }))

    expect(row).toEqual({
      name: 'abc123.pdf', originalName: 'manual.pdf', size: 2048, mimeType: 'application/pdf',
      uploadedAt: '2026-06-21T22:30:00.000Z', url: '/api/files/abc123.pdf', missing: false,
    })
    expectNoDate(row)
  })

  it('keeps a file missing on the server as missing', () => {
    expect(toFileRow(FileInfoFromJSON({
      name: 'gone.jpg', original_name: 'gone.jpg', size: 0, mime_type: 'image/jpeg', uploaded_at: MORNING_UTC, url: '/x', missing: true,
    })).missing).toBe(true)
  })
})

describe('toBackupFileRow', () => {
  it('holds the backup time as an ISO string and keeps the rest', () => {
    const row = toBackupFileRow(BackupFileFromJSON({ name: 'maintenance-20260621.tar.gz', size: 4096, created_at: LATE_UTC }))

    expect(row).toEqual({ name: 'maintenance-20260621.tar.gz', size: 4096, createdAt: '2026-06-21T22:30:00.000Z' })
    expectNoDate(row)
  })
})
