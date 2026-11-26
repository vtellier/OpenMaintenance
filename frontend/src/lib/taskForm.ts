import { TaskInput } from '@generated/api/models/TaskInput'
import { CalendarDate, toApiDate } from '@/lib/calendar-date'
import { TaskRow } from '@/lib/rows'

// The task form on Equipment detail (Add task and Edit task): its values, how
// it is prefilled, when it can be saved and the request it becomes
// (doc/gui/tasks.md, doc/data-model.md "Task kinds").

export type TaskKind = 'interval' | 'expiry'

export interface TaskFormValues {
  name: string
  description: string
  kind: TaskKind
  /** 0 when none is entered. */
  hoursInterval: number
  /** 0 when none is entered. */
  monthsInterval: number
  /** The expiry date of the part fitted now, for an expiry task; '' when none is entered. */
  currentExpiryDate: CalendarDate | ''
}

/** Add task opens empty, as an interval task. */
export function newTaskForm(): TaskFormValues {
  return { name: '', description: '', kind: 'interval', hoursInterval: 0, monthsInterval: 0, currentExpiryDate: '' }
}

/** Edit task opens with the task's values. A task of no known kind is an interval task. */
export function taskFormOf(task: TaskRow): TaskFormValues {
  return {
    name: task.name ?? '',
    description: task.description ?? '',
    kind: task.kind === 'expiry' ? 'expiry' : 'interval',
    hoursInterval: task.hoursInterval ?? 0,
    monthsInterval: task.monthsInterval ?? 0,
    currentExpiryDate: task.currentExpiryDate ?? '',
  }
}

/** An interval field as typed: a whole number, or 0 (none) when it is empty or not a number. */
export function intervalFromInput(raw: string): number {
  return parseInt(raw) || 0
}

/** What an interval field shows: empty for 0 (none), so its placeholder shows. */
export function intervalValue(interval: number): string {
  return interval > 0 ? String(interval) : ''
}

/**
 * A name always; at least one interval for an interval task. An expiry task's
 * current expiry date is optional.
 *
 * The hours interval counts even while the form hides it, on an equipment that
 * does not track hours: #181.
 */
export function canSaveTask(form: TaskFormValues): boolean {
  if (!form.name.trim()) return false
  return form.kind === 'expiry' || form.hoursInterval > 0 || form.monthsInterval > 0
}

/**
 * The kind-specific fields of a task request: the intervals entered (0 is
 * none), or the current expiry date.
 *
 * The hours interval is sent even while the form hides it, on an equipment
 * that does not track hours, and the backend then rejects the save: #181.
 */
export function kindFields(form: TaskFormValues): Pick<TaskInput, 'hoursInterval' | 'monthsInterval' | 'currentExpiryDate'> {
  if (form.kind === 'expiry') {
    return { hoursInterval: undefined, monthsInterval: undefined, currentExpiryDate: form.currentExpiryDate ? toApiDate(form.currentExpiryDate) : undefined }
  }
  return {
    hoursInterval: form.hoursInterval > 0 ? form.hoursInterval : undefined,
    monthsInterval: form.monthsInterval > 0 ? form.monthsInterval : undefined,
  }
}

/** The request Add task and Edit task save, for a task of this equipment. Call only when canSaveTask. */
export function toTaskInput(form: TaskFormValues, equipmentId: number): TaskInput {
  return {
    equipmentId,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    kind: form.kind,
    ...kindFields(form),
  }
}
