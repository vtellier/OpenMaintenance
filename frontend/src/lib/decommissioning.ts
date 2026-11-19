import { Equipment } from '@generated/api/models/Equipment'
import { CalendarDate } from '@/lib/calendar-date'

// Decommissioned equipment (doc/data-model.md, "Decommissioning"): an
// equipment no longer in service, kept for its history. Its tasks are never
// due; the API leaves their due fields out.

/** An equipment whose decommissioning date pages hold as a calendar date. */
export type DecommissionableEquipment = { decommissionedAt?: CalendarDate | null }

/** Whether the equipment has left service: it has a decommissioning date. */
export function isDecommissioned(equipment: DecommissionableEquipment): boolean {
  return equipment.decommissionedAt != null && equipment.decommissionedAt !== ''
}

/** Names an equipment in a picker: a decommissioned one is marked, e.g. "Old dinghy (decommissioned)". */
export function equipmentLabel(equipment: Pick<Equipment, 'name'> & DecommissionableEquipment): string {
  const name = equipment.name ?? ''
  return isDecommissioned(equipment) ? name + ' (decommissioned)' : name
}

/**
 * Whether the edit form can save this decommissioning date: none ('', in
 * service), or one neither after today nor before the date of commissioning
 * (the same day is allowed). Dates are 'YYYY-MM-DD', which compare in
 * calendar order.
 */
export function decommissioningDateAllowed(decommissionedAt: CalendarDate | '', commissionedAt: CalendarDate | '', today: CalendarDate): boolean {
  if (decommissionedAt === '') return true
  if (decommissionedAt > today) return false
  return commissionedAt === '' || decommissionedAt >= commissionedAt
}
