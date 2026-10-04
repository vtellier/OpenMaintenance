import { html, reactive } from '@arrow-js/core'
import { getStoredTheme, setStoredTheme, applyTheme } from '@/theme'
import type { Theme } from '@/theme'
import { SystemApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatFileSize } from '@/lib/format'
import { relativeTime } from '@/lib/timestamp'
import { UpdateCheck } from '@/components/UpdateCheck'

const systemApi = new SystemApi(apiConfig)

const theme = reactive({ value: getStoredTheme() })

const backupState = reactive({
  loaded: false,
  enabled: false,
  path: '',
  keep: 0,
  files: [] as Array<{ name: string; size: number; createdAt: string }>,
})

systemApi.getBackupStatus()
  .then(status => {
    backupState.enabled = status.enabled
    backupState.path = status.path
    backupState.keep = status.keep
    backupState.files = (status.files ?? []).map(f => {
      const d = f.createdAt as unknown // generated client deserializes date-time fields as Date objects, not strings
      const createdAt = d instanceof Date ? d.toISOString() : String(d ?? '')
      return { name: f.name, size: f.size, createdAt }
    })
    backupState.loaded = true
  })
  .catch(() => {
    backupState.loaded = true
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
      <h2 class="settings-section__title">Backup</h2>
      ${() => {
        if (!backupState.loaded) return null
        return html`
          <p class="settings-about__line">Status: ${() => backupState.enabled ? 'Enabled' : 'Disabled'}</p>
          <p class="settings-about__line">Directory: ${() => backupState.path || '—'}</p>
          <p class="settings-about__line">Retention: ${() => backupState.keep === 0 ? 'Unlimited' : backupState.keep + (backupState.keep === 1 ? ' backup' : ' backups')}</p>
          ${() => backupState.enabled ? html`
            <div class="backup-files">
              ${() => backupState.files.length === 0
                ? html`<p class="backup-files__empty">No backups yet.</p>`
                : html`<div class="backup-file-list">${() => backupState.files.map(f =>
                    html`<div class="backup-file-item">
                      <span class="backup-file-item__name">${f.name}</span>
                      <span class="backup-file-item__size">${formatFileSize(f.size)}</span>
                      <span class="backup-file-item__date">${relativeTime(f.createdAt)}</span>
                    </div>`
                  )}</div>`
              }
            </div>` : null
          }
        `
      }}
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">About</h2>
      <p class="settings-about__line">OpenMaintenance ${__APP_VERSION__}</p>
      ${UpdateCheck()}
      <p class="settings-about__line"><a href="https://github.com/vtellier/OpenMaintenance">github.com/vtellier/OpenMaintenance</a></p>
      <p class="settings-about__line">MIT License</p>
    </section>
  </section>`
