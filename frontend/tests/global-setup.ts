/**
 * Global setup: wipes the backend DB before the test run.
 *
 * Strategy: list all equipments and delete each one. The backend cascades
 * the delete to tasks and interventions. Then delete every group, which an
 * equipment delete leaves in place. This fully empties user data without
 * touching the SQLite file or restarting the backend.
 *
 * The backend is the one `tests/target.ts` names: the dev backend by default,
 * the server at `OM_TEST_BASE_URL` when that is set.
 *
 * Guard: a server at `OM_TEST_BASE_URL` that already holds an equipment or a
 * group is not wiped unless `OM_TEST_ALLOW_WIPE=1` is set, so pointing the
 * suite at a seeded app cannot destroy its data by accident. The default dev run and `pnpm test:prod` (a fresh, empty database)
 * never hit it.
 */
import { API, EXTERNAL_SERVER } from './target'

async function list(what: 'equipments' | 'groups'): Promise<Array<{ id: number }>> {
  const res = await fetch(`${API}/${what}`)
  if (!res.ok) {
    throw new Error(`Failed to list ${what}: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Array<{ id: number }>
}

async function remove(what: 'equipments' | 'groups', ids: Array<{ id: number }>): Promise<void> {
  for (const { id } of ids) {
    const del = await fetch(`${API}/${what}/${id}`, { method: 'DELETE' })
    if (!del.ok) {
      throw new Error(`Failed to delete ${what} ${id}: ${del.status}`)
    }
  }
}

export default async function globalSetup(): Promise<void> {
  let equipments: Array<{ id: number }>
  let groups: Array<{ id: number }>
  try {
    equipments = await list('equipments')
    groups = await list('groups')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[global-setup] Could not wipe DB. Is the backend running on ${API}?\n  ${msg}`)
  }

  const holdsData = equipments.length > 0 || groups.length > 0
  if (EXTERNAL_SERVER && holdsData && process.env.OM_TEST_ALLOW_WIPE !== '1') {
    throw new Error(
      `[global-setup] Refusing to wipe ${API}: it holds ${equipments.length} equipment(s) and ` +
        `${groups.length} group(s), and the suite deletes them all.\n` +
        `  Point OM_TEST_BASE_URL at a server with an empty database, ` +
        `or set OM_TEST_ALLOW_WIPE=1 to wipe this one.`,
    )
  }

  try {
    // Equipments first: deleting one leaves its group in place.
    await remove('equipments', equipments)
    await remove('groups', groups)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[global-setup] Could not wipe DB. Is the backend running on ${API}?\n  ${msg}`)
  }
}
