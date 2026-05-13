import { component, html } from '@arrow-js/core'
import { MainPage } from '@/pages/MainPage'

export const App = component(() =>
  html`<main class="shell">
    <${MainPage} />
  </main>`
)
