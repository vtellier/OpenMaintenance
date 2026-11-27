import { Equipment } from '@generated/api/models/Equipment'
import { EquipmentHoursInput } from '@generated/api/models/EquipmentHoursInput'
import { DecommissionableEquipment, isDecommissioned } from '@/lib/decommissioning'
import { isHoursStale, isHoursVeryStale } from '@/lib/timestamp'

// The Dashboard's hour-meter freshness banner (doc/gui/dashboard.md,
// "Hour-meter freshness banner"). Pages hold hoursUpdatedAt as an ISO string,
// though some still type it as the API's Date.
type FreshnessEquipment = Pick<Equipment, 'tracksHours'> & DecommissionableEquipment & { hoursUpdatedAt?: Date | string | null }

// freshnessBannerEquipments lists the equipments the banner reminds about:
// every hour-tracked equipment in service, never updated first, then oldest
// update first. A decommissioned equipment is left out: its tasks are never
// due, so its hour-meter no longer matters.
export function freshnessBannerEquipments<E extends FreshnessEquipment>(equipments: E[]): E[] {
  return equipments
    .filter(eq => eq.tracksHours && !isDecommissioned(eq))
    .sort((a, b) => updatedTime(a) - updatedTime(b))
}

// freshnessBanner splits the banner's equipments into the stale ones, listed
// at once, and the fresh ones, folded under "N fresh". Both keep the banner's
// order. The banner shows when either has an equipment. An equipment never
// updated is stale.
export function freshnessBanner<E extends FreshnessEquipment>(equipments: E[]): { stale: E[]; fresh: E[] } {
  const listed = freshnessBannerEquipments(equipments)
  return {
    stale: listed.filter(eq => isHoursStale(eq.hoursUpdatedAt)),
    fresh: listed.filter(eq => !isHoursStale(eq.hoursUpdatedAt)),
  }
}

// sameHoursReading is the reading "Same hours" confirms: the equipment's
// current one, or none when it has no reading yet. Then there is nothing to
// confirm and the button is not offered: a reading is never invented.
export function sameHoursReading(eq: Pick<Equipment, 'hours'>): number | null {
  return eq.hours ?? null
}

/**
 * The classes of a banner row and of its "updated …" text: a stale reading
 * emphasizes the row, and its text more strongly once it is very stale
 * (timestamp.ts).
 */
export function bannerRowClasses(eq: { hoursUpdatedAt?: Date | string | null }): { row: string; updated: string } {
  const stale = isHoursStale(eq.hoursUpdatedAt)
  const freshness = isHoursVeryStale(eq.hoursUpdatedAt) ? ' very-stale' : stale ? ' stale' : ''
  return {
    row: 'hours-banner__row' + (stale ? ' hours-banner__row--stale' : ''),
    updated: 'hours-banner__updated' + freshness,
  }
}

/** The part of the generated EquipmentApi that "Same hours" saves through. */
export interface SameHoursSaver {
  updateEquipmentHours(req: { id: number, equipmentHoursInput: EquipmentHoursInput }): Promise<unknown>
}

/**
 * "Same hours": saves the current reading again, which refreshes its
 * freshness. Resolves to null on success, or to the message to show: always
 * "Failed to update hours", whatever the backend says. Call only when
 * sameHoursReading has a reading.
 */
export async function saveSameHours(eq: Pick<Equipment, 'id' | 'hours'>, api: SameHoursSaver): Promise<string | null> {
  try {
    await api.updateEquipmentHours({ id: eq.id!, equipmentHoursInput: { hours: sameHoursReading(eq)! } })
    return null
  } catch {
    return 'Failed to update hours'
  }
}

function updatedTime(eq: FreshnessEquipment): number {
  return eq.hoursUpdatedAt ? new Date(eq.hoursUpdatedAt).getTime() : 0
}
