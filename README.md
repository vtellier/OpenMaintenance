# OpenMaintenance

OpenMaintenance is a **minimalist** self-hostable, free, and open-source web app to **track maintenance tasks** for any equipment (boats, cars, homes, etc.). Log checks, set hour/time-based reminders, and export data as CSV.

## Main features

- **No authentication**: anyone who has access to the app can use it.
- **Multiple equipments**: Gather all the devices that needs maintenance in the same place.
- **Custom maintenance program**: You define the maintenance program yourself, whether you decide to follow the manufacturer's recommandations, your own or both.
- **Intervention history**: Log what you did, when you did it to not forget anything.
- **Know what needs to be done before it's too late**: On a single dashboard you get to see what tasks you will have to do in the near future so you can organize yourself.
- **Multi-device friendly**: This is a web app, you can use it from your desktop computer, a mobile or a tablet.

Future features:
- **Export**: That's your data, you get the right to export them as CSV and use them somewhere else.
- **Notifications**: Get notified when it's already too late.

## Self-Hosting
OpenMaintenance is designed to be **easy to deploy anywhere**, including:
- **Low-end VPS** (minimal resource usage)
- **Local machines** (Windows, macOS, Linux)
- **Raspberry Pi Support**: The project is designed to be **Raspberry Pi-compatible** (ARM support), though not actively tested.

No complex setup required, just **download the binaries and run**.

## Tech Stack
- **Backend**: Go (Echo) – Single binary, cross-platform, and lightweight.
- **Frontend**: [Arrow.js](https://arrow-js.com/) – Lightweight, minimalist framework for a fast and efficient UI.
- **Database**: SQLite – Zero setup, single file, embedded.
- **Deployment**: Single binary + SQLite file – No dependencies, just run.
- **API**: OpenAPI 3.0 – Spec-first design with auto-generated Go code and validation.

## Data Model

### Equipment
An **Equipment** represents a component of the maintained system (e.g., a boat engine, car transmission, or home HVAC unit). Each equipment has:
- A **name** (e.g., "Main Engine")
- A **description** (optional details)
- Timestamps for creation and updates

---

## API Development

### OpenAPI + Echo Workflow

#### 1. Update the OpenAPI Spec
- Edit `backend/api/openapi.yaml` to define or modify endpoints, models, and validation rules.
- Follow [OpenAPI 3.0](https://swagger.io/specification/) conventions.

### TODO
- Add explicit `operationId` fields to the OpenAPI spec to avoid auto-generated names (e.g., `equipmentsGet`, `tasksPost`).

### Frontend API Client Generation
To generate the frontend API client from the OpenAPI spec, run:

```bash
cd frontend && pnpm run generate:api
```

To clean the generated API client files, run:

```bash
cd frontend && pnpm run clean:api
```

#### 2. Regenerate Go Code
Run the following command to update the generated Go code:

```bash
make generate-openapi
```

Or manually:
```bash
~/go/bin/oapi-codegen -generate types,server -package generated backend/api/openapi.yaml > backend/internal/generated/openapi.gen.go
```

#### 3. Bind Handlers to Echo Routes
- Import the generated handlers in `backend/internal/routes/`.
- Bind them to Echo routes using the generated validation middleware.

Example:
```go
import (
	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/backend/internal/generated"
	"github.com/oapi-codegen/runtime"
)

func SetupEquipmentRoutes(api *echo.Group, db *sql.DB) {
	// Bind generated handler with validation
	api.GET("/equipments", runtime.Middleware(
		func(ctx context.Context, request generated.GetEquipmentsRequestObject) (generated.GetEquipmentsResponseObject, error) {
			// Implement business logic here
		},
	))
}
```

#### 4. Serve the OpenAPI Spec
- The raw spec is available at `/api/openapi.yaml`.
- Use [Swagger UI](https://swagger.io/tools/swagger-ui/) to serve interactive docs at `/api/docs`.

---

### Example: Adding a New Endpoint

1. **Update `backend/api/openapi.yaml`**:
   ```yaml
   paths:
     /api/equipments/{id}:
       get:
         summary: Get equipment by ID
         parameters:
           - $ref: '#/components/parameters/EquipmentID'
         responses:
           200:
             description: OK
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/Equipment'
   ```

2. **Regenerate Code**:
   ```bash
   make generate-openapi
   ```

3. **Bind to Echo**:
   ```go
   api.GET("/equipments/:id", runtime.Middleware(handlers.GetEquipmentByID))
   ```

4. **Implement Handler**:
   ```go
   func GetEquipmentByID(ctx context.Context, request generated.GetEquipmentByIDRequestObject) (*generated.GetEquipmentByID200Response, error) {
       // Fetch equipment from DB
       return &generated.GetEquipmentByID200Response{Equipment: equipment}, nil
   }
   ```

---

### Troubleshooting

- **Regeneration Issues**: Ensure `openapi.yaml` is valid (use [Swagger Editor](https://editor.swagger.io/) to validate).
- **Validation Errors**: Check that request/response models match the spec.
- **Echo Integration**: Verify routes are bound correctly and middleware is applied.

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

### Arrow.js Frontend
- Lightweight, minimalist framework
- Component-based architecture
- Efficient state management
- Designed for simplicity and performance

### Deployment
Single binary deployment with embedded SQLite database and Arrow.js frontend:

#### Backend (Go)
```bash
# Navigate to the backend directory
cd backend

# Build the Go backend
go build -o bin/openmaintenance .
```

#### Frontend (Arrow.js)
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
pnpm install

# Build the frontend
pnpm run build
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
- Serve the backend API on port 3001

Access the backend API at `http://localhost:3001`

### Repository Structure
```
OpenMaintenance/
├── backend/          # Go backend source code
│   ├── bin/          # Database and compiled binary
│   ├── internal/     # Internal modules
│   ├── main.go       # Entry point
│   ├── go.mod        # Go dependencies
│   └── go.sum        # Go dependency checksums
├── frontend/         # Arrow.js frontend source code
│   ├── public/       # Static assets
│   ├── build/        # Built frontend files
│   └── package-lock.json
├── README.md         # Project documentation
└── LICENSE           # License file
```


