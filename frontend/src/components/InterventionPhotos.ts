import { html, reactive } from '@arrow-js/core'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { extractErrorMessage } from '@/lib/format'
import { FileRow, toFileRow } from '@/lib/rows'

const interventionApi = new InterventionApi(apiConfig)

// InterventionPhotos manages the photo grid for a single, already-saved
// intervention: listing, uploading, deleting and a full-screen viewer. It owns
// its own reactive state so it can be dropped into any modal that has an
// intervention id. Create a fresh instance each time the form is opened.
//
// Photo changes are committed to the server immediately — independent of the
// surrounding form's Save/Cancel — so the UI labels the section as such and
// asks for confirmation before a (non-undoable) delete.
export function InterventionPhotos(interventionId: number) {
  const state = reactive({
    photos: [] as FileRow[],
    loaded: false,
    error: null as string | null,
    uploading: false,
    deletingName: null as string | null,
    confirmDelete: null as FileRow | null,
    viewing: null as FileRow | null,
  })

  async function load() {
    try {
      const files = await interventionApi.listInterventionFiles({ id: interventionId })
      state.photos = files.map(toFileRow)
      state.error = null
    } catch {
      state.error = 'Failed to load photos'
    } finally {
      state.loaded = true
    }
  }

  load()

  async function onUploadChange(e: Event) {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (!files || files.length === 0) return
    state.uploading = true
    state.error = null
    try {
      for (const file of Array.from(files)) {
        await interventionApi.uploadInterventionFile({ id: interventionId, file })
      }
      await load()
    } catch (err) {
      state.error = await extractErrorMessage(err, 'Failed to upload photo')
    } finally {
      state.uploading = false
      input.value = ''
    }
  }

  function onDeleteClick(f: FileRow) {
    state.confirmDelete = f
  }

  function onCancelDelete() {
    state.confirmDelete = null
  }

  function onConfirmOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelDelete()
  }

  async function onConfirmDelete() {
    const f = state.confirmDelete
    if (!f) return
    state.deletingName = f.name
    state.error = null
    try {
      await interventionApi.deleteInterventionFile({ id: interventionId, filename: f.name })
    } catch {
      state.error = 'Failed to delete photo'
      state.deletingName = null
      return
    }
    if (state.viewing?.name === f.name) state.viewing = null
    state.confirmDelete = null
    // Reset before the reload, never after it: each tile's Delete button
    // watches deletingName, and a tile the reload drops is torn down a tick
    // later. Changing deletingName in between queues that tile's watcher, which
    // then runs on a released slot and throws (#139, arrow-js gotcha 10).
    state.deletingName = null
    await load()
  }

  // A photo missing on the server has nothing to show full-screen (#122).
  function onView(f: FileRow) {
    if (f.missing) return
    state.viewing = f
  }

  function onCloseViewer() {
    state.viewing = null
  }

  function onViewerClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('photo-viewer')) onCloseViewer()
  }

  function render() {
    return html`
      <div class="photo-section">
        <div class="photo-section__header">
          <label class="form-field__label">Photos <span class="photo-section__note">saved immediately</span></label>
          <label class="btn btn--small btn--accent">
            ${() => state.uploading ? 'Uploading...' : '+ Add photo'}
            <input type="file" accept="image/*" multiple style="display: none" @change="${onUploadChange}" disabled="${() => state.uploading}" />
          </label>
        </div>
        ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}
        ${() => {
          if (!state.loaded) return html`<p class="photo-empty">Loading...</p>`
          const photos = state.photos
          if (photos.length === 0) return html`<p class="photo-empty">No photos yet.</p>`
          return html`<div class="photo-grid">
            ${() => photos.map(f => html`<div class="photo-thumb">
              ${() => f.missing
                ? html`<div class="photo-thumb__missing" title="${f.originalName}">Photo missing on server</div>`
                : html`<img class="photo-thumb__img" src="${f.url}" alt="${f.originalName}" @click="${() => onView(f)}" />`}
              <button class="photo-thumb__del" title="Delete photo" @click="${() => onDeleteClick(f)}" disabled="${() => state.deletingName === f.name}">×</button>
            </div>`)}
          </div>`
        }}
      </div>
      ${() => {
        const target = state.confirmDelete
        if (!target) return null
        const deleting = () => state.deletingName === target.name
        return html`<div class="modal-overlay photo-confirm" @click="${onConfirmOverlayClick}">
          <div class="modal modal--narrow">
            <h2 class="modal__title">Delete photo</h2>
            ${() => target.missing
              ? html`<div class="photo-confirm__preview photo-confirm__preview--missing">Photo missing on server</div>`
              : html`<img class="photo-confirm__preview" src="${target.url}" alt="${target.originalName}" />`}
            <p class="confirm-text">Delete this photo? This cannot be undone.</p>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelDelete}" disabled="${deleting}">Cancel</button>
              <button class="btn btn--danger" @click="${onConfirmDelete}" disabled="${deleting}">
                ${() => deleting() ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>`
      }}
      ${() => {
        const viewing = state.viewing
        if (!viewing) return null
        return html`<div class="photo-viewer" @click="${onViewerClick}">
          <img class="photo-viewer__img" src="${viewing.url}" alt="${viewing.originalName}" />
        </div>`
      }}
    `
  }

  return { render }
}
