# OpenMaintenance Agent Guide

## Key Facts
- **Purpose**: Free, open-source web app for tracking maintenance tasks (boats, cars, homes, etc.).
- **Entry Point**: No obvious entry point (e.g., `index.html`, `main.py`, or `package.json`).
- **Build/Test/Lint Configs**: `frontend/package.json` and `backend/go.mod` detected.

## Workflow Notes
- **Directory Structure**: Contains `frontend` and `backend` folders.
- **No Existing Commands**: No scripts or CLI tools documented.
- **No CI/CD**: No `.github`, `.gitlab`, or other workflow configs.

## Instructions for the README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

## When coding
- **Always check your code**: Every time you modify **frontend** or **backend** code, validate it still compiles. Run `npm run build` for the frontend and `go build` for the backend.

## Critical Reminders
- **Verify Before Acting**: Always check for hidden configs or undocumented setup steps.
- **Ask for Clarification**: Eveytime the user asks something, make sure you have a good understanding, ask instead of guessing.
- **Keep track of versioning**: Suggest the user to `git commit` instead of continuing modifying when there's already a lot of uncommitted modification.
