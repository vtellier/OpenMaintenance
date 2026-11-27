import type { ReactNode } from 'react'
import { NavBar } from '@/components/NavBar'

interface ShellProps {
  /** The page's pathname, for the navigation's highlight. */
  currentPath: string
  children: ReactNode
}

/** The shell around every page: the navigation, then the page inside `main.app-content`. */
export function App({ currentPath, children }: ShellProps) {
  return (
    <AppShell currentPath={currentPath}>
      <main className="app-content">{children}</main>
    </AppShell>
  )
}

/**
 * The shell without its `<main>`, for a page that brings its own: Not Found,
 * whose `main.not-found` sets its own width and padding.
 */
export function AppShell({ currentPath, children }: ShellProps) {
  return (
    <div className="app-shell">
      <NavBar currentPath={currentPath} />
      {children}
    </div>
  )
}
