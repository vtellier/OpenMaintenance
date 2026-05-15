import { routeToPage } from '@/page'
import { getStoredTheme, applyTheme } from '@/theme'
import '@/style.css'

const page = await routeToPage(window.location.pathname)
document.title = page.title
const root = document.getElementById('app')!
;(page.view as (el: Element) => void)(root)

applyTheme(getStoredTheme())
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getStoredTheme() === 'auto') applyTheme('auto')
})
