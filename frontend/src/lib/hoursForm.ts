import { EquipmentHoursCorrectionInput } from '@generated/api/models/EquipmentHoursCorrectionInput'
import { EquipmentHoursInput } from '@generated/api/models/EquipmentHoursInput'
import { extractErrorMessage } from '@/lib/format'
import { EquipmentRow } from '@/lib/rows'

// The two hour-meter forms: "Update hours", which only moves the reading up
// (or confirms it), and "Correct reading", the deliberate way to fix a wrong
// reading, the only one that can lower it (doc/gui/equipments.md; doc/data-model.md,
// "Hour-meter behavior").

// ── Correct reading ──

/**
 * The Corrected reading's prefill, from `?hours=` in the page's query string
 * (set by the "Reading in doubt" question): the number given, or null when
 * there is none or it is not a finite number.
 */
export function prefilledReading(search: string): number | null {
  const raw = new URLSearchParams(search).get('hours')
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/** The Corrected reading as typed: null while the field is empty. */
export function readingFromInput(raw: string): number | null {
  return raw === '' ? null : Number(raw)
}

/** Correct reading saves a reading of 0 or more; never an empty field. */
export function canCorrect(hours: number | null): hours is number {
  return hours != null && hours >= 0
}

/** The part of the generated EquipmentApi that Correct reading saves through. */
export interface HoursCorrector {
  correctEquipmentHours(req: { id: number, equipmentHoursCorrectionInput: EquipmentHoursCorrectionInput }): Promise<unknown>
}

/**
 * Sets the reading to this value, even below the current one. Resolves to
 * null on success, or to the reason it failed, as the backend gives it. Call
 * only when canCorrect.
 */
export async function saveCorrection(hours: number, equipmentId: number, api: HoursCorrector): Promise<string | null> {
  try {
    await api.correctEquipmentHours({ id: equipmentId, equipmentHoursCorrectionInput: { hours } })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to correct the reading')
  }
}

// ── Update hours ──

export interface HoursUpdateValues {
  /** The reading now; 0 when there is none. */
  currentHours: number
  newHours: number
}

/** Update hours opens at the current reading, or 0 when there is none. */
export function hoursUpdateFormOf(eq: Pick<EquipmentRow, 'hours'>): HoursUpdateValues {
  return { currentHours: eq.hours ?? 0, newHours: eq.hours ?? 0 }
}

/**
 * An hour-meter reading field as typed: New hours (Update hours), and the
 * Current hours or Initial hours given when the hour-meter is turned on. An
 * empty field reads as 0.
 */
export function hoursFromInput(raw: string): number {
  return Number(raw)
}

/**
 * Update hours saves a reading not below the current one: the same one
 * confirms it. A lower one goes through Correct reading.
 */
export function canUpdateHours(form: HoursUpdateValues): boolean {
  return !(form.newHours < form.currentHours)
}

/** The part of the generated EquipmentApi that Update hours saves through. */
export interface HoursUpdater {
  updateEquipmentHours(req: { id: number, equipmentHoursInput: EquipmentHoursInput }): Promise<unknown>
}

/**
 * Saves the new reading. Resolves to null on success, or to the reason it
 * failed, as the backend gives it. Call only when canUpdateHours.
 */
export async function saveHoursUpdate(form: HoursUpdateValues, equipmentId: number, api: HoursUpdater): Promise<string | null> {
  try {
    await api.updateEquipmentHours({ id: equipmentId, equipmentHoursInput: { hours: form.newHours } })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to update hours')
  }
}
