import { Equipment } from '@generated/api/models/Equipment'
import { Intervention } from '@generated/api/models/Intervention'
import { InterventionInput } from '@generated/api/models/InterventionInput'
import { Task } from '@generated/api/models/Task'
import { extractErrorMessage } from '@/lib/format'
import { CalendarDate, WithCalendarDates, today, toApiDateTime } from '@/lib/calendar-date'

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
  location: string
  performedBy: string
  comments: string
}

export type InterventionRow = WithCalendarDates<Intervention, 'date'>

export interface InterventionFormContext {
  equipments: Pick<Equipment, 'id' | 'tracksHours' | 'hours'>[]
  tasks: Pick<Task, 'id' | 'equipmentId'>[]
}

/**
 * What the form opens for: a new log on an equipment, a quick log that marks
 * a task done, or an existing intervention to edit.
 */
export type InterventionFormSource =
  | { new: { equipmentId: number | null } }
  | { quickLog: { taskId: number } }
  | { edit: InterventionRow }

/**
 * The reading a new log starts at: the equipment's current one, or none when it
 * does not track hours or has no reading yet. Never invent one.
 */
function startingReading(equipmentId: number | null, ctx: InterventionFormContext): number | null {
  const eq = ctx.equipments.find(e => e.id === equipmentId)
  return eq?.tracksHours ? (eq.hours ?? null) : null
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

/** Date always; a task for a standard intervention; an equipment and a label for an exceptional one. */
export function canSave(form: InterventionFormValues): boolean {
  if (!form.date) return false
  if (form.isExceptional) return form.equipmentId != null && form.exceptionalLabel.trim() !== ''
  return form.taskId != null
}

export interface InterventionRequest {
  /** The intervention being edited; absent when logging a new one. */
  id: number | undefined
  interventionInput: InterventionInput
}

/**
 * The request the form saves. The reading is sent whenever the equipment
 * tracks hours and one is entered, 0 included. Call only when canSave.
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
