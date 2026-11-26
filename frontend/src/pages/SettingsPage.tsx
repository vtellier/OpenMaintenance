import { useEffect, useState } from 'react'
import { SystemApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { UpdateCheck } from '@/components/UpdateCheck'
import { BackupSummary, backupSummaryOf, unknownBackupSummary } from '@/lib/backups'
import { formatFileSize } from '@/lib/format'
import { relativeTime } from '@/lib/timestamp'
import { applyTheme, getStoredTheme, setStoredTheme } from '@/theme'
import type { Theme } from '@/theme'

const systemApi = new SystemApi(apiConfig)

const themeOptions: { value: Theme, label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Settings: the theme, the backup configuration and About (doc/gui/settings.md). */
export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  // Null until the backup status has loaded: the section shows only its title.
  const [backups, setBackups] = useState<BackupSummary | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      let summary = unknownBackupSummary
      try {
        summary = backupSummaryOf(await systemApi.getBackupStatus({ signal }))
      } catch {
        // Shown as unknown, with no error (as on pre-react).
      }
      if (signal.aborted) return
      setBackups(summary)
    }
    load()
    return () => controller.abort()
  }, [])

  function chooseTheme(next: Theme) {
    setTheme(next)
    setStoredTheme(next)
    applyTheme(next)
  }

  return (
    <section className="page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section__title">Appearance</h2>
        <fieldset className="theme-picker">
          <legend className="settings-field__label">Theme</legend>
          {themeOptions.map(o => (
            <label key={o.value} className={'theme-option' + (theme === o.value ? ' active' : '')}>
              <input type="radio" name="theme" value={o.value} checked={theme === o.value} onChange={() => chooseTheme(o.value)} /> {o.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Backup</h2>
        {backups && (
          <>
            <p className="settings-about__line">Status: {backups.status}</p>
            <p className="settings-about__line">Directory: {backups.directory}</p>
            <p className="settings-about__line">Retention: {backups.retention}</p>
            {backups.files && (
              <div className="backup-files">
                {backups.files.length === 0
                  ? <p className="backup-files__empty">No backups yet.</p>
                  : (
                    <div className="backup-file-list">
                      {backups.files.map(f => (
                        <div key={f.name} className="backup-file-item">
                          <span className="backup-file-item__name">{f.name}</span>
                          <span className="backup-file-item__size">{formatFileSize(f.size)}</span>
                          <span className="backup-file-item__date">{relativeTime(f.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">About</h2>
        <p className="settings-about__line">OpenMaintenance {__APP_VERSION__}</p>
        <UpdateCheck />
        <p className="settings-about__line"><a href="https://github.com/vtellier/OpenMaintenance">github.com/vtellier/OpenMaintenance</a></p>
        <p className="settings-about__line">MIT License</p>
      </section>
    </section>
  )
}
