# Overview

## What is OpenMaintenance?

A minimalist, self-hostable, free and open-source web app to **track maintenance tasks** for any equipment (boats, cars, homes, appliances, etc.).

Users define their own maintenance program, log interventions, and see at a glance what is due, soon-due, or overdue.

## Product principles

1. **Minimalist by design** — Lightweight stack, no heavy framework, no bloat. The UI must remain simple and fast.
2. **Self-hostable anywhere** — Single Go binary + SQLite file. Runs on a VPS, a laptop, or a Raspberry Pi.
3. **No authentication** — Anyone with access to the app can use it. Security is delegated to the deployment (network, reverse proxy, etc.).
4. **Multi-device friendly** — Usable on desktop, tablet, and mobile. Layout adapts; no separate mobile app.
5. **User owns the data** — Plain SQLite file. CSV export is a planned feature.
6. **Pragmatic defaults** — The app makes sensible choices and stays out of the user's way.

## Scope (v1)

In scope:
- Manage multiple equipments
- Define a maintenance program (tasks) per equipment
- Log interventions and keep a full history
- Dashboard of upcoming/overdue tasks
- Track an optional hour-meter per equipment
- Light/dark theme

Out of scope (for now):
- User accounts, multi-tenant, roles, permissions
- CSV export (planned)
- Notifications / reminders by email or push (planned)
- File attachments (photos, receipts, manuals)
- Mobile app (the web app is the mobile experience)
