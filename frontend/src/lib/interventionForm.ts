import { Equipment } from '@generated/api/models/Equipment'
import { Intervention } from '@generated/api/models/Intervention'
import { InterventionInput } from '@generated/api/models/InterventionInput'
import { Task } from '@generated/api/models/Task'
import { extractErrorMessage } from '@/lib/format'
import { CalendarDate, WithCalendarDates, today, toApiDate, toApiDateTime } from '@/lib/calendar-date'

// The intervention forms (the full form to log and edit, and the quick log
// that marks a task done): their values, how they are prefilled, when they can
// be saved and the request they become. Dashboard, Equipment detail and History
// only say what a form opens for (doc/gui/interventions.md).

export interface InterventionFormValues {
  editId: number | null
  equipmentId: number | null
  taskId: number | null
  isExceptional: boolean
  exceptionalLabel: string
  date: CalendarDate | ''
  /** The hour-meter reading; null when none is entered. */
  hours: number | null
  /** The expiry date of the part fitted, for an expiry task; '' when none is entered. */
  expiryDate: CalendarDate | ''
  location: string
  performedBy: string
  comments: string
}

export type InterventionRow = WithCalendarDates<Intervention, 'date' | 'expiryDate'>

export interface InterventionFormContext {
  equipments: Pick<Equipment, 'id' | 'tracksHours' | 'hours'>[]
  tasks: Pick<Task, 'id' | 'equipmentId' | 'kind'>[]
}

/**
 * What the form opens for: a new log on an equipment, a quick log that marks
 * a task done, or an existing intervention to edit.
 */
export type InterventionFormSource =
  | { new: { equipmentId: number | null } }
  | { quickLog: { taskId: number } }
  | { edit: InterventionRow }

/** The reading a new log starts at: the equipment's current one, or none when it does not track hours. */
function startingReading(equipmentId: number | null, ctx: InterventionFormContext): number | null {
  const eq = ctx.equipments.find(e => e.id === equipmentId)
  return eq?.tracksHours ? (eq.hours ?? 0) : null
}

function equipmentOfTask(taskId: number | null | undefined, ctx: InterventionFormContext): number | null {
  if (taskId == null) return null
  return ctx.tasks.find(t => t.id === taskId)?.equipmentId ?? null
}

function newLog(equipmentId: number | null, taskId: number | null, ctx: InterventionFormContext): InterventionFormValues {
  return {
    editId: null,
    equipmentId,
    taskId,
    isExceptional: false,
    exceptionalLabel: '',
    date: today(),
    hours: startingReading(equipmentId, ctx),
    expiryDate: '',
    location: '',
    performedBy: '',
    comments: '',
  }
}

export function prefill(source: InterventionFormSource, ctx: InterventionFormContext): InterventionFormValues {
  if ('new' in source) return newLog(source.new.equipmentId, null, ctx)
  if ('quickLog' in source) {
    const { taskId } = source.quickLog
    return newLog(equipmentOfTask(taskId, ctx), taskId, ctx)
  }
  const inv = source.edit
  return {
    editId: inv.id ?? null,
    equipmentId: inv.equipmentId ?? equipmentOfTask(inv.taskId, ctx),
    taskId: inv.taskId ?? null,
    isExceptional: inv.taskId == null,
    exceptionalLabel: inv.exceptionalLabel ?? '',
    date: inv.date ?? '',
    hours: inv.hoursAt ?? null,
    expiryDate: inv.expiryDate ?? '',
    location: inv.location ?? '',
    performedBy: inv.performedBy ?? '',
    comments: inv.comments ?? '',
  }
}

/** Picks the equipment: its tasks replace the previous one's, and the reading starts at its current one. */
export function selectEquipment(form: InterventionFormValues, equipmentId: number | null, ctx: InterventionFormContext): void {
  form.equipmentId = equipmentId
  form.taskId = null
  form.hours = startingReading(equipmentId, ctx)
}

/**
 * Whether the form logs the part fitted on an expiry task: a standard
 * intervention whose task is one. The form then asks for its expiry date.
 */
export function isExpiryTask(form: InterventionFormValues, ctx: InterventionFormContext): boolean {
  if (form.isExceptional || form.taskId == null) return false
  return ctx.tasks.find(t => t.id === form.taskId)?.kind === 'expiry'
}

/**
 * Date always; a task for a standard intervention, and the part's expiry date
 * when it is an expiry task (any date, past included); an equipment and a
 * label for an exceptional one.
 */
export function canSave(form: InterventionFormValues, ctx: InterventionFormContext): boolean {
  if (!form.date) return false
  if (form.isExceptional) return form.equipmentId != null && form.exceptionalLabel.trim() !== ''
  if (form.taskId == null) return false
  return !isExpiryTask(form, ctx) || form.expiryDate !== ''
}

export interface InterventionRequest {
  /** The intervention being edited; absent when logging a new one. */
  id: number | undefined
  interventionInput: InterventionInput
}

/**
 * The request the form saves. The reading is sent whenever the equipment
 * tracks hours and one is entered, 0 included. The expiry date is sent only
 * for an expiry task. Call only when canSave.
 */
export function toRequest(form: InterventionFormValues, ctx: InterventionFormContext): InterventionRequest {
  const tracksHours = ctx.equipments.find(e => e.id === form.equipmentId)?.tracksHours ?? false
  const common = {
    date: toApiDateTime(form.date as CalendarDate),
    hoursAt: tracksHours && form.hours != null ? form.hours : undefined,
    location: form.location.trim() || undefined,
    performedBy: form.performedBy.trim() || undefined,
    comments: form.comments.trim() || undefined,
  }
  const interventionInput: InterventionInput = form.isExceptional
    ? { equipmentId: form.equipmentId ?? undefined, exceptionalLabel: form.exceptionalLabel.trim(), ...common }
    : isExpiryTask(form, ctx)
      ? { taskId: form.taskId ?? undefined, ...common, expiryDate: toApiDate(form.expiryDate as CalendarDate) }
      : { taskId: form.taskId ?? undefined, ...common }
  return { id: form.editId ?? undefined, interventionInput }
}

/** The part of the generated InterventionApi the form saves through. */
export interface InterventionSaver {
  createIntervention(req: { interventionInput: InterventionInput }): Promise<unknown>
  updateIntervention(req: { id: number, interventionInput: InterventionInput }): Promise<unknown>
}

/** Saves the form. Resolves to null on success, or to the reason it failed, as the backend gives it. */
export async function save(form: InterventionFormValues, ctx: InterventionFormContext, api: InterventionSaver): Promise<string | null> {
  const { id, interventionInput } = toRequest(form, ctx)
  try {
    if (id != null) await api.updateIntervention({ id, interventionInput })
    else await api.createIntervention({ interventionInput })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to save intervention')
  }
}
