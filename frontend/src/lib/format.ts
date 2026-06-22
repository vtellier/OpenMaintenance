import { Intervention } from '@generated/api/models/Intervention'

// Returns today's date in YYYY-MM-DD using the browser's local timezone.
// new Date().toISOString() is always UTC, which gives the wrong date in
// timezones with a negative UTC offset when it is late evening locally.
export function todayLocal(): string {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

export function buildInterventionMeta(inv: Intervention): string {
  const parts: string[] = []
  if (inv.hoursAt != null) parts.push(formatHours(inv.hoursAt))
  if (inv.location) parts.push(inv.location)
  if (inv.performedBy) parts.push(inv.performedBy)
  if (inv.comments) parts.push(inv.comments)
  if (inv.photoCount) parts.push(`📷 ${inv.photoCount} photo${inv.photoCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

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
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  const kb = bytes / 1024
  if (kb < 1024) return kb.toFixed(kb < 10 ? 1 : 0) + ' KB'
  const mb = kb / 1024
  return mb.toFixed(mb < 10 ? 1 : 0) + ' MB'
}

export function formatHours(hours: number | null | undefined): string {
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
