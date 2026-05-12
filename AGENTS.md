# OpenMaintenance Agent Guide

## Key Facts
- **Purpose**: Free, open-source web app for tracking maintenance tasks (boats, cars, homes, etc.).
- **Self hostable**: The project is meant to be easily self-hostable.
- **Minimalist**: This is and must stay  a very lightweight application. No fancy framework, just robust bare minimum technologies.

## Architecture
Two layers: a backend and a frontend.

### Backend
- **Source code**: located in the `backend/` folder
- **Stack**: Go + Echo + SQLite
- **API**: A REST API which is defined with an OpenAPI spec located at `backend/api/`

### Frontend
- **Source code**: located in the folder `frontend/`
- **Framework**: [Arrow.js](https://arrow-js.com/)
- **API**:
  - The OpenAPI spec of the backend IS THE SINGLE SOURCE OF TRUTH
  - The client code of the API is generated using OpenAPI Generator
  - The client is used in Arrow.js components

## Workflow Notes
- **No CI/CD**: No `.github`, `.gitlab`, or other workflow configs.
- **Scripts / CLI / Tools**: There is no common tool, the backend and the frontend have their own, independ from each others
- **NO TESTING**
- **API Client Generation**: Use `pnpm run generate:api` in the frontend directory to generate the TypeScript API client from the OpenAPI spec. Use `pnpm run clean:api` to remove generated files.

## Agent instructions

### The README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

### When coding
- **Always check your code**: Every time you modify **frontend** or **backend** code, validate it still compiles. Run `npm run build` for the frontend and `go build` for the backend.
- **Use Context7 MCP**: To read the docs, especially the ones of Arrow.js.
- **Use Chrom-DevTool MCP**: To test the frontend

### Critical Reminders
- **Ask for Clarification**: When there is ambiguity, ask instead of guessing.
- **Remind about git**: Suggest the user to `git commit` when there's a lot of uncommitted modification.
- **Short answers**: Avoid giving too much information that has not been asked, focus on answering what has been explicitly asked.
- **Don't over-plan**: Offer plans that target only the given scope. If the scope isn't clear ask for more details.
- **Always run background tasks via pty plugin**: the plugin `opencode-pty` is the only way you have to run tasks in background, NEVER bypass it.

### Session rituals
- **Session summary**: **Always** append a 1-10 lines session summary to STATUS.md before exiting the session. It shall include date and time.

<!-- arrow-js-skill:start -->
# Arrow

Use the local Arrow references when working on this project:

- `.arrow-js/skill/getting-started.md`
- `.arrow-js/skill/api.md`
- `.arrow-js/skill/examples.md`

Prefer idiomatic Arrow patterns:
- `reactive()` for live state
- `html` tagged templates for DOM
- `component()` for reusable view units
- `routeToPage(url)` in scaffolded SSR apps

Keep no-build core usage simple. If SSR or hydration is involved, preserve payload and boundary behavior.
<!-- arrow-js-skill:end -->

