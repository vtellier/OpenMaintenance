import { Task } from '@generated/api/models/Task'
import { CalendarDate, formatCalendarDate } from '@/lib/calendar-date'
import { dueLine } from '@/lib/dashboard'
import { statusBadge } from '@/lib/equipmentGroups'
import { formatHours } from '@/lib/format'

// What a task row on an equipment's Tasks tab says (doc/gui/tasks.md,
// "Content"): its trigger summary, its urgency indicator and its last
// intervention. Pages only render it.

/**
 * The trigger summary: "Every 100h or 6mo", "Every 250h", or the months
 * alone with no "Every", "24mo". An expiry task reads
 * "On expiry date". Empty for an interval task with no interval.
 */
export function triggerText(task: Pick<Task, 'kind' | 'hoursInterval' | 'monthsInterval'>): string {
  if (task.kind === 'expiry') return 'On expiry date'
  const parts: string[] = []
  if (task.hoursInterval) parts.push('Every ' + task.hoursInterval + 'h')
  if (task.monthsInterval) parts.push(task.monthsInterval + 'mo')
  return parts.join(' or ')
}

/**
 * The urgency indicator under the task's name: its class and its text, the
 * status label and, when the task is due, the timing text, as on the
 * Dashboard ("Overdue — 3d ago", "Due soon — in 80 h"). An OK task reads
 * "OK" alone. None when the task has no due status: its equipment is
 * decommissioned, and its tasks are never due.
 */
export function dueIndicator(task: Pick<Task, 'dueStatus' | 'dueTrigger' | 'dueInDays' | 'dueInHours'>): { className: string; text: string } | null {
  if (task.dueStatus === 'overdue' || task.dueStatus === 'due_soon') return dueLine(task)
  if (task.dueStatus === 'ok') {
    const badge = statusBadge('ok')
    return { className: badge.className, text: badge.label }
  }
  return null
}

/**
 * What follows "Last: " on the row, from the task's last intervention
 * (lastInterventionOfTask in interventions.ts): its date, and its reading
 * when it has one ("2026-03-27 • 380 h"), or "never".
 */
export function lastDoneText(last: { date?: CalendarDate | null; hoursAt?: number | null } | null): string {
  if (!last) return 'never'
  return formatCalendarDate(last.date) + (last.hoursAt != null ? ' • ' + formatHours(last.hoursAt) : '')
}
