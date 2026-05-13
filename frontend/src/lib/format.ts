function safeDate(date: Date | undefined): Date | undefined {
  if (!date) return undefined
  return new Date(Number(date))
}

export function relativeTime(date: Date | undefined): string {
  const d = safeDate(date)
  if (!d) return 'never'
  const now = Date.now()
  const diff = now - d.getTime()
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

export function formatDate(date: Date | undefined): string {
  const d = safeDate(date)
  if (!d) return ''
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function formatHours(hours: number | undefined): string {
  if (hours == null) return ''
  return Math.round(hours).toLocaleString() + ' h'
}

const STALE_HOURS_THRESHOLD_DAYS = 7
const VERY_STALE_HOURS_THRESHOLD_DAYS = 30

export function isHoursStale(date: Date | undefined): boolean {
  const d = safeDate(date)
  if (!d) return true
  const diff = Date.now() - d.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > STALE_HOURS_THRESHOLD_DAYS
}

export function isHoursVeryStale(date: Date | undefined): boolean {
  const d = safeDate(date)
  if (!d) return true
  const diff = Date.now() - d.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > VERY_STALE_HOURS_THRESHOLD_DAYS
}
