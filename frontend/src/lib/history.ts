import { Equipment } from '@generated/api/models/Equipment'
import { CalendarDate } from '@/lib/calendar-date'
import { HistoryFilter, interventionsFor } from '@/lib/equipmentGroups'
import { newestFirst } from '@/lib/interventions'

// The History screen's list and filters (doc/gui/history.md). Pages only
// render them.

type HistoryIntervention = {
  date?: CalendarDate | null
  taskId?: number | null
  equipmentId?: number | null
  exceptionalLabel?: string
}

/**
 * The equipment filter's select value: "<id>" for an equipment, "g:<id>" for
 * a group, "" for all equipments. parseFilterValue reads it back.
 */
export function filterValue(filter: HistoryFilter): string {
  if (filter == null) return ''
  return 'groupId' in filter ? 'g:' + filter.groupId : String(filter.equipmentId)
}

/** The filter a select value stands for (see filterValue); all equipments for "" or a value it cannot read. */
export function parseFilterValue(value: string): HistoryFilter {
  const isGroup = value.startsWith('g:')
  const id = parseInt(isGroup ? value.slice(2) : value, 10)
  if (Number.isNaN(id)) return null
  return isGroup ? { groupId: id } : { equipmentId: id }
}

/**
 * The interventions dated from `from` to `to`, both days included. '' leaves
 * that end open. With either end set, an intervention with no date is left
 * out. A range that ends before it starts keeps nothing.
 */
export function inDateRange<I extends HistoryIntervention>(interventions: I[], from: CalendarDate | '', to: CalendarDate | ''): I[] {
  // Calendar dates ('YYYY-MM-DD') compare in calendar order.
  let list = interventions
  if (from) list = list.filter(inv => inv.date != null && inv.date >= from)
  if (to) list = list.filter(inv => inv.date != null && inv.date <= to)
  return list
}

/**
 * The History list: the interventions the equipment filter selects
 * (interventionsFor) and the date range keeps, newest first. Returns a new
 * array.
 */
export function historyList<I extends HistoryIntervention>(
  interventions: I[],
  filter: HistoryFilter,
  from: CalendarDate | '',
  to: CalendarDate | '',
  equipments: Pick<Equipment, 'id' | 'groupId'>[],
  tasks: { id?: number; equipmentId?: number }[],
): I[] {
  return newestFirst(inDateRange(interventionsFor(interventions, filter, equipments, tasks), from, to))
}

/**
 * A row's "Equipment / Task" column: the equipment's name, then the task's
 * name, or the label of an exceptional intervention, joined by " / ". A
 * standard intervention's equipment is its task's. An unknown or unnamed one
 * is left out.
 */
export function historyItemLabel(
  inv: HistoryIntervention,
  equipments: Pick<Equipment, 'id' | 'name'>[],
  tasks: { id?: number; name?: string; equipmentId?: number }[],
): string {
  const parts: string[] = []
  if (inv.taskId == null) {
    const eq = equipments.find(e => e.id === inv.equipmentId)
    if (eq?.name) parts.push(eq.name)
    if (inv.exceptionalLabel) parts.push(inv.exceptionalLabel)
  } else {
    const task = tasks.find(t => t.id === inv.taskId)
    const eq = task?.equipmentId != null ? equipments.find(e => e.id === task.equipmentId) : undefined
    if (eq?.name) parts.push(eq.name)
    if (task?.name) parts.push(task.name)
  }
  return parts.join(' / ')
}
