# Settings

App-wide settings. Kept intentionally short — OpenMaintenance is minimalist.

## Sections

### Appearance
- **Theme**: Auto (follow system) / Light / Dark. Default: Auto.

### Localisation

All locale settings are independent — changing the language does not change the date format, and vice versa. See [localisation.md](../localisation.md) for detection logic, persistence keys, and the full list of translatable strings.

- **Language**: English / French / Spanish / German. Seeded from browser locale on first launch.
- **Date format**: DD/MM/YYYY · MM/DD/YYYY · YYYY-MM-DD. Seeded from language default on first launch.
- **Time format**: 24-hour · 12-hour. Seeded from language default on first launch.
- **First day of week**: Monday · Sunday. Seeded from language default on first launch.
- **Number format**: 1,234.5 · 1.234,5 · 1 234,5. Seeded from language default on first launch.

Changes take effect immediately without a page reload.

### About
- App name and version.
- Update status line, loaded asynchronously from `GET /api/update-status` and refreshed by **Check for updates**:
  - **Update available**: "⬆ vX.Y.Z available — [Release notes ↗]" (link opens `release_url` in new tab)
  - **Up to date**: "✓ Up to date (vX.Y.Z)", where vX.Y.Z is the running version (`current_version`)
  - **No successful check yet** (pending or failed): nothing shown. The startup check fails silently; only a manual check reports errors.
- **Check for updates** button, always shown below the status line. It asks the backend to query GitHub right away (`POST /api/update-status/check`) instead of relying on the startup check.
  - While the check runs, the button is disabled and reads "Checking…".
  - When it ends, a short message appears next to the button, and the status line shows the new result:

    | Outcome | Message |
    |---|---|
    | GitHub answered | "Checked just now." |
    | Previous check ended less than a minute ago (`cached: true`), so GitHub was not queried again | "Already checked less than a minute ago." |
    | GitHub could not be reached (`error: unreachable`) | "⚠ Could not reach GitHub. Is the server offline?" |
    | GitHub's API rate limit is reached (`error: rate_limited`) | "⚠ GitHub's rate limit is reached. Try again later." |
    | GitHub answered with an error or an unreadable body (`error: unexpected_response`) | "⚠ GitHub sent an unexpected response. Try again later." |
    | The OpenMaintenance server itself did not answer | "⚠ Could not reach the OpenMaintenance server." |

  - A failed check leaves the status line on the last successful result. When the reused result (`cached: true`) is a failure, the failure message is shown.
- Link to the project repository.
- License.

#### How the update check works

The backend, not the browser, asks GitHub for the latest release (`GET https://api.github.com/repos/vtellier/OpenMaintenance/releases/latest`) and keeps the result in memory.

- It checks once at startup, then only when someone clicks **Check for updates**.
- GitHub allows 60 unauthenticated requests per hour per IP address. To stay well under that:
  - Clicks that arrive while a check is running wait for that check and share its result.
  - A click less than 60 seconds after the previous check ended (successful or not) does not query GitHub. It returns the previous result with `cached: true`.
- Every check records when it ended (`checked_at`). A failed check also records why (`error`) and keeps `latest_version` and `release_url` from the last successful check.

### Backup

Read-only section — shows the current backup configuration and lists existing backup files.

- **Status**: Enabled / Disabled (reflects the `backup.enabled` config value)
- **Backup directory**: Absolute path where backup files are stored
- **Retention**: How many backups are kept (0 = unlimited)
- **Backup files**: Table listing existing backups with name, size, and creation date (newest first). Backups are `.tar.gz` archives holding the database and the attached files; legacy `.bak` files left by older releases (database only) are listed too until rotation removes them. See [configuration.md — Backups](../configuration.md#backups). Shows "No backups yet" when the list is empty. Hidden when backup is disabled.

## Future settings (out of scope for v1)

- "Due soon" window (currently fixed at 30 days for time-based tasks).
- Hour-meter **staleness threshold** (default: 7 days). Equipments whose `hours_updated_at` is older than this threshold are emphasized in the Dashboard freshness banner.
- CSV export.
- Notification settings.

## Layout sketch

```
+------------------------------------------------------+
|  Settings                                            |
+------------------------------------------------------+
|                                                      |
|  Appearance                                          |
|    Theme   ( ) Auto   ( ) Light   ( ) Dark           |
|                                                      |
|  Localisation                                        |
|    Language        [ English        v ]              |
|    Date format     [ DD/MM/YYYY     v ]              |
|    Time format     ( ) 24-hour   ( ) 12-hour         |
|    First day       ( ) Monday    ( ) Sunday          |
|    Number format   [ 1,234.5        v ]              |
|                                                      |
|  Backup                                              |
|    Status     Enabled                                |
|    Directory  /data/backups                          |
|    Retention  7 backups                              |
|                                                      |
|    maintenance.20260622-140000.tar.gz  4.2 MB  Today |
|    maintenance.20260621-140000.bak     1.1 MB  1d ago|
|                                                      |
|  About                                               |
|    OpenMaintenance v0.1.0                            |
|    ⬆ v0.2.0 available — Release notes ↗             |
|    [ Check for updates ]  Checked just now.          |
|    github.com/vtellier/OpenMaintenance               |
|    MIT License                                       |
|                                                      |
+------------------------------------------------------+
```
