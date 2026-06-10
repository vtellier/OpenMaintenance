import { html, reactive } from '@arrow-js/core'
import { getStoredTheme, setStoredTheme, applyTheme } from '@/theme'
import type { Theme } from '@/theme'
import { SystemApi } from '@generated/api'
import { apiConfig } from '@/api/config'

const systemApi = new SystemApi(apiConfig)

const theme = reactive({ value: getStoredTheme() })

const updateState = reactive({
  updateAvailable: false,
  latestVersion: '',
  releaseUrl: '',
  checked: false,
})

systemApi.getUpdateStatus()
  .then(status => {
    const latestVersion = status.latestVersion ?? ''
    const updateAvailable = status.updateAvailable
    updateState.updateAvailable = updateAvailable
    updateState.latestVersion = latestVersion
    updateState.releaseUrl = status.releaseUrl ?? ''
    // An empty latestVersion means the background GitHub check is still running
    // or failed — we cannot confirm the app is up to date yet.
    updateState.checked = latestVersion !== '' || updateAvailable
  })
  .catch(() => {
    updateState.checked = true
  })

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
      ${() => {
        if (!updateState.checked) return null
        if (updateState.updateAvailable) {
          const url = updateState.releaseUrl
          const version = updateState.latestVersion
          return html`<p class="settings-about__line settings-about__update">
            <a href="${url}" target="_blank" rel="noopener noreferrer">⬆ ${version} available — Release notes ↗</a>
          </p>`
        }
        return html`<p class="settings-about__line settings-about__uptodate">✓ Up to date</p>`
      }}
      <p class="settings-about__line"><a href="https://github.com/vtellier/OpenMaintenance">github.com/vtellier/OpenMaintenance</a></p>
      <p class="settings-about__line">MIT License</p>
    </section>
  </section>`
