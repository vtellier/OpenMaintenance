import { afterEach, describe, expect, it, vi } from 'vitest'
import { freshnessBanner, freshnessBannerEquipments, sameHoursReading } from '@/lib/hourMeterFreshness'

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

// The banner lists the stale hour-meters, and folds the fresh ones under
// "N fresh" (doc/gui/dashboard.md, "Hour-meter freshness banner").
describe('freshnessBanner', () => {
  const NOW = new Date('2026-06-22T12:00:00Z')
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  const names = (list: { name: string }[]) => list.map(eq => eq.name)

  afterEach(() => { vi.useRealTimers() })

  type BannerEquipment = { name: string, tracksHours?: boolean, hoursUpdatedAt?: string, decommissionedAt?: string }

  function banner(equipments: BannerEquipment[]) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const { stale, fresh } = freshnessBanner(equipments)
    return { stale: names(stale), fresh: names(fresh) }
  }

  it('splits the hour-meters at 7 days: older is stale, the rest fresh, each oldest first', () => {
    expect(banner([
      { name: 'Generator', tracksHours: true, hoursUpdatedAt: daysAgo(2) },
      { name: 'Main engine', tracksHours: true, hoursUpdatedAt: daysAgo(40) },
      { name: 'Watermaker', tracksHours: true, hoursUpdatedAt: daysAgo(6.9) },
      { name: 'Outboard', tracksHours: true, hoursUpdatedAt: daysAgo(7.1) },
    ])).toEqual({ stale: ['Main engine', 'Outboard'], fresh: ['Watermaker', 'Generator'] })
  })

  it('counts an hour-meter never updated as stale, before any other', () => {
    expect(banner([
      { name: 'Main engine', tracksHours: true, hoursUpdatedAt: daysAgo(40) },
      { name: 'New generator', tracksHours: true },
    ])).toEqual({ stale: ['New generator', 'Main engine'], fresh: [] })
  })

  it('leaves out equipments with no hour-meter and decommissioned ones', () => {
    expect(banner([
      { name: 'Dinghy', tracksHours: false },
      { name: 'Old outboard', tracksHours: true, hoursUpdatedAt: daysAgo(400), decommissionedAt: '2025-09-30' },
      { name: 'Generator', tracksHours: true, hoursUpdatedAt: daysAgo(1) },
    ])).toEqual({ stale: [], fresh: ['Generator'] })
  })

  it('has nothing to show without an hour-tracked equipment in service', () => {
    expect(banner([])).toEqual({ stale: [], fresh: [] })
    expect(banner([{ name: 'Dinghy', tracksHours: false }])).toEqual({ stale: [], fresh: [] })
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
