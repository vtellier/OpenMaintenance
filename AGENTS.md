# OpenMaintenance Agent Guide

## Key Facts
- **Purpose**: Free, open-source web app for tracking maintenance tasks (boats, cars, homes, etc.).
- **Tech Stack**: Go (Fiber) backend, SQLite database, HTMX + Tailwind CSS frontend.
- **Entry Point**: No obvious entry point (e.g., `index.html`, `main.py`, or `package.json`).
- **No Build/Test/Lint Configs**: No `package.json`, `Makefile`, or other tooling configs detected.

## Workflow Notes
- **No Monorepo**: Single, flat directory structure.
- **No Existing Commands**: No scripts or CLI tools documented.
- **No CI/CD**: No `.github`, `.gitlab`, or other workflow configs.

## Instructions for the README.md
- **Always up to date**: Everytime you do something in the repository, update the README.md
- **Small as possible**: Only the necessary information to understand the project. Use short and straightforward sentences.
- **No code example**: unless in the instructions for installation, otherwise the reader will open the source code themselves

## Critical Reminders
- **Verify Before Acting**: Always check for hidden configs or undocumented setup steps.
- **Ask for Clarification**: Eveytime the user asks something, make sure you have a good understanding, ask instead of guessing.
- **Keep track of versioning**: Suggest the user to `git commit` instead of continuing modifying when there's already a lot of uncommitted modification.
