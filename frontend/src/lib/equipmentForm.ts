import { EquipmentInput } from '@generated/api/models/EquipmentInput'
import { Task } from '@generated/api/models/Task'
import { CalendarDate, optionalApiDate } from '@/lib/calendar-date'
import { decommissioningDateAllowed } from '@/lib/decommissioning'
import { extractErrorMessage } from '@/lib/format'
import { EquipmentRow, toTaskRow } from '@/lib/rows'

// The equipment forms: Add equipment (Equipments list), the edit form, and the
// icon picked from the detail header. What each requires and the request it
// becomes (doc/gui/equipments.md; doc/data-model.md, "Hour-meter behavior").

/** The icon an equipment shows when none is picked. */
export const DEFAULT_ICON = '🔧'

/**
 * The icon shown for an equipment, or for a group with its own default
 * (DEFAULT_GROUP_ICON): the one picked, or the default when there is none.
 */
export function shownIcon(icon: string | null | undefined, defaultIcon: string = DEFAULT_ICON): string {
  return icon || defaultIcon
}

// ── Add equipment ──

export interface NewEquipmentValues {
  name: string
  description: string
  icon: string
  groupId: number | null
  /** '' when none is entered. */
  commissionedAt: CalendarDate | ''
  tracksHours: boolean
  /** The initial reading, sent only with the hour-meter on. */
  hours: number
}

/** Add equipment opens empty, with the default icon, no group and no hour-meter. */
export function newEquipmentForm(): NewEquipmentValues {
  return { name: '', description: '', icon: DEFAULT_ICON, groupId: null, commissionedAt: '', tracksHours: false, hours: 0 }
}

/** A name is all Add equipment requires. */
export function canAddEquipment(form: NewEquipmentValues): boolean {
  return form.name.trim() !== ''
}

/** The request Add equipment saves. Call only when canAddEquipment. */
export function toNewEquipmentInput(form: NewEquipmentValues): EquipmentInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    icon: form.icon.trim() || undefined,
    groupId: form.groupId,
    commissionedAt: optionalApiDate(form.commissionedAt),
    tracksHours: form.tracksHours,
    hours: form.tracksHours ? form.hours : undefined,
  }
}

/** The part of the generated EquipmentApi that Add equipment saves through. */
export interface EquipmentCreator {
  createEquipment(req: { equipmentInput: EquipmentInput }): Promise<unknown>
}

/**
 * Saves Add equipment. Resolves to null on success, or to the reason it
 * failed, as the backend gives it. Call only when canAddEquipment.
 */
export async function saveNewEquipment(form: NewEquipmentValues, api: EquipmentCreator): Promise<string | null> {
  try {
    await api.createEquipment({ equipmentInput: toNewEquipmentInput(form) })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to add equipment')
  }
}

// ── Edit equipment ──

export interface EquipmentEditValues {
  name: string
  description: string
  icon: string
  groupId: number | null
  /** '' when none is entered. */
  commissionedAt: CalendarDate | ''
  /** '' while the equipment is in service. */
  decommissionedAt: CalendarDate | ''
  tracksHours: boolean
  /** Whether the equipment tracked hours when the form opened. */
  originalTracksHours: boolean
  /** The initial reading, asked only while turning the hour-meter on. */
  hours: number
  /**
   * Floor for the initial reading when turning the hour-meter on: the reading
   * kept from an earlier tracking period (the meter cannot go back).
   */
  minHours: number
}

/**
 * The edit form opens with the equipment's values. The reading, and its
 * floor, start at the one kept, or 0 when there is none.
 */
export function editFormOf(eq: EquipmentRow): EquipmentEditValues {
  const tracksHours = eq.tracksHours ?? false
  return {
    name: eq.name ?? '',
    description: eq.description ?? '',
    icon: eq.icon || DEFAULT_ICON,
    groupId: eq.groupId ?? null,
    commissionedAt: eq.commissionedAt ?? '',
    decommissionedAt: eq.decommissionedAt ?? '',
    tracksHours,
    originalTracksHours: tracksHours,
    hours: eq.hours ?? 0,
    minHours: eq.hours ?? 0,
  }
}

/**
 * Whether the save turns the hour-meter on. The form only asks for hours
 * then: once it is on, the reading changes through "Update hours", never
 * through this form.
 */
export function turningOn(form: EquipmentEditValues): boolean {
  return form.tracksHours && !form.originalTracksHours
}

/**
 * The hint under Current hours while turning the hour-meter on, when a
 * reading is kept from an earlier tracking period; null when there is none.
 */
