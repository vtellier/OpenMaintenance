import type { UpdateStatus, UpdateStatusErrorEnum } from '@generated/api/models/UpdateStatus'

// Settings → About: the update status line and the "Check for updates"
// button (doc/gui/settings.md, "About"). The status line shows the backend's
// last update check; the button asks the backend to check GitHub now. The
// component only renders what these functions give.

/** The status line, once a check has succeeded. */
export type UpdateStatusLine =
  | { kind: 'available', latestVersion: string, releaseUrl: string }
  | { kind: 'upToDate', currentVersion: string }

/**
 * The status line for the backend's update status: nothing before any status
 * has arrived, nor while no check has succeeded (an empty `latestVersion`):
 * the app cannot claim to be up to date then (#49).
 */
export function updateStatusLine(status: UpdateStatus | null): UpdateStatusLine | null {
  if (!status) return null
  const latestVersion = status.latestVersion ?? ''
  if (!latestVersion && !status.updateAvailable) return null
  if (status.updateAvailable) return { kind: 'available', latestVersion, releaseUrl: status.releaseUrl ?? '' }
  return { kind: 'upToDate', currentVersion: status.currentVersion }
}

/** The message next to the button once a manual check has ended. */
export interface CheckMessage {
  text: string
  /** Shown as an error (`update-check__message--error`). */
  failed: boolean
}

/** No message: before the first manual check, and while one runs. */
export const noCheckMessage: CheckMessage = { text: '', failed: false }

// Why a manual check failed, by the API's `error` code.
const failureMessages: Record<UpdateStatusErrorEnum, string> = {
  unreachable: 'Could not reach GitHub. Is the server offline?',
  rate_limited: "GitHub's rate limit is reached. Try again later.",
  unexpected_response: 'GitHub sent an unexpected response. Try again later.',
}

/**
 * The message for the status a manual check answered with. A reused result
 * (`cached`) that is a failure gives the failure.
 */
export function checkMessageOf(status: Pick<UpdateStatus, 'error' | 'cached'>): CheckMessage {
  if (status.error) return { text: '⚠ ' + failureMessages[status.error], failed: true }
  if (status.cached) return { text: 'Already checked less than a minute ago.', failed: false }
  return { text: 'Checked just now.', failed: false }
}

/** The message when the OpenMaintenance server itself did not answer. */
export const serverUnreachableMessage: CheckMessage = { text: '⚠ Could not reach the OpenMaintenance server.', failed: true }

/** The part of the generated SystemApi that a manual check goes through. */
export interface UpdateChecker {
  checkForUpdates(): Promise<UpdateStatus>
}

export interface CheckResult {
  /** The status to show from now on, or null to keep the one shown. */
  status: UpdateStatus | null
  message: CheckMessage
}

/**
 * Asks the backend to check GitHub now. Resolves to the status it answered
 * with and its message, or, when the server did not answer, to no status
 * (the status line stays as it was) and `serverUnreachableMessage`.
 */
export async function checkForUpdates(api: UpdateChecker): Promise<CheckResult> {
  try {
    const status = await api.checkForUpdates()
    return { status, message: checkMessageOf(status) }
  } catch {
    return { status: null, message: serverUnreachableMessage }
  }
}
