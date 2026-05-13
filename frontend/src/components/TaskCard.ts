import { component, html, reactive } from '@arrow-js/core'
import { Task } from '../../generated/api/models/Task'

export const TaskCard = component(() => {
  const state = reactive({
    tasks: [] as Task[],
    draft: {
      title: '',
      description: '',
      dueDate: '',
    },
  })

  function add() {
    const { title, description, dueDate } = state.draft
    if (!title.trim()) return

    state.tasks.push({
      id: state.tasks.length + 1,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate.trim(),
    })

    state.draft = { title: '', description: '', dueDate: '' }
  }

  function remove(id: number) {
    const i = state.tasks.findIndex((t) => t.id === id)
    if (i !== -1) state.tasks.splice(i, 1)
  }

  return html`<div class="card">
    <p class="section__label">Tasks</p>
    <div class="task-input">
      <input
        placeholder="Task title"
        .value="${() => state.draft.title}"
        @input="${(e: Event) => {
          state.draft.title = (e.target as HTMLInputElement).value
        }}"
      />
      <input
        placeholder="Task description"
        .value="${() => state.draft.description}"
        @input="${(e: Event) => {
          state.draft.description = (e.target as HTMLInputElement).value
        }}"
      />
      <input
        type="date"
        placeholder="Due date"
        .value="${() => state.draft.dueDate}"
        @input="${(e: Event) => {
          state.draft.dueDate = (e.target as HTMLInputElement).value
        }}"
      />
      <button class="btn btn--accent" @click="${add}">Add</button>
    </div>
    ${() =>
      state.tasks.length
        ? html`<ul class="task-list">
            ${() =>
              state.tasks.map(
                (task) =>
                  html`<li class="task-item">
                    <div>
                      <strong>${task.title}</strong>
                      <p>${task.description}</p>
                      <small>Due: ${task.dueDate}</small>
                    </div>
                    <button @click="${() => remove(task.id)}">&times;</button>
                  </li>`.key(task.id)
              )}
          </ul>`
        : html`<p class="task-empty">No tasks yet. Add one above.</p>`}
  </div>`
})