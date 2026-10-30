import { html, reactive } from '@arrow-js/core'
import { formatHours } from '@/lib/format'
import { ReadingDoubt, correctReadingHref } from '@/lib/readingDoubt'

/**
 * Asks, after an intervention is deleted or edited, whether to keep the
 * equipment's reading it may have set (the default) or to correct it
 * (doc/gui/interventions.md, "Reading in doubt"). Keeping changes nothing.
 */
export function ReadingDoubtModal(doubt: ReadingDoubt, onKeep: () => void) {
  const reading = formatHours(doubt.reading)
  const correctHref = correctReadingHref(doubt)

  function onCorrect() {
    window.location.href = correctHref
  }

  function onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) onKeep()
  }

  // Keep is the default: focus it once the modal is in the page.
  setTimeout(() => {
    document.querySelector<HTMLButtonElement>('.reading-doubt__keep')?.focus()
  }, 0)

  return html`
    <div class="modal-overlay" @click="${onOverlayClick}">
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal__title">Keep the hour-meter reading?</h2>
        <p class="confirm-text">This intervention recorded ${reading}, the current reading of <strong>${doubt.equipmentName}</strong>. The reading may have come from it.</p>
        <div class="modal__actions">
          <button class="btn" @click="${onCorrect}">Correct the reading</button>
          <button class="btn btn--accent reading-doubt__keep" @click="${onKeep}">Keep the reading</button>
        </div>
      </div>
    </div>
  `
}

/**
 * The question about the reading, as a page uses it: ask() opens it for a
 * doubt (nothing when null), view() renders it while open. The modal is
 * built when asked, outside any reactive expression, like the forms.
 */
export function readingQuestion() {
  const state = reactive({ open: false })
  let modal: ReturnType<typeof ReadingDoubtModal> | null = null

  function ask(doubt: ReadingDoubt | null) {
    if (doubt == null) return
    modal = ReadingDoubtModal(doubt, () => { state.open = false })
    state.open = true
  }

  return { ask, view: () => state.open ? modal : null }
}
