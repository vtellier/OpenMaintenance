.PHONY: generate-openapi build build-backend build-frontend copy-frontend install-oapi-codegen dev

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

build-backend:
	cd backend && go build -ldflags "-X main.Version=$(VERSION)" -o bin/openmaintenance .

build-frontend:
	cd frontend && pnpm run build

copy-frontend:
	rm -rf backend/static
	cp -r frontend/dist/client backend/static

build: build-frontend copy-frontend build-backend

dev:
	@echo "Starting backend on :3001 and frontend on :5173 ..."
	cd backend && go run . &
	cd frontend && pnpm dev
