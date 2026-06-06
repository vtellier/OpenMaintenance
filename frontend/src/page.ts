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
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'

export interface Page {
  description: string
  title: string
  view: unknown
}

const equipmentPathRe = /^\/equipments\/(\d+)(?:\/(history|documents|info))?$/
const equipmentEditRe = /^\/equipments\/(\d+)\/edit$/
const equipmentDeleteRe = /^\/equipments\/(\d+)\/delete$/
const equipmentHoursRe = /^\/equipments\/(\d+)\/edit\/hours$/

export async function routeToPage(url: string): Promise<Page> {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/' || pathname === '') {
    return {
      description: 'Dashboard — upcoming and overdue maintenance tasks',

      title: 'Dashboard | OpenMaintenance',
      view: App(pathname, DashboardPage()),
    }
  }

  if (pathname === '/equipments') {
    return {
      description: 'All equipments',

      title: 'Equipments | OpenMaintenance',
      view: App(pathname, EquipmentsPage()),
    }
  }

  const hoursMatch = pathname.match(equipmentHoursRe)
  if (hoursMatch) {
    const view = EquipmentHoursPage(hoursMatch[1])
    return {
      description: 'Update hour-meter reading',

      title: 'Update hours | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const editMatch = pathname.match(equipmentEditRe)
  if (editMatch) {
    const view = EquipmentEditPage(editMatch[1])
    return {
      description: 'Edit equipment',

      title: 'Edit equipment | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const deleteMatch = pathname.match(equipmentDeleteRe)
  if (deleteMatch) {
    const view = EquipmentDeletePage(deleteMatch[1])
    return {
      description: 'Delete equipment',

      title: 'Delete equipment | OpenMaintenance',
      view: App(pathname, view),
    }
  }

  const match = pathname.match(equipmentPathRe)
  if (match) {
    const id = match[1]
    const tab = match[2] ?? ''

    let equipmentName: string | null = null
    try {
      const equipmentApi = new EquipmentApi(apiConfig)
      const eq = await equipmentApi.getEquipment({ id: parseInt(id, 10) })
      equipmentName = eq.name ?? null
    } catch {
      // fallback to generic title
    }

    const view = await EquipmentDetailPage(id, tab)
    const name = equipmentName ?? `Equipment #${id}`
    return {
      description: `${name} details`,

      title: `${name} | OpenMaintenance`,
      view: App(pathname, view),
    }
  }

  if (pathname === '/history') {
    return {
      description: 'Global intervention history',

      title: 'History | OpenMaintenance',
      view: App(pathname, HistoryPage()),
    }
  }

  if (pathname === '/settings') {
    return {
      description: 'App settings',

      title: 'Settings | OpenMaintenance',
      view: App(pathname, SettingsPage()),
    }
  }

  return {
    description: `There is no route for ${pathname}.`,
    title: 'Not Found | OpenMaintenance',
    view: NotFound({ path: pathname }),
  }
}
