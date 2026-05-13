import { html } from '@arrow-js/core'

const sections = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/equipments', label: 'Equipments', icon: '📦' },
  { path: '/history', label: 'History', icon: '🕘' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

const a = (c: boolean) => c ? ' active' : ''

export function NavBar(currentPath: string) {
  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

  return html`<div>
    <nav class="navbar-desktop">
      <a href="/" class="navbar__brand">OpenMaintenance</a>
      <div class="navbar__links">
        ${sections.map(s => html`<a href="${s.path}" class="${'navbar__link' + a(isActive(s.path))}">${s.label}</a>`)}
      </div>
    </nav>
    <nav class="navbar-mobile">
      ${sections.map(s => html`<a href="${s.path}" class="${'tabbar__tab' + a(isActive(s.path))}"><span class="tabbar__icon">${s.icon}</span><span class="tabbar__label">${s.label}</span></a>`)}
    </nav>
  </div>`
}
