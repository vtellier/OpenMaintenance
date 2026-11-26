/**
 * Timestamps: moments in time, such as when a file was uploaded, a backup was
 * made or the hour-meter was last read. They are shown in the user's timezone.
 * See "Calendar dates and timestamps" in doc/data-model.md.
 *
 * Calendar dates (intervention, commissioning, next due) are not timestamps:
 * see calendar-date.ts.
 *
 * Pages hold timestamps as ISO strings: their display rows (rows.ts) convert
 * the generated client's Date with fromApiTimestamp, since Arrow.js wraps a
 * Date held in reactive state in a Proxy that loses its methods. Every helper
 * here still accepts a Date too.
 */
export type Timestamp = Date | string | null | undefined

/** A timestamp as display rows hold it: an ISO string such as '2026-05-14T08:30:00.000Z'. */
export type IsoTimestamp = string

const MS_PER_DAY = 1000 * 60 * 60 * 24
const STALE_HOURS_THRESHOLD_DAYS = 7
const VERY_STALE_HOURS_THRESHOLD_DAYS = 30

/** The day of a timestamp in the user's timezone, 'YYYY-MM-DD'; '' when unknown. */
export function formatTimestampDate(value: Timestamp): string {
  const d = parse(value)
  if (!d) return ''
  return String(d.getFullYear()).padStart(4, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/** Time elapsed since a timestamp, e.g. '3d ago'; 'never' when unknown. */
export function relativeTime(value: Timestamp): string {
  const d = parse(value)
  if (!d) return 'never'
  const diff = Date.now() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(months / 12)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return minutes + 'm ago'
  if (hours < 24) return hours + 'h ago'
  if (days < 30) return days + 'd ago'
  if (months < 12) return months + 'mo ago'
  return years + 'y ago'
}

/** Whether the last hour-meter reading is older than the staleness threshold. */
export function isHoursStale(hoursUpdatedAt: Timestamp): boolean {
  return olderThanDays(hoursUpdatedAt, STALE_HOURS_THRESHOLD_DAYS)
}

/** Whether the last hour-meter reading is very old (emphasized more strongly). */
export function isHoursVeryStale(hoursUpdatedAt: Timestamp): boolean {
  return olderThanDays(hoursUpdatedAt, VERY_STALE_HOURS_THRESHOLD_DAYS)
}

/**
 * Reads a field the API types as `format: date-time` (created_at, updated_at,
 * hours_updated_at, uploaded_at): the generated client's Date, as the ISO
 * string pages keep. Missing or invalid: undefined.
 *
 * The intervention date is also `format: date-time` (until #72) but is a
 * calendar date: read it with fromApiDateTime (calendar-date.ts), which gives
 * its local day, not with this function.
 */
export function fromApiTimestamp(value: Date | null | undefined): IsoTimestamp | undefined {
  if (value == null || isNaN(value.getTime())) return undefined
  return value.toISOString()
}

function olderThanDays(value: Timestamp, days: number): boolean {
  const d = parse(value)
  if (!d) return true
  return (Date.now() - d.getTime()) / MS_PER_DAY > days
}

function parse(value: Timestamp): Date | undefined {
  if (value == null) return undefined
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}
