import { html, reactive } from '@arrow-js/core'
import { getStoredTheme, setStoredTheme, applyTheme } from '@/theme'
import type { Theme } from '@/theme'

const theme = reactive({ value: getStoredTheme() })

function setTheme(t: Theme) {
  theme.value = t
  setStoredTheme(t)
  applyTheme(t)
}

export const SettingsPage = () => html`
  <section class="page">
    <h1>Settings</h1>

    <section class="settings-section">
      <h2 class="settings-section__title">Appearance</h2>
      <fieldset class="theme-picker">
        <legend class="settings-field__label">Theme</legend>
        <label class="${() => 'theme-option' + (theme.value === 'auto' ? ' active' : '')}">
          <input type="radio" name="theme" value="auto" checked="${() => theme.value === 'auto'}" @change="${() => setTheme('auto')}" />
          Auto
        </label>
        <label class="${() => 'theme-option' + (theme.value === 'light' ? ' active' : '')}">
          <input type="radio" name="theme" value="light" checked="${() => theme.value === 'light'}" @change="${() => setTheme('light')}" />
          Light
        </label>
        <label class="${() => 'theme-option' + (theme.value === 'dark' ? ' active' : '')}">
          <input type="radio" name="theme" value="dark" checked="${() => theme.value === 'dark'}" @change="${() => setTheme('dark')}" />
          Dark
        </label>
      </fieldset>
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">About</h2>
      <p class="settings-about__line">OpenMaintenance ${__APP_VERSION__}</p>
      <p class="settings-about__line"><a href="https://github.com/vtellier/OpenMaintenance">github.com/vtellier/OpenMaintenance</a></p>
      <p class="settings-about__line">MIT License</p>
    </section>
  </section>`
