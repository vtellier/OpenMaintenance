import { component, html, reactive } from '@arrow-js/core'
import { Task } from '@generated/api/models/Task'
import { Equipment } from '@generated/api/models/Equipment'
import { TaskApi, EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'

export const TaskCard = component(() => {
  const taskApi = new TaskApi(apiConfig)
  const equipmentApi = new EquipmentApi(apiConfig)

  const state = reactive({
    tasks: [] as Task[],
    equipments: [] as Equipment[],
    draft: {
      name: '',
      description: '',
      equipmentId: 0,
    },
    loading: false,
    error: null as string | null,
  })

  async function loadTasks() {
    state.loading = true
    state.error = null
    try {
      const tasks = await taskApi.tasksGet()
      state.tasks = tasks
    } catch (err) {
      state.error = 'Failed to load tasks'
      console.error('Error loading tasks:', err)
    } finally {
      state.loading = false
    }
  }

  async function loadEquipments() {
    try {
      const equipments = await equipmentApi.equipmentsGet()
      state.equipments = equipments
      if (equipments.length > 0) {
        state.draft.equipmentId = equipments[0].id!
      }
    } catch (err) {
      console.error('Error loading equipments:', err)
    }
  }

  loadTasks()
  loadEquipments()

  async function add() {
    const { name, equipmentId } = state.draft
    if (!name.trim() || equipmentId <= 0) return

    state.loading = true
    state.error = null
    try {
      const newTask: Task = {
        name: name.trim(),
        description: state.draft.description.trim(),
        equipmentId,
      }
      await taskApi.tasksPost({ task: newTask })
      await loadTasks()
    } catch (err) {
      state.error = 'Failed to add task'
      console.error('Error adding task:', err)
    } finally {
      state.loading = false
    }

    state.draft = { name: '', description: '', equipmentId: state.draft.equipmentId }
  }

  async function remove(id: number) {
    state.loading = true
    state.error = null
    try {
      await taskApi.tasksIdDelete({ id })
      await loadTasks()
    } catch (err) {
      state.error = 'Failed to remove task'
      console.error('Error removing task:', err)
    } finally {
      state.loading = false
    }
  }

  return html`<div class="card">
    <p class="section__label">Tasks</p>
    ${() => state.loading ? html`<p class="loading">Loading tasks...</p>` : null}
    ${() => state.error ? html`<p class="error">${state.error}</p>` : null}
    <div class="task-input">
      <select
        .value="${() => String(state.draft.equipmentId)}"
        @change="${(e: Event) => {
          state.draft.equipmentId = parseInt((e.target as HTMLSelectElement).value)
        }}"
      >
        ${() => state.equipments.map(eq =>
          html`<option value="${eq.id}">${eq.name}</option>`
        )}
      </select>
      <input
        placeholder="Task name"
        .value="${() => state.draft.name}"
        @input="${(e: Event) => {
          state.draft.name = (e.target as HTMLInputElement).value
        }}"
      />
      <input
        placeholder="Task description"
        .value="${() => state.draft.description}"
        @input="${(e: Event) => {
          state.draft.description = (e.target as HTMLInputElement).value
        }}"
      />
      <button class="btn btn--accent" @click="${add}" disabled="${() => state.loading || !state.draft.name.trim() || state.draft.equipmentId <= 0}">Add</button>
    </div>
    ${() =>
      state.tasks.length
        ? html`<ul class="task-list">
            ${() =>
              state.tasks.map(
                (task) =>
                  html`<li class="task-item">
                    <div>
                      <strong>${task.name}</strong>
                      <p>${task.description}</p>
                      <small>Equipment #${task.equipmentId}</small>
                    </div>
                    <button @click="${() => remove(task.id!)}" disabled="${() => state.loading}">&times;</button>
                  </li>`.key(task.id!)
              )}
          </ul>`
        : html`<p class="task-empty">No tasks yet. Add one above.</p>`}
  </div>`
})
