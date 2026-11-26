import type { ReactNode } from 'react'
import { AppShell } from '@/App'
import { NotFound } from '@/components/NotFound'

export interface Page {
  description: string
  title: string
  view: ReactNode
}

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

  // pre-react rendered a blank page here, with a page error (#184): Not Found
  // renders inside the shell instead, as its own <main>.
  return {
    description: `There is no route for ${pathname}.`,
    title: 'Not Found | OpenMaintenance',
    view: <AppShell currentPath={pathname}><NotFound path={pathname} /></AppShell>,
  }
}
