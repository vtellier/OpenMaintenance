---
name: react
description: Write or change OpenMaintenance frontend code in React (TSX pages, components, hooks), including porting a page from the pre-react Arrow.js code. Use for any frontend code change.
---

# React (frontend)

The web UI is plain React 19 in TSX, built by Vite ([ADR 0005](../../../doc/adr/0005-react-web-ui.md)). Nothing else at runtime: no router (every page is a full page load), no state library, no component kit.

Settings is the reference page (#157): `src/pages/SettingsPage.tsx`, `src/components/UpdateCheck.tsx`, `src/components/NavBar.tsx` and `src/App.tsx` show in working code the file layout, the routes and the shell, data loading, the loading states, the three lib call points and the event handlers. The sections Settings does not exercise (the `flash--error` path, [the shared reload](#a-reload-shared-by-the-effect-and-the-handlers), [Forms](#forms) and [Modals](#modals)) are first applied in 1.4 to 1.6.

## Quick workflow

1. Find the rules the screen needs in `src/lib/`. A rule that is missing goes there first, with its Vitest test (see [Pages only render](#pages-only-render)).
2. Read the screen's spec in `doc/gui/` and, for a port, its `pre-react` code (`git show pre-react:frontend/src/pages/<Page>.ts`).
3. Write the component as a function in a `.tsx` file. Re-read [Gotchas / Pitfalls](#gotchas--pitfalls) first.
4. Route a page in `src/page.tsx` (pathname → title and view).
5. Done when all of these pass from `frontend/`: `pnpm lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm test:unit`, and the Playwright specs that cover the screen (desktop and mobile projects, then `pnpm test:prod` once).

## Where things live

| Path | Holds |
|---|---|
| `src/entry-client.tsx` | Awaits `routeToPage(pathname)`, sets `document.title` and renders the `view` into `#app` under `<StrictMode>`; applies the theme |
| `src/page.tsx` | The route table: pathname → `{ title, description, view }` (see [Routes and the shell](#routes-and-the-shell)) |
| `src/App.tsx` | The shell: `App` (the navigation, then the page in `main.app-content`) and `AppShell` (the navigation only, for Not Found) |
| `src/pages/<Name>Page.tsx` | One component per screen |
| `src/components/<Name>.tsx` | One component per file: components several pages share (modals included), and the self-contained parts `pre-react` kept there (`NavBar`, `UpdateCheck`) |
| `src/hooks/use<Name>.ts` | A hook that two or more components share (none yet). A hook one component uses stays in that component's file |
| `src/lib/*.ts` | The rules, plain TypeScript with no React import, each with a `*.test.ts` |
| `src/theme.ts`, `src/api/config.ts` | Browser helpers that hold no rule: the theme in `localStorage` and on `<html>`, the API client's base path |
| `src/style.css` | The one global stylesheet |
| `generated/api/` | The API client generated from `backend/api/openapi.yaml` (never edit) |

A port keeps `pre-react`'s file name with `.tsx` (`pages/SettingsPage.ts` → `pages/SettingsPage.tsx`). A small piece that only one component renders stays in that component's file, as a module-level function or constant (`themeOptions` in `SettingsPage.tsx`).

## Routes and the shell

- Each route in `page.tsx` matches the pathname with `pre-react`'s test (same regex, same order), parses what it needs and passes it as plain typed props: `<EquipmentHoursPage equipmentId={Number(match[1])} />`. A page reads the query string itself, once, through the lib: `useState(() => prefilledReading(window.location.search))`.
- The view is the page inside the shell, `<App currentPath={pathname}><SettingsPage /></App>`; `NavBar` highlights the section from `currentPath` (`isActiveSection` in `lib/navigation.ts`).
- The title and the description are `pre-react`'s strings. `entry-client.tsx` sets `document.title` from the route before rendering; a page leaves the title alone (a `<title>` rendered by a component would sit next to `index.html`'s).
- A route whose title needs data keeps `pre-react`'s awaited GET in `routeToPage`, outside React: Equipment detail awaits `getEquipment` there for `"<name> | OpenMaintenance"` and its description, falling back to `Equipment #<id>` when it fails. The page still loads its own data in its effect.
- Not Found is the one page that brings its own `<main>`: `<AppShell currentPath={pathname}><NotFound path={pathname} /></AppShell>`. `main.not-found` sets its own width and padding, so inside the padded `main.app-content` it sat 16px off-centre on a phone (the 1.2 placeholder did).

## Components and props

- One named export per component, a function in PascalCase. Props are one typed object, destructured: `export function NotFound({ path }: { path: string })`. Name the type `<Name>Props` once it has more than two or three fields.
- API clients are module-level constants, as before: `const equipmentApi = new EquipmentApi(apiConfig)`.
- State lives in `useState`, and every change goes through its setter with a new value: `setForm(f => ({ ...f, newHours }))`, `setItems(items => items.filter(i => i.id !== id))`. A mutated object keeps its identity, so React does not re-render.
- Derive what can be derived during render (`const canSave = canUpdateHours(form)`), rather than storing it in a second state.
- Define every component at module level. A component defined inside another is a new type on each render, so React remounts it and the input loses focus and content.

## Pages only render

The rules are what a screen shows, what a form requires and what a save sends. They live in `src/lib/` as plain functions with Vitest tests (`rows`, `dashboard`, `interventions`, `equipmentCard`, `history`, `taskForm`, `equipmentForm`, `hoursForm`, `interventionForm`, `navigation`, `backups`, `updateCheck`, …). A page calls them and renders the result; it holds no `if` that decides a rule.

A page imports each function by name and calls the lib at three points:

- **Where the data arrives**, in the effect: it converts the answer once and stores the lib's result. A row goes through its `to…Row` in `lib/rows.ts`; a screen's own shape through its `…Of` function: `setBackups(backupSummaryOf(status))`, `setForm(hoursUpdateFormOf(toEquipmentRow(eq)))`.
- **During render**, for what depends on the state: `updateStatusLine(status)`, `canUpdateHours(form)`.
- **In a handler**, through the lib's flow function, which takes the API client and resolves to what to show: `saveHoursUpdate(form, id, api)` to `null` or the reason it failed, `checkForUpdates(systemApi)` to `{ status, message }`. The lib types the client as a narrow interface (`HoursUpdater`, `UpdateChecker`), so its test passes a fake.

Text the screen chooses between is a rule too, and comes from the lib: `retentionText(keep)` ("Unlimited", "1 backup", "7 backups"), `checkMessageOf(status)`. Fixed text stays in the TSX ("Settings", "Check for updates"). When a screen needs a rule that is not in `src/lib/` yet, add it there with its test first, then call it.

## Loading data

Fetch in an effect, never in the component body: the body runs on every render. In development, `<StrictMode>` mounts every component twice (mount, cleanup, mount), so every effect runs twice and its cleanup runs in between. The cleanup must undo what the effect started: abort the request, and ignore any result that arrives after the abort. With the generated client, the first run's request never reaches the network: `BaseAPI.request` awaits before it calls `fetch` (`generated/api/runtime.ts`), so the cleanup has already aborted the signal, and `fetch` is called with it aborted. The Network panel and `page.route` see one GET per endpoint in `pnpm dev`, as in the production build; `window.fetch` is called twice. The rule makes either case safe, so do not rely on the timing.

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
- Each request that loads on its own gets its own effect, in the component that shows its answer: Settings' backup GET in `SettingsPage`, the update-status GET in `UpdateCheck`. A request `pre-react` made at module level (Settings' backups) moves into that effect.
- A reload after a save is an async function the handler awaits, since what follows may need the fresh data; the page-load effect calls the same function with its signal. See [A reload shared by the effect and the handlers](#a-reload-shared-by-the-effect-and-the-handlers).
- A late answer that must not overwrite a newer one is guarded with a `useRef` flag, as `checkStarted` in `UpdateCheck` keeps the page-load update status from overwriting a manual check (#165): an async callback reads the state of the render that created it, so a state flag would be stale.

### Loading and error states

A screen renders, while it loads and when a load fails, what `pre-react` rendered in the same place. For most pages that is `<p className="page__empty">Loading...</p>` until loaded and the error in a `flash--error`, inside the page's `section.page`, after what shows from the start. Where `pre-react` chose between them in one reactive slot, compute that slot into a variable before the `return`:

```tsx
let content: ReactNode
if (!loaded) content = <p className="page__empty">Loading...</p>
else if (loadError) content = <div className="flash flash--error">{loadError}</div>
else content = <DueTaskList blocks={dueTaskBlocks(tasks)} />

return (
  <section className="page">
    <h1>Dashboard</h1>
    {content}
  </section>
)
```

- Keep `pre-react`'s state flags (`loaded`, `error`, `loadError`, `saving`) and its conditions in the same order, so the port reads like the old template. An error is `string | null`, `null` when there is none: `{error && <div className="flash flash--error">{error}</div>}`.
- A section that shows nothing until its data arrives holds the data as `T | null`, with no `loaded` flag: Settings → Backup (`BackupSummary | null`).
- Some loads fail quietly on `pre-react`, and stay quiet: Settings → Backup shows the lib's fallback (`unknownBackupSummary`), the update status line stays hidden.

### A reload shared by the effect and the handlers

A function declared in the component body is a new function on every render, so an effect that calls it must list it, and `exhaustive-deps` fails `pnpm lint` when it is missing. Wrap the reload in `useCallback` with the values it reads, and make the effect depend on `[reload]`:

```tsx
const reload = useCallback(async (signal?: AbortSignal) => {
  try {
    const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }, { signal }))
    if (signal?.aborted) return
    setForm(hoursUpdateFormOf(eq))
    setError(null)
  } catch {
    if (signal?.aborted) return
    setError('Failed to load equipment')
  }
  setLoaded(true)
}, [equipmentId])

useEffect(() => {
  const controller = new AbortController()
  reload(controller.signal)
  return () => controller.abort()
}, [reload])

async function onSave() {
  if (!form) return
  setSaving(true)
  const failure = await saveHoursUpdate(form, equipmentId, equipmentApi)
  if (failure === null) await reload()
  else setError(failure)
  setSaving(false)
}
```

- `reload` changes only when `equipmentId` changes, so the effect runs once per page load, and again (aborting the previous request) if the id changes.
- The effect passes its signal; a handler calls `reload()` with none, so its request is not cancelled by the effect's cleanup.
- Under `<StrictMode>` in `pnpm dev`, the effect runs, its cleanup aborts the first request, and it runs again. The generated client aborts that first request before it is sent, so the network shows one GET, as in the production build; if one were sent, the `signal?.aborted` checks would keep its result from any setter.
- List in `useCallback`'s array every prop or state value the function reads; setters are stable and need not be listed. `exhaustive-deps` checks that array too.

## Event handlers

A handler is a plain function declared in the component body and named `on<Action>` (`onCheck`, `onSave`), or a short inline arrow when it passes an argument: `onChange={() => chooseTheme(o.value)}`. The function such an arrow calls takes an argument and is named for what it does (`chooseTheme`), not `on…`. `useCallback` is only for a function an effect depends on (the shared reload above).

An async handler runs in this order, as `onCheck` in `UpdateCheck` does:

```tsx
async function onCheck() {
  if (checking) return
  checkStarted.current = true
  setChecking(true)
  setMessage(noCheckMessage)
  const result = await checkForUpdates(systemApi)
  if (result.status) setStatus(result.status)
  setMessage(result.message)
  setChecking(false)
}
```

1. Return at once while the last run is busy (the button is disabled too, as on `pre-react`).
2. Set the busy state and clear the last message or error.
3. `await` the lib's flow function; it catches the failure and resolves to what to show.
4. Set what it resolved to, then clear the busy state.

A change that also lives outside React is made in the handler that sets the state: `chooseTheme` sets `theme`, writes it to `localStorage` and applies it to `<html>` in one go, with no effect watching `theme`.

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
- Not Found has no reference to match (`pre-react` rendered a blank page there, #184): it keeps the markup of `pre-react`'s `NotFound.ts`, as the shell's content, without the starter's sentence about `src/App.ts` (dropped with the maintainer's approval) (see [Routes and the shell](#routes-and-the-shell)).

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

`<StrictMode>` runs each effect, its cleanup, then the effect again, in `pnpm dev` only. An effect without a cleanup adds two listeners, two timers or two requests (a bare `fetch` called synchronously in the effect does go out twice). Return a cleanup that undoes what the effect did (`removeEventListener`, `clearTimeout`, `controller.abort()`). A page-load GET through the generated client with `{ signal }` is the exception you will see: the first run's request is aborted before it is sent, so a spec that holds or answers "the first request" sees one request in development, as in the production build, and the abort shows only as a rejected promise, never on the network. Run `pnpm test:prod` as well: timing still differs between the two.

### 6. Code in the component body runs on every render

The old page factories ran once, so their bodies loaded data, started timers and focused elements. A component's body runs on every render (twice per render in development), so a fetch or a `setTimeout` there runs again and again. Side effects go in `useEffect` or in event handlers. The linter does not catch these.

### 7. A controlled field shows the state, not what was typed

Where a lib rule turns the text into a number (`hoursFromInput('')` is `0`), the field jumps to the parsed value as soon as it is cleared. Check in the reference app what the field shows while typing and clearing; when the two differ, keep the text as typed in state and parse it with the lib rule where the rule is applied.

### 8. `{count && …}` renders `0`

A number on the left of `&&` renders when it is `0`. Write a boolean: `{items.length > 0 && <List … />}`.

### 9. Lint warnings fail `pnpm lint`

`pnpm lint` runs three rules of `eslint-plugin-react-hooks`, `rules-of-hooks`, `exhaustive-deps` and `static-components`, all as errors and with `--max-warnings=0`, so any one fails CI. `static-components` catches a component defined inside another component, whose state resets on every render because each render makes it a new component; define it at module level and pass what it needs as props. The plugin's other rules, backed by the React Compiler, stay off (ADR 0005, checked in #157): `set-state-in-effect` rejects the shared reload. Fix the dependencies rather than silence the rule; when a rule must be turned off for one line, the `eslint-disable-next-line` comment gives the reason.

## References

- React docs: https://react.dev/learn ("Synchronizing with Effects", "You Might Not Need an Effect", "Keeping Components Pure")
- The hooks rules: https://react.dev/reference/eslint-plugin-react-hooks
- The Playwright skill, for the suite and its fixture: [`.agents/skills/non-regression-test/SKILL.md`](../non-regression-test/SKILL.md)
