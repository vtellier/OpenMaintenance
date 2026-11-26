import { CalendarDate, compareCalendarDates } from '@/lib/calendar-date'

// Which interventions belong to an equipment or a task, which is the latest,
// and the order they are listed in (doc/data-model.md, "Intervention";
// doc/gui/equipments.md). The Equipments cards, the Equipment detail tabs and
// History read them through these functions, so pages only render.

type DatedIntervention = { date?: CalendarDate | null }
type LinkedIntervention = DatedIntervention & { taskId?: number | null; equipmentId?: number | null; exceptionalLabel?: string }
type NamedTask = { id?: number; name?: string }

/**
 * The equipment's interventions: the standard ones logged on one of its
 * tasks, and the exceptional ones (no task) logged on the equipment itself.
 * `equipmentTasks` are the equipment's tasks.
 */
export function equipmentInterventions<I extends LinkedIntervention>(
  interventions: I[],
  equipmentId: number,
  equipmentTasks: { id?: number }[],
): I[] {
  const taskIds = new Set(equipmentTasks.map(t => t.id))
  return interventions.filter(inv => inv.taskId != null
    ? taskIds.has(inv.taskId)
    : inv.equipmentId === equipmentId)
}

/**
 * The latest intervention by date. On the same date, the first one in the
 * list wins. One with no date counts as older than any dated one. None for an
 * empty list.
 */
export function latestIntervention<I extends DatedIntervention>(interventions: I[]): I | null {
  let latest: I | null = null
  for (const inv of interventions) {
    if (!latest || compareCalendarDates(inv.date, latest.date) > 0) latest = inv
  }
  return latest
}

/** The task's last intervention, its "Last:" on a task row. None without a task id. */
export function lastInterventionOfTask<I extends LinkedIntervention>(interventions: I[], taskId: number | null | undefined): I | null {
  if (taskId == null) return null
  return latestIntervention(interventions.filter(inv => inv.taskId === taskId))
}

/**
 * The equipment's latest intervention, its card's "Last:" line: the latest
 * one logged on one of its tasks. An exceptional intervention does not count
 * (#179). `equipmentTasks` are the equipment's tasks.
 */
export function latestEquipmentIntervention<I extends LinkedIntervention>(interventions: I[], equipmentTasks: { id?: number }[]): I | null {
  const taskIds = new Set(equipmentTasks.map(t => t.id))
  return latestIntervention(interventions.filter(inv => inv.taskId != null && taskIds.has(inv.taskId)))
}

/** The name of the task with this id; '' when it is unknown or has no name. */
export function taskName(tasks: NamedTask[], taskId: number | null | undefined): string {
  return tasks.find(t => t.id === taskId)?.name || ''
}

/**
 * What an intervention was for, in a history list: its task's name, or the
 * label of an exceptional intervention.
 */
export function interventionTaskLabel(inv: LinkedIntervention, tasks: NamedTask[]): string {
  return inv.taskId == null ? (inv.exceptionalLabel ?? '') : taskName(tasks, inv.taskId)
}

/**
 * Interventions newest first, as every history list shows them. Those on the
 * same date keep the order given; those with no date come last. Returns a new
 * array.
 */
export function newestFirst<I extends DatedIntervention>(interventions: I[]): I[] {
  return [...interventions].sort((a, b) => compareCalendarDates(b.date, a.date))
}
