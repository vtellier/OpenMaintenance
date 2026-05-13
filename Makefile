.PHONY: generate-openapi build build-backend build-frontend install-oapi-codegen

OAPI_CODEGEN := $(shell which oapi-codegen 2>/dev/null || echo "")

install-oapi-codegen:
	@if [ -z "$(OAPI_CODEGEN)" ]; then \
		echo "Installing oapi-codegen v1.16.3..."; \
		go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@v1.16.3; \
	fi

generate-openapi: install-oapi-codegen
	oapi-codegen -generate types,server -package generated backend/api/openapi.yaml > backend/internal/generated/openapi.gen.go

build-backend:
	go build -o backend/bin/openmaintenance ./backend

build-frontend:
	cd frontend && pnpm run build

build: build-backend build-frontend
