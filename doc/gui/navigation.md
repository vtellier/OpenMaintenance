# Navigation & App Shell

## Main sections

The app has four top-level sections:

1. **Dashboard** — Landing page. Upcoming and overdue tasks grouped by equipment.
2. **Equipments** — List of all equipments; entry point to manage each one.
3. **History** — Global intervention history across all equipments.
4. **Settings** — App-wide settings (theme, etc.).

## Navigation pattern (responsive)

The navigation adapts to the device:

- **Desktop / tablet (landscape)**: horizontal top navbar.
  - Left: app name/logo (clickable, goes to Dashboard).
  - Center or right: links to the four sections.
  - Active section is visually highlighted.
- **Mobile (and tablet portrait)**: bottom tab bar.
  - Four tabs: Dashboard, Equipments, History, Settings.
  - Each tab has an icon and a short label.
  - Active tab is visually highlighted.
  - Fixed to the bottom of the viewport, always reachable with the thumb.

## Default landing

Opening the app at `/` lands on the **Dashboard**.

## Global elements

- **Theme**: follows system preference by default; manual toggle in Settings.
- **No login screen**, no user menu.
- **Add buttons** are contextual to each screen, not in the global nav.

## URL structure (proposed)

| Path                          | Screen                          |
|-------------------------------|---------------------------------|
| `/`                           | Dashboard                       |
| `/equipments`                 | Equipments list                 |
| `/equipments/:id`             | Equipment detail (Tasks tab)    |
| `/equipments/:id/history`     | Equipment detail (History tab)  |
| `/equipments/:id/info`        | Equipment detail (Info tab)     |
| `/history`                    | Global history                  |
| `/settings`                   | Settings                        |

## Layout sketch

```
+-----------------------------------------------------+
|  OpenMaintenance      Dashboard  Equipments  ...    |  <- desktop top navbar
+-----------------------------------------------------+
|                                                     |
|                   < screen content >                |
|                                                     |
+-----------------------------------------------------+

Mobile:
+---------------------+
|                     |
|   < screen content >|
|                     |
+---------------------+
| 📊  📦  🕘  ⚙️       |  <- bottom tab bar
+---------------------+
```
