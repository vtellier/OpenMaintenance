import { isActiveSection } from '@/lib/navigation'

const sections = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/equipments', label: 'Equipments', icon: '📦' },
  { path: '/history', label: 'History', icon: '🕘' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

const active = (isActive: boolean) => isActive ? ' active' : ''

/**
 * The app's navigation, both versions: the top navbar (desktop and tablet)
 * and the bottom tab bar (phone). `style.css` shows one or the other by the
 * viewport's width, and highlights the section of `currentPath`.
 */
export function NavBar({ currentPath }: { currentPath: string }) {
  return (
    <div>
      <nav className="navbar-desktop">
        <a href="/" className="navbar__brand">OpenMaintenance</a>
        <div className="navbar__links">
          {sections.map(s => (
            <a key={s.path} href={s.path} className={'navbar__link' + active(isActiveSection(s.path, currentPath))}>{s.label}</a>
          ))}
        </div>
      </nav>
      <nav className="navbar-mobile">
        {sections.map(s => (
          <a key={s.path} href={s.path} className={'tabbar__tab' + active(isActiveSection(s.path, currentPath))}>
            <span className="tabbar__icon">{s.icon}</span>
            <span className="tabbar__label">{s.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
