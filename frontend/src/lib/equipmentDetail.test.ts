import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { descriptionText, detailHoursClassName, detailTabs, hourMeterText } from '@/lib/equipmentDetail'

// Equipment detail (doc/gui/equipments.md, "Equipment detail").

describe('detailTabs', () => {
  it('lists Tasks, History, Documents and Info, each a URL of its own', () => {
    expect(detailTabs(7, '').map(t => [t.label, t.href])).toEqual([
      ['Tasks', '/equipments/7'],
      ['History', '/equipments/7/history'],
      ['Documents', '/equipments/7/documents'],
      ['Info', '/equipments/7/info'],
    ])
  })

  it('marks the tab shown active, Tasks by default', () => {
    expect(detailTabs(7, '').map(t => t.className)).toEqual(['sub-tab active', 'sub-tab', 'sub-tab', 'sub-tab'])
    expect(detailTabs(7, 'documents').map(t => t.className)).toEqual(['sub-tab', 'sub-tab', 'sub-tab active', 'sub-tab'])
  })
})

describe('detailHoursClassName', () => {
  const now = new Date('2026-11-27T12:00:00Z')
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5).toISOString()

  it('emphasizes a reading updated more than 30 days ago', () => {
    expect(detailHoursClassName({ hoursUpdatedAt: daysAgo(31) })).toBe('very-stale')
  })

  it('leaves a recent reading plain, a merely stale one too', () => {
    expect(detailHoursClassName({ hoursUpdatedAt: daysAgo(0) })).toBe('')
    expect(detailHoursClassName({ hoursUpdatedAt: daysAgo(10) })).toBe('')
  })

  it('emphasizes a reading never updated', () => {
    expect(detailHoursClassName({})).toBe('very-stale')
  })

  it('emphasizes it on a decommissioned equipment too', () => {
    const decommissioned = { hoursUpdatedAt: daysAgo(90), decommissionedAt: '2026-09-27' }
    expect(detailHoursClassName(decommissioned)).toBe('very-stale')
  })
})

describe('descriptionText', () => {
  it('reads the description, or "None"', () => {
    expect(descriptionText({ description: 'Backup power' })).toBe('Backup power')
    expect(descriptionText({ description: '' })).toBe('None')
    expect(descriptionText({})).toBe('None')
  })
})

describe('hourMeterText', () => {
  it('reads "Enabled" or "Disabled"', () => {
    expect(hourMeterText({ tracksHours: true })).toBe('Enabled')
    expect(hourMeterText({ tracksHours: false })).toBe('Disabled')
  })
})
