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
- Update status line, loaded asynchronously from `GET /api/update-status`:
  - **Update available**: "⬆ vX.Y.Z available — [Release notes ↗]" (link opens `release_url` in new tab)
  - **Up to date**: "✓ Up to date"
  - **Check failed / pending**: nothing shown (silent failure)
- Link to the project repository.
- License.

### Backup

Read-only section — shows the current backup configuration and lists existing backup files.

- **Status**: Enabled / Disabled (reflects the `backup.enabled` config value)
- **Backup directory**: Absolute path where backup files are stored
- **Retention**: How many backups are kept (0 = unlimited)
- **Backup files**: Table listing existing `.bak` files with name, size, and creation date (newest first). Shows "No backups yet" when the list is empty. Hidden when backup is disabled.

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
|    maintenance.20260622-140000.bak   1.2 MB   Today  |
|    maintenance.20260621-140000.bak   1.1 MB   1d ago |
|                                                      |
|  About                                               |
|    OpenMaintenance v0.1.0                            |
|    ⬆ v0.2.0 available — Release notes ↗             |
|    github.com/vtellier/OpenMaintenance               |
|    MIT License                                       |
|                                                      |
+------------------------------------------------------+
```
