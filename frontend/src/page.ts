import '@arrow-js/framework'

import { App } from '@/App'
import { NotFound } from '@/components/NotFound'
import { DashboardPage } from '@/pages/DashboardPage'
import { EquipmentsPage } from '@/pages/EquipmentsPage'
import { EquipmentDetailPage } from '@/pages/EquipmentDetailPage'
import { EquipmentEditPage } from '@/pages/EquipmentEditPage'
import { EquipmentDeletePage } from '@/pages/EquipmentDeletePage'
import { EquipmentHoursPage } from '@/pages/EquipmentHoursPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

export interface Page {
  description: string
  status: number
  title: string
  view: unknown
}

const equipmentPathRe = /^\/equipments\/(\d+)(?:\/(history|info))?$/
const equipmentEditRe = /^\/equipments\/(\d+)\/edit$/
const equipmentDeleteRe = /^\/equipments\/(\d+)\/delete$/
const equipmentHoursRe = /^\/equipments\/(\d+)\/edit\/hours$/

export async function routeToPage(url: string): Promise<Page> {
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

  const hoursMatch = pathname.match(equipmentHoursRe)
  if (hoursMatch) {
    const view = EquipmentHoursPage(hoursMatch[1])
    return {
      description: 'Update hour-meter reading',
      status: 200,
      title: 'Update hours | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const editMatch = pathname.match(equipmentEditRe)
  if (editMatch) {
    const view = EquipmentEditPage(editMatch[1])
    return {
      description: 'Edit equipment',
      status: 200,
      title: 'Edit equipment | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const deleteMatch = pathname.match(equipmentDeleteRe)
  if (deleteMatch) {
    const view = EquipmentDeletePage(deleteMatch[1])
    return {
      description: 'Delete equipment',
      status: 200,
      title: 'Delete equipment | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const match = pathname.match(equipmentPathRe)
  if (match) {
    const id = match[1]
    const tab = match[2] ?? ''
    const view = await EquipmentDetailPage(id, tab)
    return {
      description: `Equipment #${id} details`,
      status: 200,
      title: `Equipment #${id} | OpenMaintenance`,
      view: App(pathname, view),
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
