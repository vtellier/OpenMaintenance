import { describe, expect, it } from 'vitest'
import { UpdateStatusFromJSON } from '@generated/api/models/UpdateStatus'
import type { UpdateStatus } from '@generated/api/models/UpdateStatus'
import {
  checkForUpdates, checkMessageOf, noCheckMessage, serverUnreachableMessage, UpdateChecker, updateStatusLine,
} from '@/lib/updateCheck'

const status = (json: Record<string, unknown>) => UpdateStatusFromJSON({ current_version: 'v0.5.0', ...json })

describe('updateStatusLine', () => {
  it('shows nothing before a status has arrived', () => {
    expect(updateStatusLine(null)).toBeNull()
  })

  it('shows nothing while no check has succeeded (#49)', () => {
    expect(updateStatusLine(status({ latest_version: '', update_available: false }))).toBeNull()
    expect(updateStatusLine(status({ latest_version: '', update_available: false, error: 'unreachable' }))).toBeNull()
  })

  it('offers a newer version with its release notes', () => {
    expect(updateStatusLine(status({
      latest_version: 'v0.6.0',
      update_available: true,
      release_url: 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0',
    }))).toEqual({
      kind: 'available',
      latestVersion: 'v0.6.0',
      releaseUrl: 'https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0',
    })
  })

  it('offers a newer version with an empty link when the API gives none', () => {
    expect(updateStatusLine(status({ latest_version: 'v0.6.0', update_available: true })))
      .toEqual({ kind: 'available', latestVersion: 'v0.6.0', releaseUrl: '' })
  })

  it('says up to date with the running version', () => {
    expect(updateStatusLine(status({ latest_version: 'v0.5.0', update_available: false })))
      .toEqual({ kind: 'upToDate', currentVersion: 'v0.5.0' })
  })

  it('keeps the last successful result after a failed check', () => {
    // The backend keeps latest_version from the last successful check.
    expect(updateStatusLine(status({ latest_version: 'v0.5.0', update_available: false, error: 'rate_limited' })))
      .toEqual({ kind: 'upToDate', currentVersion: 'v0.5.0' })
  })
})

describe('checkMessageOf', () => {
  it.each<[Record<string, unknown>, string, boolean]>([
    [{ cached: false }, 'Checked just now.', false],
    [{}, 'Checked just now.', false],
    [{ cached: true }, 'Already checked less than a minute ago.', false],
    [{ error: 'unreachable' }, '⚠ Could not reach GitHub. Is the server offline?', true],
    [{ error: 'rate_limited' }, "⚠ GitHub's rate limit is reached. Try again later.", true],
    [{ error: 'unexpected_response' }, '⚠ GitHub sent an unexpected response. Try again later.', true],
    // A reused result that is a failure gives the failure.
    [{ error: 'rate_limited', cached: true }, "⚠ GitHub's rate limit is reached. Try again later.", true],
  ])('%j: %j', (json, text, failed) => {
    expect(checkMessageOf(status({ latest_version: '', update_available: false, ...json }))).toEqual({ text, failed })
  })
})

describe('noCheckMessage', () => {
  it('is empty', () => {
    expect(noCheckMessage).toEqual({ text: '', failed: false })
  })
})

describe('checkForUpdates', () => {
  function fakeApi(answer: UpdateStatus | Error) {
    let calls = 0
    const api: UpdateChecker = {
      checkForUpdates: async () => {
        calls++
        if (answer instanceof Error) throw answer
        return answer
      },
    }
    return { api, calls: () => calls }
  }

  it('resolves to the status the backend answered and its message', async () => {
    const answer = status({ latest_version: 'v0.6.0', update_available: true, cached: false })
    const { api, calls } = fakeApi(answer)

    expect(await checkForUpdates(api)).toEqual({ status: answer, message: { text: 'Checked just now.', failed: false } })
    expect(calls()).toBe(1)
  })

  it('resolves to a failed check with its status, which keeps the last successful result', async () => {
    const answer = status({ latest_version: 'v0.5.0', update_available: false, error: 'unreachable' })
    const { api } = fakeApi(answer)

    expect(await checkForUpdates(api)).toEqual({
      status: answer,
      message: { text: '⚠ Could not reach GitHub. Is the server offline?', failed: true },
    })
  })

  it('resolves to no status when the server does not answer', async () => {
    const { api } = fakeApi(new TypeError('Failed to fetch'))

    expect(await checkForUpdates(api)).toEqual({ status: null, message: serverUnreachableMessage })
    expect(serverUnreachableMessage).toEqual({ text: '⚠ Could not reach the OpenMaintenance server.', failed: true })
  })
})
