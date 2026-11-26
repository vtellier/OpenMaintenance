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
 */
import { API } from './target'

async function wipeDb(): Promise<void> {
  const res = await fetch(`${API}/equipments`)
  if (!res.ok) {
    throw new Error(`Failed to list equipments: ${res.status} ${res.statusText}`)
  }
  const equipments = (await res.json()) as Array<{ id: number }>

  for (const eq of equipments) {
    const del = await fetch(`${API}/equipments/${eq.id}`, { method: 'DELETE' })
    if (!del.ok) {
      throw new Error(`Failed to delete equipment ${eq.id}: ${del.status}`)
    }
  }

  const groupsRes = await fetch(`${API}/groups`)
  if (!groupsRes.ok) {
    throw new Error(`Failed to list groups: ${groupsRes.status} ${groupsRes.statusText}`)
  }
  const groups = (await groupsRes.json()) as Array<{ id: number }>
  for (const g of groups) {
    const del = await fetch(`${API}/groups/${g.id}`, { method: 'DELETE' })
    if (!del.ok) {
      throw new Error(`Failed to delete group ${g.id}: ${del.status}`)
    }
  }
}

export default async function globalSetup(): Promise<void> {
  try {
    await wipeDb()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[global-setup] Could not wipe DB. Is the backend running on ${API}?\n  ${msg}`,
    )
  }
}
