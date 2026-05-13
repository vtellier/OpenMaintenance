import { html, type ArrowExpression } from '@arrow-js/core'
import { NavBar } from '@/components/NavBar'

export function App(currentPath: string, pageContent: ArrowExpression) {
  return html`<div class="app-shell">
    ${NavBar(currentPath)}
    <main class="app-content">${pageContent}</main>
  </div>`
}
