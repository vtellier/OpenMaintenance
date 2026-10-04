import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compareCalendarDates,
  formatCalendarDate,
  fromApiDate,
  fromApiDateTime,
  today,
  toApiDate,
  toApiDateTime,
} from '@/lib/calendar-date'

// This file runs once per timezone (Vitest projects in vite.config.ts). Every
// expectation holds in any timezone; the zone-specific ones are in the tables.
const TZ = process.env.TZ

// getTimezoneOffset() on 15 January 2026, in minutes behind UTC.
const JANUARY_OFFSET: Record<string, number> = {
  'UTC': 0,
  'Europe/Paris': -60,
  'Pacific/Kiritimati': -840,
  'America/New_York': 300,
  'Pacific/Pago_Pago': 660,
}

// Instants whose local date differs from their UTC date somewhere: 22:30 UTC
// is already the next day east of UTC, 10:30 UTC is still the previous day at
// UTC−11 and already the next day at UTC+14.
const LATE_UTC = '2026-06-21T22:30:00Z'
const MORNING_UTC = '2026-06-22T10:30:00Z'
const LOCAL_DAY: Record<string, Record<string, string>> = {
  'UTC': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-22' },
  'Europe/Paris': { [LATE_UTC]: '2026-06-22', [MORNING_UTC]: '2026-06-22' },
  'Pacific/Kiritimati': { [LATE_UTC]: '2026-06-22', [MORNING_UTC]: '2026-06-23' },
  'America/New_York': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-22' },
  'Pacific/Pago_Pago': { [LATE_UTC]: '2026-06-21', [MORNING_UTC]: '2026-06-21' },
}

// Days that are easy to get wrong: DST changes in Europe and the US, the turn
// of the year, a leap day, and a year below 100 (Date treats those specially).
const DAYS = [
  '2026-03-08', '2026-03-29', '2026-05-13', '2026-10-25', '2026-11-01',
  '2025-12-31', '2026-01-01', '2024-02-29', '0099-12-31',
]

// The local date of an instant, computed by Intl rather than by Date getters.
function localDayByIntl(instant: Date): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(instant)
}

// What the generated API client sends and parses (see generated/api/models).
const wire = {
  date: (d: Date) => d.toISOString().substring(0, 10),
  dateTime: (d: Date) => d.toISOString(),
  parse: (json: string) => new Date(json),
}

afterEach(() => {
  vi.useRealTimers()
})

describe.runIf(TZ)('the test run', () => {
  it('runs in the timezone its Vitest project sets', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(TZ)
    if (TZ! in JANUARY_OFFSET) {
      expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(JANUARY_OFFSET[TZ!])
    }
  })
})

describe('today', () => {
  it('is the local date, not the UTC date', () => {
    for (const instant of [LATE_UTC, MORNING_UTC]) {
      vi.useFakeTimers({ now: new Date(instant) })
      expect(today()).toBe(localDayByIntl(new Date(instant)))
      if (TZ && TZ in LOCAL_DAY) expect(today()).toBe(LOCAL_DAY[TZ][instant])
    }
  })

  it('is never in the future once sent, so the backend accepts it', () => {
    for (const instant of [LATE_UTC, MORNING_UTC, '2026-03-29T00:30:00Z', '2026-12-31T23:59:59Z']) {
      vi.useFakeTimers({ now: new Date(instant) })
      expect(toApiDateTime(today()).getTime()).toBeLessThanOrEqual(Date.now())
    }
  })
})

describe('intervention date (a timestamp in the API until #72)', () => {
  it('reads back as the day that was sent', () => {
    for (const day of DAYS) {
      expect(fromApiDateTime(wire.parse(wire.dateTime(toApiDateTime(day))))).toBe(day)
    }
  })

  it('keeps its day through repeated edit-and-save', () => {
    let day = '2026-05-13'
    for (let i = 0; i < 3; i++) {
      day = fromApiDateTime(wire.parse(wire.dateTime(toApiDateTime(day))))!
    }
    expect(day).toBe('2026-05-13')
  })

  it('is sent as local midnight of the day', () => {
    const sent = toApiDateTime('2026-05-13')
    expect([sent.getFullYear(), sent.getMonth(), sent.getDate(), sent.getHours(), sent.getMinutes()])
      .toEqual([2026, 4, 13, 0, 0])
  })

  it('reads a timestamp with a time of day as its local day', () => {
    expect(fromApiDateTime(new Date(LATE_UTC))).toBe(localDayByIntl(new Date(LATE_UTC)))
  })

  it('reads a missing or invalid value as no date', () => {
    expect(fromApiDateTime(undefined)).toBeUndefined()
    expect(fromApiDateTime(null)).toBeUndefined()
    expect(fromApiDateTime(new Date('not a date'))).toBeUndefined()
  })
})

describe('commissioning and next due date (dates in the API)', () => {
  it('are sent as exactly the picked day', () => {
    for (const day of DAYS) {
      expect(wire.date(toApiDate(day))).toBe(day)
    }
  })

  it('read back as the day the API returns', () => {
    for (const day of DAYS) {
      expect(fromApiDate(wire.parse(day))).toBe(day)
    }
  })

  it('read a missing or invalid value as no date', () => {
    expect(fromApiDate(undefined)).toBeUndefined()
    expect(fromApiDate(null)).toBeUndefined()
    expect(fromApiDate(new Date('not a date'))).toBeUndefined()
  })
})

describe('request values', () => {
  it('refuse anything that is not a calendar date', () => {
    for (const bad of ['', '2026-02-30', '2026-5-13', '13/05/2026', '2026-05-13T00:00:00Z']) {
      expect(() => toApiDate(bad)).toThrow(RangeError)
      expect(() => toApiDateTime(bad)).toThrow(RangeError)
    }
  })
})

describe('formatCalendarDate', () => {
  it('shows the day as YYYY-MM-DD', () => {
    expect(formatCalendarDate('2026-05-13')).toBe('2026-05-13')
  })

  it('shows nothing for a missing or invalid date', () => {
    expect(formatCalendarDate(undefined)).toBe('')
    expect(formatCalendarDate(null)).toBe('')
    expect(formatCalendarDate('2026-02-30')).toBe('')
    expect(formatCalendarDate('not a date')).toBe('')
  })
})

describe('compareCalendarDates', () => {
  it('orders earlier dates first and a missing date before any date', () => {
    // Sorted as rows: Array.sort() moves undefined elements to the end itself.
    const rows = [{ date: '2026-05-13' }, { date: undefined }, { date: '2025-12-31' }, { date: '2026-01-01' }]
    const sorted = rows.sort((a, b) => compareCalendarDates(a.date, b.date)).map(r => r.date)
    expect(sorted).toEqual([undefined, '2025-12-31', '2026-01-01', '2026-05-13'])
    expect(compareCalendarDates('2026-05-13', '2026-05-13')).toBe(0)
  })
})
