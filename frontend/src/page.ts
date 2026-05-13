import '@arrow-js/framework'

import { App } from '@/App'
import { NotFound } from '@/components/NotFound'
import { DashboardPage } from '@/pages/DashboardPage'
import { EquipmentsPage } from '@/pages/EquipmentsPage'
import { EquipmentDetailPage } from '@/pages/EquipmentDetailPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

export interface Page {
  description: string
  status: number
  title: string
  view: unknown
}

const equipmentPathRe = /^\/equipments\/(\d+)(?:\/(history|info))?$/

export function routeToPage(url: string): Page {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/' || pathname === '') {
    return {
      description: 'Dashboard — upcoming and overdue maintenance tasks',
      status: 200,
      title: 'Dashboard | OpenMaintenance',
      view: App(pathname, DashboardPage()),
    }
  }

  if (pathname === '/equipments') {
    return {
      description: 'All equipments',
      status: 200,
      title: 'Equipments | OpenMaintenance',
      view: App(pathname, EquipmentsPage()),
    }
  }

  const match = pathname.match(equipmentPathRe)
  if (match) {
    const id = match[1]
    const tab = match[2] ?? ''
    return {
      description: `Equipment #${id} details`,
      status: 200,
      title: `Equipment #${id} | OpenMaintenance`,
      view: EquipmentDetailPage(id, tab),
    }
  }

  if (pathname === '/history') {
    return {
      description: 'Global intervention history',
      status: 200,
      title: 'History | OpenMaintenance',
      view: App(pathname, HistoryPage()),
    }
  }

  if (pathname === '/settings') {
    return {
      description: 'App settings',
      status: 200,
      title: 'Settings | OpenMaintenance',
      view: App(pathname, SettingsPage()),
    }
  }

  return {
    description: `There is no route for ${pathname}.`,
    status: 404,
    title: 'Not Found | OpenMaintenance',
    view: NotFound({ path: pathname }),
  }
}
