import '@arrow-js/framework'

import { App } from './App'
import { NotFound } from './components/NotFound'
import { ApiTestPage } from './pages/ApiTestPage'

export interface Page {
  description: string
  status: number
  title: string
  view: unknown
}

const homePage = {
  description: 'A tiny reactive core with SSR when you need it.',
  title: 'Arrow App',
}

export function routeToPage(url: string): Page {
  const pathname = new URL(url, 'http://arrow.local').pathname

  if (pathname === '/' || pathname === '') {
    return {
      ...homePage,
      status: 200,
      view: App(),
    }
  }

  if (pathname === '/api-test') {
    return {
      description: 'Test page for API client',
      status: 200,
      title: 'API Test | Arrow App',
      view: ApiTestPage(),
    }
  }

  return {
    description: `There is no route for ${pathname}.`,
    status: 404,
    title: 'Not Found | Arrow App',
    view: NotFound({ path: pathname }),
  }
}
