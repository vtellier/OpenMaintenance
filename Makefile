.PHONY: generate-openapi build build-backend build-backend-linux-amd64 build-backend-windows-amd64 build-frontend copy-frontend install-oapi-codegen dev test-backend vet-backend fmt-check-backend static-placeholder seed

VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

GOBIN := $(shell go env GOPATH)/bin
OAPI_CODEGEN := $(GOBIN)/oapi-codegen

install-oapi-codegen:
	@if [ ! -f "$(OAPI_CODEGEN)" ]; then \
		echo "Installing oapi-codegen v1.16.3..."; \
		go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@v1.16.3; \
	fi

generate-openapi: install-oapi-codegen
	mkdir -p backend/internal/generated
	$(OAPI_CODEGEN) -generate types,server -package generated backend/api/openapi.yaml > backend/internal/generated/openapi.gen.go

build-backend-linux-amd64:
	cd backend && GOOS=linux GOARCH=amd64 go build -ldflags "-X main.Version=$(VERSION)" -o bin/openmaintenance-$(VERSION) .
	cd backend/bin && ln -sf openmaintenance-$(VERSION) openmaintenance

build-backend-windows-amd64:
	cd backend && GOOS=windows GOARCH=amd64 go build -ldflags "-X main.Version=$(VERSION)" -o bin/openmaintenance-$(VERSION).exe .
	cp backend/bin/openmaintenance-$(VERSION).exe backend/bin/openmaintenance.exe

build-backend: build-backend-linux-amd64

build-frontend:
	cd frontend && pnpm run build

copy-frontend:
	rm -rf backend/static
	cp -r frontend/dist/client backend/static

build: build-frontend copy-frontend build-backend

# The main package embeds backend/static (//go:embed), so anything that
# compiles it — go build, go vet, go test ./... — needs that directory to hold
# at least one file. It is a build artifact (see copy-frontend) and is absent
# from a fresh clone or CI checkout, so drop in a placeholder when
# backend/static has no index.html.
static-placeholder:
	@if [ ! -f backend/static/index.html ]; then \
		mkdir -p backend/static; \
		echo '<!doctype html><title>OpenMaintenance</title>' > backend/static/index.html; \
	fi

# ./... rather than ./tests/... so in-package tests (e.g. internal/updater)
# actually run.
test-backend: static-placeholder
	cd backend && go test ./...

vet-backend: static-placeholder
	cd backend && go vet ./...

fmt-check-backend:
	@unformatted=$$(gofmt -l backend) || exit 1; \
	if [ -n "$$unformatted" ]; then \
		echo "These files are not gofmt-formatted (run: gofmt -w <file>):"; \
		echo "$$unformatted"; \
		exit 1; \
	fi

# Populate a *running* backend with a realistic demo dataset (overdue /
# due-soon / OK statuses). Start the backend first. Override the target with
# OM_BASE_URL=http://host:port for a remote instance.
seed:
	cd backend && go run ./cmd/seed

dev:
	@echo "Starting backend on :3001 and frontend on :5173 ..."
	cd backend && go run . &
	cd frontend && pnpm dev --host
