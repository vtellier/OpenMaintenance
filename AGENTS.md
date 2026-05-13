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

## Product Specifications

**All features, data model, and GUI specifications are documented in the `doc/` folder.** Before coding any feature, review the relevant spec file:

- **Product vision & principles**: [`doc/overview.md`](./doc/overview.md)
- **Data model** (Equipment, Task, Intervention, hour-meter rules): [`doc/data-model.md`](./doc/data-model.md)
- **GUI specifications**:
  - [Navigation & app shell](./doc/gui/navigation.md)
  - [Dashboard (landing screen)](./doc/gui/dashboard.md)
  - [Equipments (list & detail)](./doc/gui/equipments.md)
  - [Tasks (maintenance program)](./doc/gui/tasks.md)
  - [Interventions (logging actions)](./doc/gui/interventions.md)
  - [History (global view)](./doc/gui/history.md)
  - [Settings](./doc/gui/settings.md)

**Key rule**: The OpenAPI spec is the single source of truth for the backend. The frontend GUI specs in `doc/gui/` define the target user experience. Keep both aligned.

## Agent instructions

### The README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

### Development Prerequisites
The following must be installed on the developer's machine for the agent to work correctly:

- **chrome-devtools-mcp** (global): Required for the Chrome DevTools MCP to work.
  ```bash
  npm install -g chrome-devtools-mcp
  ```

### When coding
- **Always check your code**: Every time you modify **frontend** or **backend** code, validate it still compiles. Run `npm run build` for the frontend and `go build` for the backend.
- **Use Context7 MCP**: To read the docs, especially the ones of Arrow.js.
- **Use Chrome-DevTool MCP**: To test the frontend
- **Test as you go**: use `curl` when modifying the backend or the API, use chrome-devtools when modifying the frontend.

### Critical Reminders
- **Ask questions**: When there is ambiguity, ask instead of guessing.
- **Remind about git**: Suggest the user to `git commit` when there's a lot of uncommitted modification.
- **Short answers**: Avoid giving too much information that has not been asked, focus on answering what has been explicitly asked.
- **Don't over-plan**: Offer plans that target only the given scope. If the scope isn't clear ask for more details.
- **Always run background tasks via pty plugin**: the plugin `opencode-pty` is the only way you have to run tasks in background, NEVER bypass it.
- **Figure out why a TCP port is busy**: when you try to run a server on a specific port and this port appears to already be in use, figure out what process uses it and offer to kill it instead of picking up another port.
- **Never run `pkill` blindly**: always check `ps aux | grep ...` first to confirm the process actually exists before attempting to kill it.
- **Don't delete files you didn't create**: if you see an untracked file you don't recognize, just leave it alone (don't commit it, don't delete it — it's not your place).
- **Don't /compact yourself**: When running out of context, do not compact automatically, ask the user for confirmation

### Session rituals
- **Session summary**: **Always** append a 1-10 lines session summary to STATUS.md before exiting the session. It shall include date and time.
- **Update ROADMAP.md**: After completing any work, update ROADMAP.md to reflect progress. Use `/update-roadmap` to run the dedicated update command, or manually check off completed items in the appropriate milestone.

See `.opencode/skills/arrow-js/SKILL.md` for Arrow.js guidance.

