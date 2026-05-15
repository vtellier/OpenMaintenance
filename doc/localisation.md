# Localisation

How OpenMaintenance adapts its language and display formats to the user's region and preferences.

## Overview

All locale settings are **independent** of each other. Choosing French as the language does not automatically change the date format, and vice versa. This gives users full control regardless of where they live or what conventions they follow.

On first launch the app reads `navigator.language` from the browser and seeds reasonable defaults for all five settings. After that, the user controls each setting individually from the Settings screen.

## Locale Settings

### Language

The display language for all text in the application.

| Code | Language |
|------|----------|
| `en` | English |
| `fr` | French |
| `es` | Spanish |
| `de` | German |

Default detection: the browser's primary language tag is mapped to the nearest supported language (e.g. `fr-CA` → `fr`, `en-GB` → `en`). Falls back to `en` if no match is found.

### Date Format

Controls how calendar dates are displayed throughout the app (intervention dates, task due dates, hour-meter update timestamps).

| Option | Example | Typical regions |
|--------|---------|-----------------|
| DD/MM/YYYY | 14/05/2026 | Europe, Latin America, most of the world |
| MM/DD/YYYY | 05/14/2026 | United States |
| YYYY-MM-DD | 2026-05-14 | ISO 8601, technical / international |

Default per language on first launch:

| Language | Default date format |
|----------|---------------------|
| English  | MM/DD/YYYY |
| French   | DD/MM/YYYY |
| Spanish  | DD/MM/YYYY |
| German   | DD/MM/YYYY |

### Time Format

Controls how times are displayed (e.g. in history entries, if time is shown alongside a date).

| Option | Example |
|--------|---------|
| 24-hour | 15:30 |
| 12-hour | 3:30 PM |

Default per language on first launch:

| Language | Default time format |
|----------|---------------------|
| English  | 12-hour |
| French   | 24-hour |
| Spanish  | 24-hour |
| German   | 24-hour |

### First Day of Week

Determines which day is shown as the first column in any date picker or calendar widget.

| Option |
|--------|
| Monday |
| Sunday |

Default per language on first launch:

| Language | Default |
|----------|---------|
| English  | Sunday |
| French   | Monday |
| Spanish  | Monday |
| German   | Monday |

### Number Format

Controls the thousands separator and decimal mark used when displaying numeric values (primarily hour-meter readings).

| Option | Example | Typical regions |
|--------|---------|-----------------|
| 1,234.5 | comma thousands · dot decimal | English-speaking |
| 1.234,5 | dot thousands · comma decimal | Germany, Spain, most of Europe |
| 1 234,5 | space thousands · comma decimal | France |

Default per language on first launch:

| Language | Default |
|----------|---------|
| English  | 1,234.5 |
| French   | 1 234,5 |
| Spanish  | 1.234,5 |
| German   | 1.234,5 |

---

## Initial Detection

When the app is opened for the first time (no locale settings in `localStorage`):

1. Read `navigator.language` (e.g. `"fr-BE"`, `"en-US"`, `"de"`).
2. Extract the primary language subtag (e.g. `"fr"`, `"en"`, `"de"`).
3. If the subtag matches a supported language code, use it; otherwise fall back to `en`.
4. Set all five settings to the defaults for that language (see tables above).
5. Persist to `localStorage`.

On subsequent visits, stored values are always used — the browser locale is never re-read automatically.

---

## Persistence

All five settings are stored in `localStorage` under the following keys:

| Setting | Key |
|---------|-----|
| Language | `openmaintenance:locale:language` |
| Date format | `openmaintenance:locale:date-format` |
| Time format | `openmaintenance:locale:time-format` |
| First day of week | `openmaintenance:locale:week-start` |
| Number format | `openmaintenance:locale:number-format` |

Changes take effect immediately — no page reload required. The HTML `lang` attribute on `<html>` updates to the chosen language code when the language setting changes.

---

## Localizable Content

The following categories of text are translated into all supported languages:

### Navigation
- Tab / navbar labels: Dashboard, Equipments, History, Settings

### Page titles and headings
- All screen titles and section headings

### Form labels and buttons
- Field labels (Name, Description, Date, Location, Comments, …)
- Button text (Save, Cancel, Delete, Edit, Confirm, …)
- Picker options (Auto, Light, Dark, Monday, Sunday, 24-hour, 12-hour, …)

### Status and relative-time strings
- Relative time: "just now", "Xm ago", "Xh ago", "Xd ago", "Xmo ago", "Xy ago", "never"
- Due status: "overdue by Xd", "overdue by Xmo", "due today", "in Xd", "at X h", "OK"

### Empty states
- "No equipments yet. Add your first one."
- "You're all caught up. Nothing due right now."
- "No interventions recorded yet."

### Confirmation and error messages
- Delete confirmations, cascade warnings
- Validation errors (future date, hours constraint, …)
- Load failure messages

### Units
- The hour-meter unit suffix (English: " h"; other languages may use the same or a translated equivalent)

---

## Behavior on Change

When the user changes any locale setting in the Settings screen:

- The new value is written to `localStorage` immediately.
- All displayed text and formatted values update without a page reload.
- Changing the language also updates `document.documentElement.lang`.
- Format settings (date, time, number) affect all formatted values rendered anywhere in the app from that point forward.
