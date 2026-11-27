import type { ReactNode } from 'react'
import { App, AppShell } from '@/App'
import { NotFound } from '@/components/NotFound'
import { EquipmentCorrectHoursPage } from '@/pages/EquipmentCorrectHoursPage'
import { EquipmentDeletePage } from '@/pages/EquipmentDeletePage'
import { EquipmentEditPage } from '@/pages/EquipmentEditPage'
import { EquipmentHoursPage } from '@/pages/EquipmentHoursPage'
import { SettingsPage } from '@/pages/SettingsPage'

export interface Page {
  description: string
  title: string
  view: ReactNode
}

const equipmentEditRe = /^\/equipments\/(\d+)\/edit$/
const equipmentDeleteRe = /^\/equipments\/(\d+)\/delete$/
const equipmentHoursRe = /^\/equipments\/(\d+)\/edit\/hours$/
const equipmentCorrectHoursRe = /^\/equipments\/(\d+)\/edit\/hours\/correct$/

/**
 * The page for a URL, chosen by its pathname. Pages are full page loads (no
 * router), so `entry-client.tsx` calls this once, sets `document.title` to
 * the page's `title` and renders its `view`.
 *
 * Each route parses what it needs from the pathname, passes it to the page as
 * plain, typed props (an id as a number), and wraps the page in `App`, which
 * takes the pathname for the navigation's highlight.
 *
 * While the React port (#146) is under way, only the pages already ported
 * have a route here; every other path shows Not Found. Each port adds its
 * routes back from `git show pre-react:frontend/src/page.ts`, in the same
 * order and with the same titles and descriptions.
 */
export async function routeToPage(url: string): Promise<Page> {
  const pathname = new URL(url, 'http://localhost').pathname

  const correctHoursMatch = pathname.match(equipmentCorrectHoursRe)
  if (correctHoursMatch) {
    return {
      description: 'Correct hour-meter reading',
      title: 'Correct reading | OpenMaintenance',
      view: <App currentPath={pathname}><EquipmentCorrectHoursPage equipmentId={Number(correctHoursMatch[1])} /></App>,
    }
  }

  const hoursMatch = pathname.match(equipmentHoursRe)
  if (hoursMatch) {
    return {
      description: 'Update hour-meter reading',
      title: 'Update hours | OpenMaintenance',
      view: <App currentPath={pathname}><EquipmentHoursPage equipmentId={Number(hoursMatch[1])} /></App>,
    }
  }

  const editMatch = pathname.match(equipmentEditRe)
  if (editMatch) {
    return {
      description: 'Edit equipment',
      title: 'Edit equipment | OpenMaintenance',
      view: <App currentPath={pathname}><EquipmentEditPage equipmentId={Number(editMatch[1])} /></App>,
    }
  }

  const deleteMatch = pathname.match(equipmentDeleteRe)
  if (deleteMatch) {
    return {
      description: 'Delete equipment',
      title: 'Delete equipment | OpenMaintenance',
      view: <App currentPath={pathname}><EquipmentDeletePage equipmentId={Number(deleteMatch[1])} /></App>,
    }
  }

  if (pathname === '/settings') {
    return {
      description: 'App settings',
      title: 'Settings | OpenMaintenance',
      view: <App currentPath={pathname}><SettingsPage /></App>,
    }
  }

  // pre-react rendered a blank page here, with a page error (#184): Not Found
  // renders inside the shell instead, as its own <main>.
  return {
    description: `There is no route for ${pathname}.`,
    title: 'Not Found | OpenMaintenance',
    view: <AppShell currentPath={pathname}><NotFound path={pathname} /></AppShell>,
  }
}
