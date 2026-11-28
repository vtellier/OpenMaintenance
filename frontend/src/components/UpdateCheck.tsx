import { useEffect, useRef, useState } from 'react'
import { SystemApi } from '@generated/api'
import type { UpdateStatus } from '@generated/api'
import { apiConfig } from '@/api/config'
import { checkForUpdates, noCheckMessage, updateStatusLine } from '@/lib/updateCheck'

const systemApi = new SystemApi(apiConfig)

/**
 * Settings → About: the update status line and the "Check for updates"
 * button. The line shows the backend's last update check; the button asks the
 * backend to check GitHub now, then updates the line and says how it went.
 */
export function UpdateCheck() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState(noCheckMessage)

  // A manual check's result is fresher than this page load's GET, which may
  // answer later: once a check has started, ignore the GET. A ref, not a
  // state: the GET's callback belongs to the first render, and would read
  // that render's state.
  const checkStarted = useRef(false)

  // The startup check fails silently: on error the status line stays hidden.
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      try {
        const loaded = await systemApi.getUpdateStatus({ signal })
        if (signal.aborted || checkStarted.current) return
        setStatus(loaded)
      } catch {
        // Aborted, or the server did not answer: nothing to show.
      }
    }
    load()
    return () => controller.abort()
  }, [])

  async function onCheck() {
    if (checking) return
    checkStarted.current = true
    setChecking(true)
    setMessage(noCheckMessage)
    const result = await checkForUpdates(systemApi)
    if (result.status) setStatus(result.status)
    setMessage(result.message)
    setChecking(false)
  }

  const line = updateStatusLine(status)

  return (
    <>
      {line?.kind === 'available' && (
        <p className="settings-about__line settings-about__update">
          <a href={line.releaseUrl} target="_blank" rel="noopener noreferrer">⬆ {line.latestVersion} available — Release notes ↗</a>
        </p>
      )}
      {line?.kind === 'upToDate' && (
        <p className="settings-about__line settings-about__uptodate">✓ Up to date ({line.currentVersion})</p>
      )}
      <div className="update-check">
        <button
          type="button"
          className="btn btn--small update-check__button"
          onClick={onCheck}
          disabled={checking}
          aria-busy={checking ? 'true' : undefined}
        >
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        <span className={'update-check__message' + (message.failed ? ' update-check__message--error' : '')} role="status">{message.text}</span>
      </div>
    </>
  )
}
