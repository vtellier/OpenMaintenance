import { Task } from '@generated/api/models/Task'

type RankedTask = Pick<Task, 'id' | 'name' | 'dueStatus' | 'urgency'>

const STATUS_ORDER: Record<string, number> = { overdue: 0, due_soon: 1, ok: 2 }

// Urgency order of tasks, most urgent first: due status (overdue, due soon,
// OK), then urgency (highest first, none last), then name, then id. The API
// computes the urgency; pages never derive it from dates or hours. Every list
// of tasks sorts with this, and the most urgent task is the first in it.
// Spec: doc/data-model.md, "Ranking tasks by urgency".
export function byUrgency(a: RankedTask, b: RankedTask): number {
  const status = statusOrder(a) - statusOrder(b)
  if (status !== 0) return status
  const urgencyA = a.urgency ?? -Infinity
  const urgencyB = b.urgency ?? -Infinity
  if (urgencyA !== urgencyB) return urgencyA > urgencyB ? -1 : 1
  const name = (a.name ?? '').localeCompare(b.name ?? '')
  if (name !== 0) return name
  return (a.id ?? 0) - (b.id ?? 0)
}

function statusOrder(task: RankedTask): number {
  return STATUS_ORDER[task.dueStatus ?? ''] ?? 3
}
