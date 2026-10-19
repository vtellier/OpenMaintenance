import { Equipment } from '@generated/api/models/Equipment'
import { Intervention } from '@generated/api/models/Intervention'
import { Task } from '@generated/api/models/Task'

// Whether to ask the user to keep or correct an equipment's hour-meter reading
// after an intervention is deleted or edited, and what to prefill the
// correction with (doc/data-model.md, "Reading in doubt"). Deleting or editing
// an intervention never lowers the reading by itself.

export type InterventionReading = Pick<Intervention, 'id' | 'taskId' | 'equipmentId' | 'hoursAt'>

export interface ReadingDoubtContext {
  equipments: Pick<Equipment, 'id' | 'name' | 'tracksHours' | 'hours'>[]
  tasks: Pick<Task, 'id' | 'equipmentId'>[]
  /** The interventions as they were before the change. */
  interventions: InterventionReading[]
}

/** An intervention deleted, or edited to another equipment or reading. */
export type ReadingChange =
  | { deleted: InterventionReading }
  | { edited: InterventionReading, to: { equipmentId: number | null | undefined, hoursAt: number | null | undefined } }

export interface ReadingDoubt {
  equipmentId: number
  equipmentName: string
  /** The current reading, the one the intervention recorded. */
  reading: number
  /** What "Correct reading" is prefilled with: the highest reading left on the equipment's interventions; null when none has one. */
  suggested: number | null
}

function equipmentOf(inv: InterventionReading, ctx: ReadingDoubtContext): number | null {
  if (inv.equipmentId != null) return inv.equipmentId
  return ctx.tasks.find(t => t.id === inv.taskId)?.equipmentId ?? null
}

/**
 * The doubt a change leaves on the reading of the intervention's equipment, or
 * null when there is none: the equipment tracks hours, the intervention
 * recorded its current reading, and no longer does after the change.
 */
export function readingDoubt(change: ReadingChange, ctx: ReadingDoubtContext): ReadingDoubt | null {
  const before = 'deleted' in change ? change.deleted : change.edited
  const equipmentId = equipmentOf(before, ctx)
  const eq = ctx.equipments.find(e => e.id === equipmentId)
  if (eq?.id == null || !eq.tracksHours || eq.hours == null) return null
  if (before.hoursAt == null || before.hoursAt !== eq.hours) return null

  // The reading the intervention carries on that equipment after the change.
  const after = 'edited' in change && change.to.equipmentId === eq.id ? (change.to.hoursAt ?? null) : null
  if (after != null && after >= before.hoursAt) return null

  const left = ctx.interventions
    .filter(inv => inv.id !== before.id && equipmentOf(inv, ctx) === eq.id && inv.hoursAt != null)
    .map(inv => inv.hoursAt as number)
  if (after != null) left.push(after)

  return {
    equipmentId: eq.id,
    equipmentName: eq.name ?? '',
    reading: eq.hours,
    suggested: left.length > 0 ? Math.max(...left) : null,
  }
}

/** The "Correct reading" page for the doubt, prefilled with its suggestion. */
export function correctReadingHref(doubt: ReadingDoubt): string {
  const href = '/equipments/' + doubt.equipmentId + '/edit/hours/correct'
  return doubt.suggested == null ? href : href + '?hours=' + doubt.suggested
}
