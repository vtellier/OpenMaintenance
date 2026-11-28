import { Equipment } from '@generated/api/models/Equipment'
import { isHoursVeryStale, Timestamp } from '@/lib/timestamp'

// Equipment detail (doc/gui/equipments.md, "Equipment detail"): its tabs, and
// what its header and its Info tab say. Pages only render them.

/**
 * A tab of Equipment detail, as its URL names it: '' for Tasks, the default
 * (`/equipments/:id`), then `/history`, `/documents` and `/info`. Each tab is
 * a page load of its own: the tab is kept in the URL, nowhere else.
 */
export type DetailTab = '' | 'history' | 'documents' | 'info'

const TABS: { tab: DetailTab; label: string }[] = [
  { tab: '', label: 'Tasks' },
  { tab: 'history', label: 'History' },
  { tab: 'documents', label: 'Documents' },
  { tab: 'info', label: 'Info' },
]

/** The tab links, in order: each one's label, its URL, and its class (`active` on the tab shown). */
export function detailTabs(equipmentId: number, current: DetailTab): { tab: DetailTab; label: string; href: string; className: string }[] {
  return TABS.map(({ tab, label }) => ({
    tab,
    label,
    href: '/equipments/' + equipmentId + (tab ? '/' + tab : ''),
    className: 'sub-tab' + (current === tab ? ' active' : ''),
  }))
}

/**
 * The class of the header's "• updated …" text: emphasized once the reading
 * is very stale. Unlike the list's card, the header emphasizes it on a
 * decommissioned equipment too, as pre-react did.
 */
export function detailHoursClassName(eq: { hoursUpdatedAt?: Timestamp }): string {
  return isHoursVeryStale(eq.hoursUpdatedAt) ? 'very-stale' : ''
}

/** The Info tab's description: "None" when there is none. */
export function descriptionText(eq: Pick<Equipment, 'description'>): string {
  return eq.description || 'None'
}

/** The Info tab's hour-meter line: "Enabled" or "Disabled". */
export function hourMeterText(eq: Pick<Equipment, 'tracksHours'>): string {
  return eq.tracksHours ? 'Enabled' : 'Disabled'
}
