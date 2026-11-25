import { describe, expect, it } from 'vitest'
import { freshnessBannerEquipments, sameHoursReading } from '@/lib/hourMeterFreshness'

// The Dashboard's hour-meter freshness banner lists every hour-tracked
// equipment in service, oldest update first (doc/gui/dashboard.md,
// "Hour-meter freshness banner").
describe('freshnessBannerEquipments', () => {
  const names = (list: { name: string }[]) => list.map(eq => eq.name)

  it('lists the hour-tracked equipments, never updated first, then oldest update first', () => {
    expect(names(freshnessBannerEquipments([
      { name: 'Generator', tracksHours: true, hoursUpdatedAt: '2026-11-10T08:00:00.000Z' },
      { name: 'Dinghy', tracksHours: false },
      { name: 'Main engine', tracksHours: true, hoursUpdatedAt: '2026-09-01T08:00:00.000Z' },
      { name: 'Watermaker', tracksHours: true },
    ]))).toEqual(['Watermaker', 'Main engine', 'Generator'])
  })

  // Issue #113: a decommissioned equipment's hour-meter no longer matters.
  it('leaves out decommissioned equipments', () => {
    expect(names(freshnessBannerEquipments([
      { name: 'Old outboard', tracksHours: true, hoursUpdatedAt: '2024-01-01T08:00:00.000Z', decommissionedAt: '2024-09-30' },
      { name: 'Main engine', tracksHours: true, hoursUpdatedAt: '2026-09-01T08:00:00.000Z' },
    ]))).toEqual(['Main engine'])
  })
})

// "Same hours" confirms the current reading (doc/gui/dashboard.md,
// "Hour-meter freshness banner").
describe('sameHoursReading', () => {
  it('confirms the current reading', () => {
    expect(sameHoursReading({ hours: 1245 })).toBe(1245)
  })

  it('confirms a reading of 0 h the user entered', () => {
    expect(sameHoursReading({ hours: 0 })).toBe(0)
  })

  // Issue #130: Same hours recorded 0 h the user never entered.
  it('has nothing to confirm for an equipment with no reading yet', () => {
    expect(sameHoursReading({})).toBeNull()
  })
})
