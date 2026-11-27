import { formatHours } from '@/lib/format'
import { correctReadingHref } from '@/lib/readingDoubt'
import type { ReadingDoubt } from '@/lib/readingDoubt'

export interface ReadingDoubtModalProps {
  /** The doubt still standing once the change is saved (stillInDoubt). */
  doubt: ReadingDoubt
  /** Keep the reading: closes the modal, nothing changes. */
  onKeep: () => void
}

/**
 * Asks, after an intervention is deleted or edited, whether to keep the
 * equipment's reading it may have set (the default) or to correct it
 * (doc/gui/interventions.md, "Reading in doubt"). Keeping changes nothing;
 * a click on the overlay keeps it too. The page that asks holds the doubt,
 * and renders this only while there is one.
 */
export function ReadingDoubtModal({ doubt, onKeep }: ReadingDoubtModalProps) {
  function onCorrect() {
    window.location.href = correctReadingHref(doubt)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onKeep() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2 className="modal__title">Keep the hour-meter reading?</h2>
        <p className="confirm-text">This intervention recorded {formatHours(doubt.reading)}, the current reading of <strong>{doubt.equipmentName}</strong>. The reading may have come from it.</p>
        <div className="modal__actions">
          <button className="btn" onClick={onCorrect}>Correct the reading</button>
          {/* Keep is the default: focused when the modal opens. */}
          <button className="btn btn--accent reading-doubt__keep" onClick={onKeep} autoFocus>Keep the reading</button>
        </div>
      </div>
    </div>
  )
}
