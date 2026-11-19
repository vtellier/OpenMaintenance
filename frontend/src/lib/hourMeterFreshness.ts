import { Equipment } from '@generated/api/models/Equipment'
import { DecommissionableEquipment, isDecommissioned } from '@/lib/decommissioning'

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

function updatedTime(eq: FreshnessEquipment): number {
  return eq.hoursUpdatedAt ? new Date(eq.hoursUpdatedAt).getTime() : 0
}
