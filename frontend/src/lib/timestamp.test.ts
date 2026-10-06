import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatTimestampDate, isHoursStale, isHoursVeryStale, relativeTime } from '@/lib/timestamp'

// This file runs once per timezone (Vitest projects in vite.config.ts).
const TZ = process.env.TZ

// 22:30 UTC on 21 June 2026 is already 22 June east of UTC.
const LATE_UTC = '2026-06-21T22:30:00Z'
const LOCAL_DAY_OF_LATE_UTC: Record<string, string> = {
  'UTC': '2026-06-21',
  'Europe/Paris': '2026-06-22',
  'Pacific/Kiritimati': '2026-06-22',
  'America/New_York': '2026-06-21',
  'Pacific/Pago_Pago': '2026-06-21',
}

const NOW = new Date('2026-06-22T12:00:00Z')
const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('formatTimestampDate', () => {
  it('shows the day of the moment in the local timezone', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(LATE_UTC))
    expect(formatTimestampDate(LATE_UTC)).toBe(expected)
    expect(formatTimestampDate(new Date(LATE_UTC))).toBe(expected)
    if (TZ && TZ in LOCAL_DAY_OF_LATE_UTC) expect(formatTimestampDate(LATE_UTC)).toBe(LOCAL_DAY_OF_LATE_UTC[TZ])
  })

  it('shows nothing for a missing or invalid timestamp', () => {
    expect(formatTimestampDate(undefined)).toBe('')
    expect(formatTimestampDate(null)).toBe('')
    expect(formatTimestampDate('not a date')).toBe('')
  })
})

describe('relativeTime', () => {
  it('counts the time elapsed since the moment', () => {
    vi.useFakeTimers({ now: NOW })
    expect(relativeTime(ago(30 * 1000))).toBe('just now')
    expect(relativeTime(ago(5 * 60 * 1000))).toBe('5m ago')
    expect(relativeTime(ago(3 * MS_PER_HOUR))).toBe('3h ago')
    expect(relativeTime(ago(2 * MS_PER_DAY))).toBe('2d ago')
    expect(relativeTime(ago(65 * MS_PER_DAY))).toBe('2mo ago')
    expect(relativeTime(ago(400 * MS_PER_DAY))).toBe('1y ago')
    expect(relativeTime(new Date(ago(2 * MS_PER_DAY)))).toBe('2d ago')
  })

  it('says never for a missing timestamp', () => {
    expect(relativeTime(undefined)).toBe('never')
    expect(relativeTime(null)).toBe('never')
  })
})

describe('hour-meter freshness', () => {
  it('is stale after 7 days and very stale after 30', () => {
    vi.useFakeTimers({ now: NOW })
    expect(isHoursStale(ago(6 * MS_PER_DAY))).toBe(false)
    expect(isHoursStale(ago(8 * MS_PER_DAY))).toBe(true)
    expect(isHoursVeryStale(ago(29 * MS_PER_DAY))).toBe(false)
    expect(isHoursVeryStale(ago(31 * MS_PER_DAY))).toBe(true)
  })

  it('is stale when the hour-meter was never read', () => {
    expect(isHoursStale(undefined)).toBe(true)
    expect(isHoursVeryStale(null)).toBe(true)
  })
})
