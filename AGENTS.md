# OpenMaintenance Agent Guide

## Key Facts
- **Purpose**: Free, open-source web app for tracking maintenance tasks (boats, cars, homes, etc.).
- **Self hostable**: The project is meant to be easily self-hostable.
- **Minimalist**: This is and must stay  a very lightweight application. No fancy framework, just robust bare minimum technologies.

## Architecture
Two layers: a backend and a frontend.

### Backend
- **Source code**: located in the `backend/` folder
- **Stack**: Go + SQLite
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

## Agent instructions

### The README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

### When coding
- **Always check your code**: Every time you modify **frontend** or **backend** code, validate it still compiles. Run `npm run build` for the frontend and `go build` for the backend.

### Critical Reminders
- **Ask for Clarification**: Eveytime the user asks something, make sure you have a good understanding, ask instead of guessing but only when necessary.
- **Keep track of versioning**: Suggest the user to `git commit` instead of continuing modifying when there's already a lot of uncommitted modification.
- **Verify before saying**: Always check the information you read from the documentation is consistent with what's in the repository. And when not consistent you must warn about it.
