export type Theme = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'openmaintenance:theme'

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'auto'
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'auto'
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}
