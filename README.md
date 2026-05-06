# OpenMaintenance

OpenMaintenance is a **100% self-hostable**, free, and open-source web app to track maintenance tasks for any equipment (boats, cars, homes, etc.). Log checks, set hour/time-based reminders, and export data as CSV.

## Self-Hosting
OpenMaintenance is designed to be **easy to deploy anywhere**, including:
- **Low-end VPS** (minimal resource usage)
- **Local machines** (Windows, macOS, Linux)

No complex setup required—just **download and run**.

## Tech Stack
- **Backend**: Go (Fiber) – Single binary, cross-platform, and lightweight.
- **Frontend**: React + Tailwind CSS – Dynamic and scalable UI.
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

### React Frontend
- Component-based architecture
- Dynamic navigation and state management
- Responsive design with Tailwind CSS
- Scalable for complex UI features

### Deployment
Single binary deployment with embedded SQLite database and React frontend:

#### Backend (Go)
```bash
# Navigate to the backend directory
cd backend

# Build the Go backend
go build -o bin/openmaintenance .
```

#### Frontend (React)
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Build the React app
npm run build
```

#### Run the Application
```bash
# Navigate to the backend directory
cd backend

# Run the Go backend
go run main.go
```

The application will:
- Create a `backend/bin/maintenance.db` SQLite database automatically
- Serve the React frontend on port 3000

Access the web interface at `http://localhost:3000`

### Repository Structure
```
OpenMaintenance/
├── backend/          # Go backend source code
│   ├── bin/          # Database and compiled binary
│   ├── internal/     # Internal modules
│   ├── main.go       # Entry point
│   ├── go.mod        # Go dependencies
│   └── go.sum        # Go dependency checksums
├── frontend/         # React frontend source code
│   ├── public/       # Static assets
│   ├── build/        # Built frontend files
│   └── package-lock.json
├── README.md         # Project documentation
└── LICENSE           # License file
```


