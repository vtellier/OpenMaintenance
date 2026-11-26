import type { ReactNode } from 'react'

/** The shell around every page. The NavBar comes with its port (#157). */
export function App({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
    </div>
  )
}
