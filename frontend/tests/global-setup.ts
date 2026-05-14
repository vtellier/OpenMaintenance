/**
 * Global setup: wipes the backend DB before the test run.
 *
 * Strategy: list all equipments and delete each one. The backend cascades
 * the delete to tasks and interventions, so this fully empties user data
 * without touching the SQLite file or restarting the backend.
 */
const API = process.env.API_BASE_URL ?? 'http://localhost:3001/api'

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
