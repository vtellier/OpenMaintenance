import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { routeToPage } from '@/page'
import { getStoredTheme, applyTheme } from '@/theme'
import '@/style.css'

const page = await routeToPage(window.location.pathname)
document.title = page.title
createRoot(document.getElementById('app')!).render(<StrictMode>{page.view}</StrictMode>)

applyTheme(getStoredTheme())
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getStoredTheme() === 'auto') applyTheme('auto')
})
