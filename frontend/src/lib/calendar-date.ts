/**
 * Calendar dates: the intervention date, the commissioning date and a task's
 * next due date. See "Calendar dates and timestamps" in doc/data-model.md.
 *
 * A calendar date is a day on the calendar with no time of day and no
 * timezone, held as a 'YYYY-MM-DD' string. That string is also the value of an
 * <input type="date">, and 'YYYY-MM-DD' strings compare and sort in calendar
 * order, so pages keep calendar dates in this form, in their state and in
 * their forms. They convert only when talking to the API, through the
 * functions at the bottom of this file.
 *
 * Timestamps (upload time, hour-meter freshness) are moments in time, not
 * calendar dates: see timestamp.ts.
 */

/** A day on the calendar, 'YYYY-MM-DD'. */
export type CalendarDate = string

/**
 * An API model whose calendar-date fields `K` are held as CalendarDate
 * strings. Pages keep these in reactive state: a Date there loses its methods
 * (Arrow.js wraps it in a Proxy), and a string keeps the day exactly.
 */
export type WithCalendarDates<T, K extends keyof T> = Omit<T, K> & { [P in K]?: CalendarDate }

const PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Today in the user's timezone: the default date of a new intervention. */
export function today(): CalendarDate {
  return localDay(new Date())
}

/** Text shown for a calendar date; '' when there is none. */
export function formatCalendarDate(date: CalendarDate | null | undefined): string {
  if (date == null || !isCalendarDate(date)) return ''
  return date
}

/**
 * Orders calendar dates for sort(): earlier dates first, and a missing date
 * before any date. Sort newest first with `(a, b) => compareCalendarDates(b, a)`.
 */
export function compareCalendarDates(a: CalendarDate | null | undefined, b: CalendarDate | null | undefined): number {
  const x = a ?? ''
  const y = b ?? ''
  return x < y ? -1 : x > y ? 1 : 0
}

// ── API boundary ──

/**
 * Reads a field the API types as `format: date` (commissioned_at,
 * next_due_date). The generated client parses its 'YYYY-MM-DD' as UTC midnight.
 */
export function fromApiDate(value: Date | null | undefined): CalendarDate | undefined {
  if (value == null || isNaN(value.getTime())) return undefined
  return utcDay(value)
}

/**
 * Request value for a `format: date` field. The generated client sends
 * `toISOString().substring(0, 10)`, so the Date must be UTC midnight of the day.
 */
export function toApiDate(date: CalendarDate): Date {
  return utcMidnight(date)
}

/**
 * Reads the intervention date, which the API still types as a timestamp
 * (`format: date-time`, until #72): the day is the local day of that moment.
 */
export function fromApiDateTime(value: Date | null | undefined): CalendarDate | undefined {
  if (value == null || isNaN(value.getTime())) return undefined
  return localDay(value)
}

/**
 * Request value for the intervention date: local midnight of the day. Read
 * back with fromApiDateTime it gives the same day. It is never later than now
 * for today's date, so the backend, which rejects dates in the future, accepts
 * today in every timezone.
 */
export function toApiDateTime(date: CalendarDate): Date {
  const [year, month, day] = parts(date)
  const midnight = new Date(2000, 0, 1)
  midnight.setFullYear(year, month - 1, day)
  if (localDay(midnight) !== date) throw invalid(date)
  return midnight
}

// ── Internals ──

function isCalendarDate(value: string): boolean {
  if (!PATTERN.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !isNaN(d.getTime()) && utcDay(d) === value
}

function parts(date: CalendarDate): [number, number, number] {
  if (!isCalendarDate(date)) throw invalid(date)
  const [year, month, day] = date.split('-').map(Number)
  return [year, month, day]
}

function utcMidnight(date: CalendarDate): Date {
  if (!isCalendarDate(date)) throw invalid(date)
  return new Date(date + 'T00:00:00Z')
}

function localDay(d: Date): CalendarDate {
  return format(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function utcDay(d: Date): CalendarDate {
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function format(year: number, month: number, day: number): CalendarDate {
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

function invalid(date: string): RangeError {
  return new RangeError('Not a calendar date (YYYY-MM-DD): ' + JSON.stringify(date))
}