export function lastReadingHint(form: Pick<EquipmentEditValues, 'minHours'>): string | null {
  return form.minHours > 0 ? `Last reading: ${form.minHours} h. The hour-meter cannot go backwards.` : null
}

/** Turning the hour-meter on with a reading below the one kept: the meter cannot go back. */
export function hoursTooLow(form: EquipmentEditValues): boolean {
  return turningOn(form) && form.hours < form.minHours
}

/** A decommissioning date after today, or before the date of commissioning. */
export function decommissioningInvalid(form: EquipmentEditValues, today: CalendarDate): boolean {
  return !decommissioningDateAllowed(form.decommissionedAt, form.commissionedAt, today)
}

/** A name, a reading not below the one kept, and a decommissioning date allowed. */
export function canSaveEdit(form: EquipmentEditValues, today: CalendarDate): boolean {
  return form.name.trim() !== '' && !hoursTooLow(form) && !decommissioningInvalid(form, today)
}

/**
 * The request the edit form saves. An edit replaces every field, so the
 * group and the decommissioning date go back as they stand: without a
 * decommissioning date the equipment goes back in service. The reading is
 * sent only when turning the hour-meter on. Call only when canSaveEdit.
 */
export function toEquipmentEditInput(form: EquipmentEditValues): EquipmentInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    icon: form.icon.trim() || undefined,
    groupId: form.groupId,
    commissionedAt: optionalApiDate(form.commissionedAt),
    decommissionedAt: optionalApiDate(form.decommissionedAt),
    tracksHours: form.tracksHours,
    hours: turningOn(form) ? form.hours : undefined,
  }
}

/** Whether any of these tasks has an hours interval, which the hour-meter will then drive. */
export function hasHoursInterval(tasks: Task[]): boolean {
  return tasks.map(toTaskRow).some(t => t.hoursInterval != null && t.hoursInterval > 0)
}

/** The parts of the generated EquipmentApi and TaskApi the edit form saves through. */
export interface EquipmentEditApi {
  equipments: { updateEquipment(req: { id: number, equipmentInput: EquipmentInput }): Promise<unknown> }
  tasks: { listTasksByEquipment(req: { equipmentId: number }): Promise<Task[]> }
}

/**
 * What a save of the edit form came to: saved; stopped to ask the user to
 * confirm turning the hour-meter on; or failed, with the reason the backend
 * gives.
 */
export type EquipmentEditResult = { saved: true } | { needsConfirmation: true } | { error: string }

/**
 * Saves the edit form. Turning the hour-meter on first fetches the
 * equipment's tasks: when one has an hours interval, nothing is saved and the
 * user is asked to confirm; save again with `confirmed` once they do. When the
 * tasks cannot be fetched, the save goes ahead without asking. Call only when
 * canSaveEdit.
 */
export async function saveEdit(form: EquipmentEditValues, equipmentId: number, api: EquipmentEditApi, confirmed: boolean): Promise<EquipmentEditResult> {
  if (turningOn(form) && !confirmed) {
    try {
      if (hasHoursInterval(await api.tasks.listTasksByEquipment({ equipmentId }))) return { needsConfirmation: true }
    } catch {
      // Go ahead without asking.
    }
  }
  try {
    await api.equipments.updateEquipment({ id: equipmentId, equipmentInput: toEquipmentEditInput(form) })
    return { saved: true }
  } catch (err: unknown) {
    return { error: await extractErrorMessage(err, 'Failed to save equipment') }
  }
}

// ── Delete equipment ──

/** The part of the generated EquipmentApi that Delete equipment goes through. */
export interface EquipmentDeleter {
  deleteEquipment(req: { id: number }): Promise<unknown>
}

/**
 * Deletes the equipment, with its tasks, interventions and files (the
 * backend cascades). Resolves to null on success, or to the message to show:
 * always "Failed to delete equipment", whatever the backend says.
 */
export async function deleteEquipment(equipmentId: number, api: EquipmentDeleter): Promise<string | null> {
  try {
    await api.deleteEquipment({ id: equipmentId })
    return null
  } catch {
    return 'Failed to delete equipment'
  }
}

// ── Icon from the detail header ──

/**
 * The request that saves an icon picked from the detail header. An edit
 * replaces every field, so the others go back as they stand, the group and
 * the decommissioning date included; the reading is never sent.
 */
export function iconChangeInput(eq: EquipmentRow, icon: string): EquipmentInput {
  return {
    name: eq.name!,
    description: eq.description || undefined,
    icon,
    groupId: eq.groupId ?? null,
    commissionedAt: optionalApiDate(eq.commissionedAt),
    decommissionedAt: optionalApiDate(eq.decommissionedAt),
    tracksHours: eq.tracksHours,
  }
}
