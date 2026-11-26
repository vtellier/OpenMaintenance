---
name: react
description: Write or change OpenMaintenance frontend code in React (TSX pages, components, hooks), including porting a page from the pre-react Arrow.js code. Use for any change under frontend/src/ outside src/lib/.
---

# React (frontend)

The web UI is plain React 19 in TSX, built by Vite ([ADR 0005](../../../doc/adr/0005-react-web-ui.md)). Nothing else at runtime: no router (every page is a full page load), no state library, no component kit.

Conventions marked **(1.3)** are first drafts: sub-issue #157 reviews them on the Settings page, and this skill takes whatever that review settles.

## Quick workflow

1. Find the rules the screen needs in `src/lib/`. A rule that is missing goes there first, with its Vitest test (see [Pages only render](#pages-only-render)).
2. Read the screen's spec in `doc/gui/` and, for a port, its `pre-react` code (`git show pre-react:frontend/src/pages/<Page>.ts`).
3. Write the component as a function in a `.tsx` file. Re-read [Gotchas / Pitfalls](#gotchas--pitfalls) first.
4. Route a page in `src/page.tsx` (pathname → title and view).
5. Done when all of these pass from `frontend/`: `pnpm lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm test:unit`, and the Playwright specs that cover the screen (desktop and mobile projects, then `pnpm test:prod` once).

## Where things live

| Path | Holds |
|---|---|
| `src/entry-client.tsx` | Renders `routeToPage(pathname).view` into `#app` under `<StrictMode>`; applies the theme |
| `src/page.tsx` | The route table: pathname → `{ title, description, view }` |
| `src/App.tsx` | The shell around every page |
| `src/pages/<Name>Page.tsx` | One component per screen **(1.3)** |
| `src/components/<Name>.tsx` | Components shared by several pages, modals included **(1.3)** |
| `src/lib/*.ts` | The rules, plain TypeScript with no React import, each with a `*.test.ts` |
| `src/style.css` | The one global stylesheet |
| `generated/api/` | The API client generated from `backend/api/openapi.yaml` (never edit) |

## Components and props

- One named export per component, a function in PascalCase. Props are one typed object, destructured: `export function NotFound({ path }: { path: string })`. Name the type `<Name>Props` once it has more than two or three fields.
- `page.tsx` parses the URL and passes plain values: `<EquipmentHoursPage equipmentId={Number(match[1])} />` **(1.3)**.
- API clients are module-level constants, as before: `const equipmentApi = new EquipmentApi(apiConfig)`.
- State lives in `useState`, and every change goes through its setter with a new value: `setForm(f => ({ ...f, newHours }))`, `setItems(items => items.filter(i => i.id !== id))`. A mutated object keeps its identity, so React does not re-render.
- Derive what can be derived during render (`const canSave = canUpdateHours(form)`), rather than storing it in a second state.
- Define every component at module level. A component defined inside another is a new type on each render, so React remounts it and the input loses focus and content.

## Pages only render

The rules are what a screen shows, what a form requires and what a save sends. They live in `src/lib/` as plain functions with Vitest tests (`rows`, `dashboard`, `interventions`, `equipmentCard`, `history`, `taskForm`, `equipmentForm`, `hoursForm`, `interventionForm`, …). A page calls them and renders the result; it holds no `if` that decides a rule.

- A row from the API goes through its `to…Row` function in `lib/rows.ts` before the page reads it.
- A form opens with the lib's values (`hoursUpdateFormOf(eq)`, `newTaskForm()`), enables its button with the lib's check (`canUpdateHours(form)`), and saves through the lib (`saveHoursUpdate(form, id, api)`), which resolves to `null` or to the reason it failed.
- When a screen needs a rule that is not in `src/lib/` yet, add it there with its test first, then call it.

## Loading data

Fetch in an effect, never in the component body: the body runs on every render. In development, `<StrictMode>` mounts every component twice (mount, cleanup, mount), so every effect runs twice and its cleanup runs in between. The cleanup must undo what the effect started; a page-load GET therefore goes out twice in `pnpm dev`, and the first one is aborted.

```tsx
const [form, setForm] = useState<HoursUpdateValues | null>(null)
const [loaded, setLoaded] = useState(false)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  const controller = new AbortController()
  const { signal } = controller
  async function load() {
    try {
      const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }, { signal }))
      if (signal.aborted) return
      setForm(hoursUpdateFormOf(eq))
    } catch {
      if (signal.aborted) return
      setError('Failed to load equipment')
    }
    setLoaded(true)
  }
  load()
  return () => controller.abort()
}, [equipmentId])
```

- Every generated API method takes `RequestInit` as its second argument, so `{ signal }` cancels the request. An aborted request rejects (the client wraps it in a `FetchError`) and logs no console error.
- Check `signal.aborted` after every `await`, before any setter: a response that arrived just before the abort still resolves.
- Loading and error states keep `pre-react`'s markup: `<p className="page__empty">Loading...</p>` until loaded, `<div className="flash flash--error">{error}</div>` on failure **(1.3)**.
- A reload after a save is an async function the handler awaits, since what follows may need the fresh data; the page-load effect can call the same function with its signal **(1.3)**.
- A late answer that must not overwrite a newer one (the page-load update status against a manual check, #165) is guarded with a `useRef` flag: an async callback reads the state of the render that created it, so a state flag would be stale.

## Forms

Every field is controlled: `value` (or `checked`) from state, `onChange` back into it. React's `onChange` fires on every keystroke, like the native `input` event the old `@input` listened to.

```tsx
<input
  type="number"
  aria-label="New hours"
  min={String(form.currentHours)}
  value={String(form.newHours)}
  onChange={e => setForm({ ...form, newHours: hoursFromInput(e.target.value) })}
/>
<button className="btn btn--accent" onClick={onSubmit} disabled={saving || !canUpdateHours(form)}>
  {saving ? 'Saving...' : 'Update hours'}
</button>
```

- Keep the form's values in one state object shaped like the lib's form type, so the lib's `can…` and `save…` functions take it as it is.
- The save handler: set `saving`, clear the error, `await` the lib's `save…`, then on `null` navigate with `window.location.href = …` (full page load), otherwise show the reason and clear `saving`.
- A setter does not change the variable in the current render. Compute the next value into a local, use it, and pass it to the setter.
- `selectEquipment` in `lib/interventionForm.ts` changes the form it is given, as Arrow's reactive state expected. Call it on a copy, then set the copy: `const next = { ...form }; selectEquipment(next, id, ctx); setForm(next)`.

## Modals

A modal is rendered only while open: `{doubt && <ReadingDoubtModal doubt={doubt} onKeep={() => setDoubt(null)} />}`. Its state (open or not, and what it is about) belongs to the page that opens it.

- Markup as `pre-react` had it: `div.modal-overlay` > `div.modal` with `role="dialog"` and `aria-modal="true"`, a `h2.modal__title`, and `div.modal__actions`.
- A click on the overlay itself closes it: `onClick={e => { if (e.target === e.currentTarget) onClose() }}`.
- To focus a default button when it opens, use `autoFocus` on it.
- Where a modal's form state lives decides what reopening shows: state inside the modal component is dropped when it closes (it unmounts), state in the page stays. Match what `pre-react` shows when the modal opens again.

## The contract with `style.css` and the tests

The class names, the text, the accessible names (`aria-label`, label text, button text) and the roles are a contract: `src/style.css` styles them and the Playwright specs in `frontend/tests/` find elements by them. A change to one changes the others in the same commit.

During the port (#146, branch `feat/issue-146-react`), `frontend/tests/` and `src/style.css` are frozen, so a ported screen renders exactly what `pre-react` rendered: the same elements, classes, text and attributes, in the same order. When a spec seems to need a change, stop and report it.

- Read the rendered DOM, not only the old template: open the screen in the reference app and compare `document.querySelector('main').outerHTML` with the port's.
- `class` becomes `className`; a class computed in a template (`'tabbar__tab' + (active ? ' active' : '')`) stays computed the same way.

## Comparing with the reference app

The reference app is the `pre-react` binary, running on its own port and database (#155). On the maintainer's machine it lives in `~/om-reference/`, and its `README.md` there gives the scripts:

- `~/om-reference/start.sh` / `stop.sh`: start and stop it on http://127.0.0.1:3101.
- `~/om-reference/reset-and-seed.sh`: an empty database with the demo data.
- `node ~/om-reference/screenshots.mjs <base-url> <out-dir>`: every screen, desktop and mobile, light and dark.

Seed the branch's server the same day (`make seed`) so the relative dates match, open the same screen in both, and compare the DOM and the screenshots. Stop the reference app when you finish. If it is not there, build `pre-react` in a separate checkout with `make build` and run the binary with a `config.yaml` that sets another port and database.

## Gotchas / Pitfalls

### 1. React logs a warning as `console.error`, and the suite fails on it

`frontend/tests/fixtures.ts` fails any test that logs a page error or a `console.error`. In development React reports these through `console.error`:

- a list item without a `key`, or two with the same one;
- a controlled input with no `onChange` (use `readOnly`), a `value` of `null` (use `''`), or one that switches between `undefined` and a value;
- `selected` on an `<option>` (set `value` on the `<select>`);
- invalid nesting, such as a `<div>` inside a `<p>`, or an `<a>` inside an `<a>`.

Arrow built its DOM through `innerHTML`, so the browser silently repaired invalid nesting; React builds the DOM node by node and reports it. Check the DOM the reference app renders, and write that structure.

### 2. Keys are the row's id, never its index

A list keyed by index reuses a row by position: after a delete, the next item shows in the deleted row's DOM, with its old local state. Arrow had the same bug, found in #122's review: after a delete, a row kept the previous file's Download link. Key every row by its id: `{files.map(f => <FileRow key={f.id} file={f} />)}`.

### 3. JSX drops whitespace that holds a newline

JSX removes whitespace that contains a line break between an element and text, so `<strong>{name}</strong>` on one line followed by text on the next renders with no space between them. Arrow kept that whitespace, and the browser showed a space. Keep text that follows an element on the same line (`<input type="radio" … /> Auto`), or write `{' '}`. A lost space can fail a `toHaveText`, and it always shows in the screenshots compared at cutover.

### 4. `false` on an `aria-*` attribute renders `"false"`

Arrow removed an attribute whose value was `false`. React removes a boolean HTML attribute (`disabled={false}`), but writes any `aria-*` or `data-*` value as a string: `aria-busy={false}` renders `aria-busy="false"`. Write `aria-busy={checking ? 'true' : undefined}` where `pre-react` left the attribute out, and `aria-expanded={String(open)}` where it wrote `"false"`.

### 5. Every effect runs twice in development

`<StrictMode>` runs each effect, its cleanup, then the effect again, in `pnpm dev` only. An effect without a cleanup adds two listeners, two timers or two requests. Return a cleanup that undoes what the effect did (`removeEventListener`, `clearTimeout`, `controller.abort()`). A spec that holds or answers "the first request" sees two in development and one in the production build: run `pnpm test:prod` as well.

### 6. Code in the component body runs on every render

The old page factories ran once, so their bodies loaded data, started timers and focused elements. A component's body runs on every render (twice per render in development), so a fetch or a `setTimeout` there runs again and again. Side effects go in `useEffect` or in event handlers. The linter does not catch these.

### 7. A controlled field shows the state, not what was typed

Where a lib rule turns the text into a number (`hoursFromInput('')` is `0`), the field jumps to the parsed value as soon as it is cleared. Check in the reference app what the field shows while typing and clearing; when the two differ, keep the text as typed in state and parse it with the lib rule where the rule is applied.

### 8. `{count && …}` renders `0`

A number on the left of `&&` renders when it is `0`. Write a boolean: `{items.length > 0 && <List … />}`.

### 9. Lint warnings fail `pnpm lint`

`pnpm lint` runs two rules of `eslint-plugin-react-hooks`, `rules-of-hooks` and `exhaustive-deps`, both as errors and with `--max-warnings=0`, so either one fails CI. The plugin's other rules, backed by the React Compiler, are off (ADR 0005); 1.3's review decides whether any comes back. Fix the dependencies rather than silence the rule; when a rule must be turned off for one line, the `eslint-disable-next-line` comment gives the reason.

## References

- React docs: https://react.dev/learn ("Synchronizing with Effects", "You Might Not Need an Effect", "Keeping Components Pure")
- The hooks rules: https://react.dev/reference/eslint-plugin-react-hooks
- The Playwright skill, for the suite and its fixture: [`.agents/skills/non-regression-test/SKILL.md`](../non-regression-test/SKILL.md)
