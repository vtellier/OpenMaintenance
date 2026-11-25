# 5. The web UI is plain React, replacing Arrow.js in one cutover

Date: 2026-11-25 · Issue #146

## Context

The web UI is built with Arrow.js. It has one maintainer, its last release (1.0.6) is from 1 April 2026, and it gets about 9,000 downloads a week. The project no longer trusts it to stay maintained. Its reactivity also has traps that agents keep falling into: a plain value inside a reactive slot keeps its first render. 8 of the 39 regression specs record a screen that did not update.

In the long run there will be three native clients: web, Android (Jetpack Compose) and iOS (SwiftUI), mostly written and kept in step by AI agents. The web framework has to:

- last;
- be what agents write most reliably;
- follow the same model as Compose and SwiftUI, where the view is a function of the state;
- build to static files that the Go binary embeds.

## Decision

The web UI is **plain React**. It is the most used UI framework (41.5% of developers in the Stack Overflow 2026 survey) and the one agents know best. Since February 2026 it has been governed by the React Foundation, under the Linux Foundation.

At runtime that means `react` and `react-dom`, written in TSX and built by Vite, and nothing else:

- **No router.** Pages stay full page loads.
- **No state library, no component kit, no meta-framework** (Next.js and the like). The Go binary keeps serving a static build.
- **Pages and components only render.** The rules live in `src/lib/` as plain functions with Vitest tests, as `interventionForm.ts` already does. The rules are what a screen shows, what a form requires and what a save sends.

Development adds two things:

- **A linter limited to React's hooks rules:** `eslint`, `typescript-eslint` and `eslint-plugin-react-hooks`, run as `pnpm lint` in CI.
- **StrictMode,** turned on.

**The switch is one cutover.** Arrow.js and React never sit side by side on `main`.

1. **First, on `main`, with Arrow.js still in place:**
   - The Playwright suite is made trustworthy:
     - stable over repeated runs;
     - failing on page errors;
     - free of selectors that depend on markup structure;
     - covering the screens it misses, including a mobile viewport;
     - run once against the production build.
   - The logic still inside the pages moves into `src/lib/`.
2. **Then, on one branch:**
   - The first commit removes Arrow.js. From then on only the pages already ported are routed, until every page is.
   - A reference binary built from the last commit before the removal runs locally, on its own port and database, so behaviour can be compared.
   - `frontend/tests/` and `style.css` are read-only on that branch. The CSS class names stay, because the stylesheet and the tests both rely on them.
3. **The branch merges as one squashed commit** once all of these hold:
   - the unchanged suite passes;
   - before and after screenshots of every screen match;
   - the app has been checked by hand on desktop, iPhone and Android.

## Alternatives considered

- **Preact.** React's API in about 4 kB, with React as a fallback. Rejected:
  - Few developers use it directly: 1.9% in the Stack Overflow 2026 survey, against 41.5% for React.
  - One maintainer wrote 422 of its last 475 commits.
  - React's weight (about 60 kB gzipped) is an acceptable price for a self-hosted app.
- **Vue.** Healthy, lighter than React, and the source of Arrow's `reactive()`. Rejected:
  - Its templates are further from Compose and SwiftUI than function components are.
  - Fewer developers use it (17.2%).
- **Lit.** The closest to Arrow's syntax, and governed by the OpenJS Foundation. Rejected:
  - Only 16 commits in six months.
  - Its Shadow DOM fights the global stylesheet.
  - Under 1% of developers use it.
- **Svelte.** Rejected: Svelte 5 changed its core model in 2024, and agents still mix the two syntaxes.
- **Solid.** Rejected: Solid 2.0 only came out on 17 November 2026, and one person writes most of it.
- **No framework: HTML, CSS and JavaScript only.** The most durable option, with no dependency at all. Rejected:
  - Every screen would have to keep itself in sync with the data by hand. That is the kind of bug this app already has most.
  - User text would not be escaped by default.
  - The project would end up writing its own framework, which no one else knows.
- **htmx with Go templates.** Rejected: the server would render the web pages, while Android and iOS use the JSON API.
- **Migrating page by page, with both frameworks side by side.** Rejected:
  - The repo would hold two UI models for as long as the migration lasts.
  - Every agent would have to know which model each page uses.
  - The hardened suite and the reference binary give the cutover the same safety net.

## Consequences

- In `doc/overview.md`, principle 1 changes from "no heavy framework" to React with as few dependencies as possible.
- No other frontend work happens while the branch is open. Open frontend branches land or are parked before it starts.
- A React skill replaces the Arrow.js skill. `CLAUDE.md` and `CONTRIBUTING.md` change with the cutover.
- Android and iOS need some of the rules that move into `src/lib/` too: urgency order, Dashboard grouping, and which interventions belong to an equipment. Moving those rules into the API is later, separate work.
- The end-to-end suite stays on Playwright. Moving it to a runner that also drives the native apps is later, separate work.

Figures as of 2026-11-24, from the npm registry, GitHub and the Stack Overflow Developer Survey 2026.
