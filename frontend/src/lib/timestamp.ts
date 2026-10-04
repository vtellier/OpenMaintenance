/**
 * Timestamps: moments in time, such as when a file was uploaded, a backup was
 * made or the hour-meter was last read. They are shown in the user's timezone.
 * See "Calendar dates and timestamps" in doc/data-model.md.
 *
 * Calendar dates (intervention, commissioning, next due) are not timestamps:
 * see calendar-date.ts.
 *
 * Pages hold timestamps as the generated client's Date, or as its ISO string
 * once in reactive state (Arrow.js wraps a Date in a Proxy that loses its
 * methods), so every helper here accepts both.
 */
export type Timestamp = Date | string | null | undefined

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
