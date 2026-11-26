import { Equipment } from '@generated/api/models/Equipment'
import { DecommissionableEquipment, isDecommissioned } from '@/lib/decommissioning'
import { isHoursStale } from '@/lib/timestamp'

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

function updatedTime(eq: FreshnessEquipment): number {
  return eq.hoursUpdatedAt ? new Date(eq.hoursUpdatedAt).getTime() : 0
}
