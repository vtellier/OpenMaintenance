// What the Equipments list remembers per browser (doc/gui/equipments.md):
// which group sections are collapsed ("Section header") and whether "Show
// decommissioned" is checked ("Decommissioned equipments"). When the storage
// is unavailable or holds something unreadable, the list starts as it does
// the first time: every section expanded, "Show decommissioned" unchecked,
// and a change lasts for this page only.

/** Where the preferences are kept: the browser's localStorage, or a fake in tests. */
export interface PrefsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * The browser's localStorage. Reached on each call, not when this module
 * loads, so a browser that refuses access only fails the call, which the
 * functions below catch.
 */
export const browserStorage: PrefsStorage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}

export const COLLAPSED_KEY = 'openmaintenance.equipments.collapsedGroups'
export const SHOW_DECOMMISSIONED_KEY = 'openmaintenance.equipments.showDecommissioned'

/** The collapsed sections: true for each collapsed group's id. */
export type CollapsedGroups = Record<number, boolean>

/** The collapsed groups, kept as a JSON array of their ids. Anything else in it is ignored. */
export function readCollapsed(storage: PrefsStorage = browserStorage): CollapsedGroups {
  try {
    const ids = JSON.parse(storage.getItem(COLLAPSED_KEY) ?? '[]')
    const out: CollapsedGroups = {}
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'number') out[id] = true
    return out
  } catch {
    return {}
  }
}

export function writeCollapsed(collapsed: CollapsedGroups, storage: PrefsStorage = browserStorage): void {
  try {
    const ids = Object.keys(collapsed).filter(k => collapsed[Number(k)]).map(Number)
    storage.setItem(COLLAPSED_KEY, JSON.stringify(ids))
  } catch { /* storage unavailable: the state lasts for this page only */ }
}

/** Whether the group's section is collapsed. A group not listed is expanded, a new one included. */
export function isCollapsed(collapsed: CollapsedGroups, groupId: number): boolean {
  return !!collapsed[groupId]
}

/** The collapsed groups once this group's section is toggled. A new object: the one given is unchanged. */
export function toggleCollapsed(collapsed: CollapsedGroups, groupId: number): CollapsedGroups {
  return { ...collapsed, [groupId]: !isCollapsed(collapsed, groupId) }
}

/** Whether "Show decommissioned" is checked: only when 'true' is kept. */
export function readShowDecommissioned(storage: PrefsStorage = browserStorage): boolean {
  try {
    return storage.getItem(SHOW_DECOMMISSIONED_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeShowDecommissioned(show: boolean, storage: PrefsStorage = browserStorage): void {
  try {
    storage.setItem(SHOW_DECOMMISSIONED_KEY, String(show))
  } catch { /* storage unavailable: the state lasts for this page only */ }
}
