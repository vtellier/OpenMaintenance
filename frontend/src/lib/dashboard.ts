import { Task } from '@generated/api/models/Task'
import { dueTimingText } from '@/lib/dueTiming'
import { byUrgency } from '@/lib/urgency'

// The Dashboard's list of due tasks (doc/gui/dashboard.md): one block per
// equipment, holding its due tasks. Pages only render the blocks.

type DueTask = Pick<Task, 'id' | 'name' | 'dueStatus' | 'urgency' | 'equipmentId'>

export interface DueTaskBlock<T extends DueTask> {
  equipmentId: number
  /** Its due tasks, most urgent first. Never empty. */
  tasks: T[]
}

/** Whether the Dashboard lists the task: it is overdue or due soon. */
export function isDue(task: Pick<Task, 'dueStatus'>): boolean {
  return task.dueStatus === 'overdue' || task.dueStatus === 'due_soon'
}

/**
 * The Dashboard's blocks: the due tasks grouped by equipment, each block's
 * tasks in urgency order (urgency.ts), and the blocks in the order of their
 * most urgent task. A task with no equipment is left out. An equipment with
 * no due task has no block.
 */
export function dueTaskBlocks<T extends DueTask>(tasks: T[]): DueTaskBlock<T>[] {
  const byEquipment = new Map<number, T[]>()
  for (const task of tasks) {
    if (!isDue(task) || task.equipmentId == null) continue
    const list = byEquipment.get(task.equipmentId)
    if (list) list.push(task)
    else byEquipment.set(task.equipmentId, [task])
  }
  const blocks = [...byEquipment].map(([equipmentId, list]) => ({ equipmentId, tasks: list.sort(byUrgency) }))
  return blocks.sort((a, b) => byUrgency(a.tasks[0], b.tasks[0]))
}

/**
 * A due task's urgency, under its name: the indicator's class (red when
 * overdue, amber when due soon) and its text, the status label and the timing
 * text (dueTiming.ts): "Overdue — 3d ago", "Due soon — in 80 h".
 */
export function dueLine(task: Pick<Task, 'dueStatus' | 'dueTrigger' | 'dueInDays' | 'dueInHours'>): { className: string; text: string } {
  const overdue = task.dueStatus === 'overdue'
  return {
    className: 'due-indicator due-indicator--' + (overdue ? 'overdue' : 'due-soon'),
    text: (overdue ? 'Overdue' : 'Due soon') + ' \u2014 ' + dueTimingText(task),
  }
}
