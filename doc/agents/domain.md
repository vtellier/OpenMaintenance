# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`doc/adr/`**: read ADRs that touch the area you're about to work in.
- **Product specs in `doc/`** (`overview.md`, `data-model.md`, `gui/`) are also domain docs; read the ones relevant to the topic.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

ADRs in this repo live in `doc/adr/`, not `docs/adr/`. This overrides the `docs/adr/` default in `/domain-modeling`.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── doc/
│   ├── adr/
│   │   ├── 0001-<slug>.md
│   │   └── 0002-<slug>.md
│   ├── gui/
│   ├── data-model.md
│   └── overview.md
├── backend/
└── frontend/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
