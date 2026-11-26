/**
 * The page for a path with no route. Its text is the starter template's, kept
 * as it was until the maintainer rewords it (#184).
 *
 * Its root is the page's `<main>`, as on `pre-react`: `.not-found` sets its
 * own width, margins and padding, so it takes the place of `main.app-content`
 * in the shell (`AppShell`) rather than sitting inside it, whose padding
 * would push it off-centre on a phone.
 */
export function NotFound({ path }: { path: string }) {
  return (
    <main className="not-found">
      <p className="section__label">404</p>
      <h1>Nothing lives at {path}</h1>
      <p>
        Edit <code>src/App.ts</code> to add routes or wire this into a
        larger app.
      </p>
      <a className="btn btn--accent" href="/">Back home</a>
    </main>
  )
}
