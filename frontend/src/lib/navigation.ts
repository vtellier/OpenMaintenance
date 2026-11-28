// The app's four sections, in the desktop navbar and the mobile tab bar
// (doc/gui/navigation.md). Components only render them.

/**
 * Whether the section at `sectionPath` is the one to highlight on the page at
 * `currentPath`. The Dashboard (`/`) only on `/` itself; any other section on
 * its own path and every path under it, so an equipment page highlights
 * Equipments. The match is on the start of the path, so
 * `/settingsx` highlights Settings too.
 */
export function isActiveSection(sectionPath: string, currentPath: string): boolean {
  if (sectionPath === '/') return currentPath === '/'
  return currentPath.startsWith(sectionPath)
}
