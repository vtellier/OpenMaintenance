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

## Agent instructions

### The README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

### When coding
- **Always check your code**: Every time you modify **frontend** or **backend** code, validate it still compiles. Run `npm run build` for the frontend and `go build` for the backend.

### Critical Reminders
- **Ask for Clarification**: When there is ambiguity, ask instead of guessing.
- **Remind about git**: Suggest the user to `git commit` when there's a lot of uncommitted modification.
- **Short answers**: Avoid giving too much information that has not been asked, focus on answering what has been explicitly asked.
- **Don't over-plan**: Offer plans that target only the given scope. If the scope isn't clear ask for more details.
