.PHONY: generate-openapi build build-backend build-frontend copy-frontend install-oapi-codegen

OAPI_CODEGEN := $(shell which oapi-codegen 2>/dev/null || echo "")

install-oapi-codegen:
	@if [ -z "$(OAPI_CODEGEN)" ]; then \
		echo "Installing oapi-codegen v1.16.3..."; \
		go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@v1.16.3; \
	fi

generate-openapi: install-oapi-codegen
	oapi-codegen -generate types,server -package generated backend/api/openapi.yaml > backend/internal/generated/openapi.gen.go

build-backend:
	cd backend && go build -o bin/openmaintenance .

build-frontend:
	cd frontend && pnpm run build

copy-frontend:
	rm -rf backend/static
	cp -r frontend/dist/client backend/static

build: build-frontend copy-frontend build-backend
