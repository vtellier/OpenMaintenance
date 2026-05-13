# Session History

## 2026-05-13

- Cleaned up AGENTS.md: removed redundant inline Arrow.js content (now references the skill file instead)
- Fixed stale React references in README.md (project uses Arrow.js)
- Created STATUS.md for session history tracking
- Removed build artifacts (`backend.log`, `OpenMaintenance`, `tmp-main`)
- Removed empty `cmd/` directory
- Added `backend/.gitignore` for build artifacts and logs
- Created root `Makefile` with `generate-openapi`, `build-backend`, `build-frontend` targets
- Added operationId to every path in `backend/api/openapi.yaml` + added missing sub-resource routes
- Regenerated Go code from OpenAPI spec
- Replaced raw Echo route handlers with `generated.ServerInterface` implementation via `handlers.Handler`
- Updated `main.go` to use `RegisterHandlersWithBaseURL`
- Removed old `backend/internal/routes/` directory (equipment.go, task.go, intervention.go, views.go)
- Removed unused `gofiber/fiber/v2` dependency and stale `views.go` referencing React/Fiber
