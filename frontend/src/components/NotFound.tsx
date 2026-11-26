/**
 * The page for a path with no route. Its text is the starter template's, kept
 * as it was until the maintainer rewords it (#184). It sits inside the app
 * shell's <main>, so its root is a <div> where `pre-react` had a <main>.
 */
export function NotFound({ path }: { path: string }) {
  return (
    <div className="not-found">
      <p className="section__label">404</p>
      <h1>Nothing lives at {path}</h1>
      <p>
        Edit <code>src/App.ts</code> to add routes or wire this into a
        larger app.
      </p>
      <a className="btn btn--accent" href="/">Back home</a>
    </div>
  )
}
