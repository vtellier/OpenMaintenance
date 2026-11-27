import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { bannerRowClasses, freshnessBanner, freshnessBannerEquipments, sameHoursReading, SameHoursSaver, saveSameHours } from '@/lib/hourMeterFreshness'

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

// A stale row is emphasized, its "updated …" text more once very stale
// (doc/gui/dashboard.md, "Hour-meter freshness banner").
describe('bannerRowClasses', () => {
  afterEach(() => vi.useRealTimers())
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  it('a fresh reading is not emphasized', () => {
    expect(bannerRowClasses({ hoursUpdatedAt: daysAgo(2) })).toEqual({ row: 'hours-banner__row', updated: 'hours-banner__updated' })
  })

  it('a stale one emphasizes the row and its text', () => {
    expect(bannerRowClasses({ hoursUpdatedAt: daysAgo(10) }))
      .toEqual({ row: 'hours-banner__row hours-banner__row--stale', updated: 'hours-banner__updated stale' })
  })

  it('a very stale one, or none at all, more strongly', () => {
    const veryStale = { row: 'hours-banner__row hours-banner__row--stale', updated: 'hours-banner__updated very-stale' }
    expect(bannerRowClasses({ hoursUpdatedAt: daysAgo(40) })).toEqual(veryStale)
    expect(bannerRowClasses({})).toEqual(veryStale)
  })
})

describe('saveSameHours', () => {
  function fakeApi(failure?: Error) {
    const calls: unknown[] = []
    const api: SameHoursSaver = {
      async updateEquipmentHours(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }

  it('saves the current reading again, and resolves to null', async () => {
    const { api, calls } = fakeApi()

    expect(await saveSameHours({ id: 4, hours: 1245 }, api)).toBeNull()
    expect(calls).toEqual([{ id: 4, equipmentHoursInput: { hours: 1245 } }])
  })

  it('resolves to "Failed to update hours", whatever the backend says', async () => {
    const response = new Response(JSON.stringify({ error: 'hours cannot decrease' }), { status: 400 })
    const { api } = fakeApi(new ResponseError(response))

    expect(await saveSameHours({ id: 4, hours: 1245 }, api)).toBe('Failed to update hours')
  })
})
