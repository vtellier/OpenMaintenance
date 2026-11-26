import type { BackupFile } from '@generated/api/models/BackupFile'
import type { Equipment } from '@generated/api/models/Equipment'
import type { FileInfo } from '@generated/api/models/FileInfo'
import type { Group } from '@generated/api/models/Group'
import type { Intervention } from '@generated/api/models/Intervention'
import type { Task } from '@generated/api/models/Task'
import { CalendarDate, fromApiDate, fromApiDateTime } from '@/lib/calendar-date'
import { fromApiTimestamp, IsoTimestamp } from '@/lib/timestamp'

// Display rows: what pages and components hold of an API object. The
// generated client gives every date as a Date; a row holds a calendar date as
// a 'YYYY-MM-DD' string (calendar-date.ts) and a timestamp as an ISO string
// (timestamp.ts), and keeps every other field as the API gives it. Every page
// converts what it loads through these functions, so the same field reads the
// same way on every screen (doc/data-model.md, "Calendar dates and
// timestamps").

/**
 * An API model `T` whose calendar-date fields `D` hold CalendarDate strings
 * and whose timestamp fields `S` hold ISO strings. A field is optional in the
 * row exactly when it is optional in `T`, and absent when the API gives none.
 */
type Row<T, D extends keyof T, S extends keyof T> =
  Omit<T, D | S> & { [P in keyof Pick<T, D>]: CalendarDate } & { [P in keyof Pick<T, S>]: IsoTimestamp }

export type EquipmentRow = Row<Equipment, 'commissionedAt' | 'decommissionedAt', 'hoursUpdatedAt' | 'createdAt' | 'updatedAt'>
export type TaskRow = Row<Task, 'nextDueDate' | 'currentExpiryDate', 'createdAt' | 'updatedAt'>
export type InterventionRow = Row<Intervention, 'date' | 'expiryDate', 'createdAt' | 'updatedAt'>
export type GroupRow = Row<Group, never, 'createdAt' | 'updatedAt'>
/** An equipment document or an intervention photo. */
export type FileRow = Row<FileInfo, never, 'uploadedAt'>
export type BackupFileRow = Row<BackupFile, never, 'createdAt'>

export function toEquipmentRow(eq: Equipment): EquipmentRow {
  return {
    ...eq,
    commissionedAt: fromApiDate(eq.commissionedAt),
    decommissionedAt: fromApiDate(eq.decommissionedAt),
    hoursUpdatedAt: fromApiTimestamp(eq.hoursUpdatedAt),
    createdAt: fromApiTimestamp(eq.createdAt),
    updatedAt: fromApiTimestamp(eq.updatedAt),
  }
}

export function toTaskRow(task: Task): TaskRow {
  return {
    ...task,
    nextDueDate: fromApiDate(task.nextDueDate),
    currentExpiryDate: fromApiDate(task.currentExpiryDate),
    createdAt: fromApiTimestamp(task.createdAt),
    updatedAt: fromApiTimestamp(task.updatedAt),
  }
}

/** The intervention date is still a timestamp in the API (#72): the row holds its local day. */
export function toInterventionRow(inv: Intervention): InterventionRow {
  return {
    ...inv,
    date: fromApiDateTime(inv.date),
    expiryDate: fromApiDate(inv.expiryDate),
    createdAt: fromApiTimestamp(inv.createdAt),
    updatedAt: fromApiTimestamp(inv.updatedAt),
  }
}

export function toGroupRow(group: Group): GroupRow {
  return {
    ...group,
    createdAt: fromApiTimestamp(group.createdAt),
    updatedAt: fromApiTimestamp(group.updatedAt),
  }
}

export function toFileRow(file: FileInfo): FileRow {
  return {
    ...file,
    uploadedAt: requiredTimestamp(file.uploadedAt),
  }
}

export function toBackupFileRow(file: BackupFile): BackupFileRow {
  return {
    ...file,
    createdAt: requiredTimestamp(file.createdAt),
  }
}

/**
 * A timestamp the API requires. The generated client gives an invalid Date if
 * the API breaks that contract; the row then holds '', which the timestamp
 * helpers show as unknown, as they show a missing timestamp.
 */
function requiredTimestamp(value: Date): IsoTimestamp {
  return fromApiTimestamp(value) ?? ''
}
