import { html, reactive } from '@arrow-js/core'
import { FileInfo } from '@generated/api/models/FileInfo'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'

const interventionApi = new InterventionApi(apiConfig)

// InterventionPhotos manages the photo grid for a single, already-saved
// intervention: listing, uploading, deleting and a full-screen viewer. It owns
// its own reactive state so it can be dropped into any modal that has an
// intervention id. Create a fresh instance each time the form is opened.
export function InterventionPhotos(interventionId: number) {
  const state = reactive({
    photos: [] as FileInfo[],
    loaded: false,
    error: null as string | null,
    uploading: false,
    deletingName: null as string | null,
    viewing: null as FileInfo | null,
  })

  async function load() {
    try {
      const files = await interventionApi.listInterventionFiles({ id: interventionId })
      state.photos = files.map((f: any) => ({
        ...f,
        uploadedAt: f.uploadedAt?.toISOString?.() ?? f.uploadedAt,
      }))
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
    } catch {
      state.error = 'Failed to upload photo'
    } finally {
      state.uploading = false
      input.value = ''
    }
  }

  async function onDelete(f: FileInfo) {
    state.deletingName = f.name
    state.error = null
    try {
      await interventionApi.deleteInterventionFile({ id: interventionId, filename: f.name })
      if (state.viewing?.name === f.name) state.viewing = null
      await load()
    } catch {
      state.error = 'Failed to delete photo'
    } finally {
      state.deletingName = null
    }
  }

  function onView(f: FileInfo) {
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
          <label class="form-field__label">Photos</label>
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
              <img class="photo-thumb__img" src="${f.url}" alt="${f.originalName}" @click="${() => onView(f)}" />
              <button class="photo-thumb__del" title="Delete photo" @click="${() => onDelete(f)}" disabled="${() => state.deletingName === f.name}">×</button>
            </div>`)}
          </div>`
        }}
      </div>
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
