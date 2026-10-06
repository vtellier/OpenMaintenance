import { Intervention } from '@generated/api/models/Intervention'

export function buildInterventionMeta(inv: Pick<Intervention, 'hoursAt' | 'location' | 'performedBy' | 'comments' | 'photoCount'>): string {
  const parts: string[] = []
  if (inv.hoursAt != null) parts.push(formatHours(inv.hoursAt))
  if (inv.location) parts.push(inv.location)
  if (inv.performedBy) parts.push(inv.performedBy)
  if (inv.comments) parts.push(inv.comments)
  if (inv.photoCount) parts.push(`📷 ${inv.photoCount} photo${inv.photoCount === 1 ? '' : 's'}`)
  return parts.join(' · ')
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

export async function extractErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    try {
      const json = await (err as { response: Response }).response.json()
      if (typeof json.error === 'string') return json.error
    } catch { /* ignore */ }
  }
  return fallback
}
