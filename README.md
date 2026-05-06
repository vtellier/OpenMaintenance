# OpenMaintenance

OpenMaintenance is a **100% self-hostable**, free, and open-source web app to track maintenance tasks for any equipment (boats, cars, homes, etc.). Log checks, set hour/time-based reminders, and export data as CSV.

## Self-Hosting
OpenMaintenance is designed to be **easy to deploy anywhere**, including:
- **Low-end VPS** (minimal resource usage)
- **Local machines** (Windows, macOS, Linux)

No complex setup required—just **download and run**.

## Tech Stack
- **Backend**: Go (Fiber) – Single binary, cross-platform, and lightweight.
- **Frontend**: HTML + HTMX + Tailwind CSS – No build step, dynamic without heavy JS.
- **Database**: SQLite – Zero setup, single file, embedded.
- **Deployment**: Single binary + SQLite file – No dependencies, just run.

## Raspberry Pi Support
The project is designed to be **Raspberry Pi-compatible** (ARM support), though not actively tested.

## Data Model

### Equipment
An **Equipment** represents a component of the maintained system (e.g., a boat engine, car transmission, or home HVAC unit). Each equipment has:
- A **name** (e.g., "Main Engine")
- A **description** (optional details)
- Timestamps for creation and updates

### Task
A **Task** defines a maintenance checkpoint tied to an Equipment. Tasks are predefined (e.g., from manufacturer guidelines) and include:
- **Name** (e.g., "Oil Change")
- **Description** (optional details)
- **Conditions**: Triggered by the first occurrence of:
  - **Hours interval** (e.g., every 100 hours of usage) **OR**
  - **Months interval** (e.g., every 6 months)

### Intervention
An **Intervention** records the execution of a Task, forming the maintenance history. Each intervention includes:
- **Date** (when performed)
- **Location** (optional, e.g., "Marina X")
- **Comments** (optional notes)
- Timestamps for tracking

## Features

### API Endpoints
- **Equipments**: Full CRUD operations (`/equipments`)
- **Tasks**: Full CRUD with equipment filtering (`/tasks`, `/equipments/:id/tasks`)
- **Interventions**: Full CRUD with task filtering (`/interventions`, `/tasks/:id/interventions`)

### HTMX Frontend
- Dynamic navigation between sections
- Real-time form submissions and updates
- Auto-loading data tables
- Responsive design with Tailwind CSS

### Deployment
Single binary deployment with embedded SQLite database:
```bash
go build -o openmaintenance .
./openmaintenance
```

Access the web interface at `http://localhost:3000`


