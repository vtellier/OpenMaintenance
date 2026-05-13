# Settings

App-wide settings. Kept intentionally short — OpenMaintenance is minimalist.

## Sections

### Appearance
- **Theme**: Auto (follow system) / Light / Dark. Default: Auto.

### About
- App name and version.
- Link to the project repository.
- License.

## Future settings (out of scope for v1)

- "Due soon" window (currently fixed at 30 days for time-based tasks).
- Hour-meter **staleness threshold** (default: 7 days). Equipments whose `hours_updated_at` is older than this threshold are emphasized in the Dashboard freshness banner.
- Date format / locale.
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
|  About                                               |
|    OpenMaintenance v0.1.0                            |
|    github.com/vtellier/OpenMaintenance               |
|    MIT License                                       |
|                                                      |
+------------------------------------------------------+
```
