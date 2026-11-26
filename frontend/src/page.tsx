import type { ReactNode } from 'react'
import { App } from '@/App'
import { NotFound } from '@/components/NotFound'

export interface Page {
  description: string
  title: string
  view: ReactNode
}

/**
 * The page for a URL, chosen by its pathname. Pages are full page loads (no
 * router), so `entry-client.tsx` calls this once.
 *
 * While the React port (#146) is under way, only the pages already ported
 * have a route here; every other path shows Not Found. Each port adds its
 * routes back from `git show pre-react:frontend/src/page.ts`.
 */
export async function routeToPage(url: string): Promise<Page> {
  const pathname = new URL(url, 'http://localhost').pathname

  return {
    description: `There is no route for ${pathname}.`,
    title: 'Not Found | OpenMaintenance',
    view: <App><NotFound path={pathname} /></App>,
  }
}
