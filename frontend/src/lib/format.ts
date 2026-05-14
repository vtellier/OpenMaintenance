function safeDate(date: Date | string | undefined | null): Date | undefined {
  if (date == null) return undefined
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return undefined
    return d
  } catch {
    return undefined
  }
}

export function relativeTime(date: Date | string | undefined | null): string {
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

export function formatDate(date: Date | string | undefined | null): string {
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

export function isHoursStale(date: Date | string | undefined | null): boolean {
  const d = safeDate(date)
  if (!d) return true
  const diff = Date.now() - d.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > STALE_HOURS_THRESHOLD_DAYS
}

export function dueRelative(nextDueDate: Date | string | undefined | null, nextDueHours: number | undefined): string {
  const d = safeDate(nextDueDate)
  if (d) {
    const now = Date.now()
    const diff = d.getTime() - now
    const days = Math.round(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return 'overdue by ' + Math.abs(days) + 'd'
    if (days === 0) return 'due today'
    return 'in ' + days + 'd'
  }
  if (nextDueHours != null) {
    return 'at ' + Math.round(nextDueHours).toLocaleString() + ' h'
  }
  return ''
}

export function isHoursVeryStale(date: Date | string | undefined | null): boolean {
  const d = safeDate(date)
  if (!d) return true
  const diff = Date.now() - d.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > VERY_STALE_HOURS_THRESHOLD_DAYS
}
