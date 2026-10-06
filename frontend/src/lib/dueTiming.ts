import { Task } from '@generated/api/models/Task'
import { formatHours } from '@/lib/format'

// Timing text of a task's due status: "3d ago", "today", "in 12d",
// "120 h ago", "now", "in 8 h", or "never done" for a months-driven task with
// no amount (overdue because it has no date baseline). Rendered from the trigger and amount the API
// computes (due_trigger, due_in_days, due_in_hours), never guessed from the
// next due date. Spec: doc/gui/dashboard.md, "Timing text".
export function dueTimingText(task: Pick<Task, 'dueTrigger' | 'dueInDays' | 'dueInHours'>): string {
  if (task.dueTrigger === 'months') {
    const days = task.dueInDays
    if (days == null) return 'never done'
    if (days === 0) return 'today'
    return days < 0 ? -days + 'd ago' : 'in ' + days + 'd'
  }
  if (task.dueTrigger === 'hours' && task.dueInHours != null) {
    const hours = Math.round(task.dueInHours)
    if (hours === 0) return 'now'
    return hours < 0 ? formatHours(-hours) + ' ago' : 'in ' + formatHours(hours)
  }
  return ''
}
