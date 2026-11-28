import { useState } from 'react'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import 'emoji-picker-element'
import type { EmojiClickEvent } from 'emoji-picker-element/shared'
// Bundle the emoji data locally so the picker works fully offline (this app is
// self-hosted and may run with no internet, e.g. on a boat). `?url` makes Vite
// emit the JSON as a same-origin asset instead of relying on the default CDN.
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url'
import { DEFAULT_ICON, shownIcon } from '@/lib/equipmentForm'

// `<emoji-picker>` is a custom element, defined by the import above. React 19
// sets `data-source` as an attribute (it is no property of the element), and
// listens to its `emoji-click` event through `onemoji-click`: the event's
// name after `on`, dashes and case kept.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'emoji-picker': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-source'?: string
        'onemoji-click'?: (e: EmojiClickEvent) => void
      }
    }
  }
}

export interface IconPickerProps {
  /** The icon picked; the trigger shows `defaultIcon` when it is empty. */
  current: string
  onSelect: (icon: string) => void
  /**
   * 'button' (default): a labelled "Choose icon ▾" button, for forms.
   * 'avatar': the icon shown as a clickable avatar (the detail header).
   * 'menuitem': a plain "Change icon" item, for a menu (a group's section header).
   */
  variant?: 'button' | 'avatar' | 'menuitem'
  /** The icon Reset restores and the trigger shows when there is none: DEFAULT_ICON (🔧) unless given. */
  defaultIcon?: string
}

/**
 * A trigger showing the current icon; clicking it opens a full searchable
 * emoji picker (the `emoji-picker-element` web component) in a popover. There
 * is no text field: picking an emoji, or Reset, calls `onSelect` and closes
 * the popover, as does a click on the backdrop.
 */
export function IconPicker({ current, onSelect, variant = 'button', defaultIcon = DEFAULT_ICON }: IconPickerProps) {
  const [open, setOpen] = useState(false)

  function onEmojiClick(e: EmojiClickEvent) {
    const unicode = e.detail?.unicode
    if (unicode) onSelect(unicode)
    setOpen(false)
  }

  function onReset() {
    onSelect(defaultIcon)
    setOpen(false)
  }

  const onToggle = () => setOpen(o => !o)
  let trigger
  if (variant === 'menuitem') {
    trigger = <button type="button" className="menu__item" onClick={onToggle}>Change icon</button>
  } else if (variant === 'avatar') {
    trigger = (
      <button type="button" className="equipment-avatar equipment-avatar--lg icon-picker__avatar" title="Change icon" onClick={onToggle}>
        <span className="equipment-avatar__emoji">{shownIcon(current, defaultIcon)}</span>
      </button>
    )
  } else {
    trigger = (
      <button type="button" className="icon-picker__button" onClick={onToggle}>
        <span className="icon-picker__current">{shownIcon(current, defaultIcon)}</span>
        <span className="icon-picker__label">Choose icon</span>
        <span className="icon-picker__caret">▾</span>
      </button>
    )
  }

  return (
    <div className="icon-picker">
      {trigger}
      {open && (
        <>
          <div className="icon-picker__backdrop" onClick={() => setOpen(false)}></div>
          <div className="icon-picker__popover">
            <emoji-picker data-source={emojiDataUrl} onemoji-click={onEmojiClick}></emoji-picker>
            <button type="button" className="btn btn--small icon-picker__reset" onClick={onReset}>Reset to {defaultIcon}</button>
          </div>
        </>
      )}
    </div>
  )
}
