import { Task } from '@generated/api/models/Task'
import { CalendarDate, formatCalendarDate } from '@/lib/calendar-date'
import { dueTimingText } from '@/lib/dueTiming'
import { EquipmentStatus, equipmentStatus } from '@/lib/equipmentGroups'
import { taskName } from '@/lib/interventions'
import { byUrgency } from '@/lib/urgency'

// What an equipment's card on the Equipments list says (doc/gui/equipments.md,
// "Card content"). Pages only render it.

type CardTask = Pick<Task, 'id' | 'name' | 'dueStatus' | 'urgency' | 'dueTrigger' | 'dueInDays' | 'dueInHours'>

/** The longest task name a card's status line shows whole, in characters. */
export const CARD_TASK_NAME_MAX = 30

/**
 * Crops a text to `maxLen` characters, adding '…' when it is cut. Counts
 * characters, not UTF-16 units, so an emoji is never split.
 */
export function cropText(s: string, maxLen = CARD_TASK_NAME_MAX): string {
  const chars = [...s]
  return chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : s
}

/**
 * The tasks of each equipment, by equipment id, each in the order given. A
 * task with no equipment is filed under 0.
 */
export function tasksByEquipment<T extends { equipmentId?: number }>(tasks: T[]): Record<number, T[]> {
  const grouped: Record<number, T[]> = {}
  for (const t of tasks) {
    const eid = t.equipmentId ?? 0
    if (!grouped[eid]) grouped[eid] = []
    grouped[eid].push(t)
  }
  return grouped
}

/**
 * The card's "Last:" line, from its latest intervention
 * (latestEquipmentIntervention in interventions.ts): "Last: <task>, <date>",
 * or "No intervention yet". `tasks` are where the task's name is looked up.
 */
export function lastInterventionText(latest: { taskId?: number | null; date?: CalendarDate | null } | null, tasks: { id?: number; name?: string }[]): string {
  if (!latest) return 'No intervention yet'
  return 'Last: ' + taskName(tasks, latest.taskId) + ', ' + formatCalendarDate(latest.date)
}

export interface CardStatusLine {
  /** The badge, the equipment's worst status (equipmentStatus). */
  status: EquipmentStatus
  /** The text after the badge. */
  text: string
}

/**
 * The card's status line, given the equipment's tasks. Overdue or Due soon:
 * the one task with that status, its name cropped and its timing text
 * ("Oil change — 120 h ago"), or, when several have it, their count and the
 * most urgent one's timing text ("3 tasks — most urgent 120 h ago"). OK:
 * "All clear!". None when no task has a due status: the equipment has no
 * task, or it is decommissioned. The timing text is left out when it is empty.
 */
export function cardStatusLine(tasks: CardTask[]): CardStatusLine | null {
  const status = equipmentStatus(tasks)
  if (status == null) return null
  if (status === 'ok') return { status, text: 'All clear!' }
  const due = tasks.filter(t => t.dueStatus === status)
  if (due.length === 1) {
    const timing = dueTimingText(due[0])
    return { status, text: cropText(due[0].name || '') + (timing ? ' — ' + timing : '') }
  }
  const timing = dueTimingText([...due].sort(byUrgency)[0])
  return { status, text: due.length + ' tasks' + (timing ? ' — most urgent ' + timing : '') }
}
