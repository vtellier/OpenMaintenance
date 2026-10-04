import { html, reactive } from '@arrow-js/core'
import { SystemApi } from '@generated/api'
import type { UpdateStatus, UpdateStatusErrorEnum } from '@generated/api'
import { apiConfig } from '@/api/config'

const systemApi = new SystemApi(apiConfig)

// Why a manual check failed, by the API's `error` code (doc/gui/settings.md).
const failureMessages: Record<UpdateStatusErrorEnum, string> = {
  unreachable: 'Could not reach GitHub. Is the server offline?',
  rate_limited: "GitHub's rate limit is reached. Try again later.",
  unexpected_response: 'GitHub sent an unexpected response. Try again later.',
}

/**
 * Settings → About: the update status line and the "Check for updates"
 * button. The line shows the backend's last update check; the button asks the
 * backend to check GitHub now, then updates the line and says how it went.
 */
export function UpdateCheck() {
  const state = reactive({
    currentVersion: '',
    latestVersion: '',
    updateAvailable: false,
    releaseUrl: '',
    checking: false,
    message: '',
    failed: false,
  })

  function showStatus(status: UpdateStatus) {
    state.currentVersion = status.currentVersion
    state.latestVersion = status.latestVersion ?? ''
    state.updateAvailable = status.updateAvailable
    state.releaseUrl = status.releaseUrl ?? ''
  }

  function showMessage(message: string, failed: boolean) {
    state.message = message
    state.failed = failed
  }

  // A manual check's result is fresher than this page load's GET, which may
  // answer later: once a check has started, ignore the GET.
  let checkStarted = false

  // The startup check fails silently: on error the status line stays hidden.
  systemApi.getUpdateStatus()
    .then(status => { if (!checkStarted) showStatus(status) })
    .catch(() => {})

  async function check() {
    if (state.checking) return
    checkStarted = true
    state.checking = true
    showMessage('', false)
    try {
      const status = await systemApi.checkForUpdates()
      showStatus(status)
      if (status.error) showMessage('⚠ ' + failureMessages[status.error], true)
      else if (status.cached) showMessage('Already checked less than a minute ago.', false)
      else showMessage('Checked just now.', false)
    } catch {
      showMessage('⚠ Could not reach the OpenMaintenance server.', true)
    } finally {
      state.checking = false
    }
  }

  return html`
    ${() => {
      // An empty latestVersion means no check has succeeded yet: we cannot
      // claim the app is up to date.
      if (!state.latestVersion && !state.updateAvailable) return null
      if (state.updateAvailable) {
        return html`<p class="settings-about__line settings-about__update">
          <a href="${() => state.releaseUrl}" target="_blank" rel="noopener noreferrer">⬆ ${() => state.latestVersion} available — Release notes ↗</a>
        </p>`
      }
      return html`<p class="settings-about__line settings-about__uptodate">✓ Up to date (${() => state.currentVersion})</p>`
    }}
    <div class="update-check">
      <button type="button" class="btn btn--small update-check__button" @click="${check}"
        disabled="${() => state.checking}" aria-busy="${() => state.checking ? 'true' : false}">
        ${() => state.checking ? 'Checking…' : 'Check for updates'}
      </button>
      <span class="${() => 'update-check__message' + (state.failed ? ' update-check__message--error' : '')}" role="status">${() => state.message}</span>
    </div>`
}
