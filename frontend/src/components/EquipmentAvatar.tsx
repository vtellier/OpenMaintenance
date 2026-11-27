import { shownIcon } from '@/lib/equipmentForm'

export interface EquipmentAvatarProps {
  /** The equipment's icon; DEFAULT_ICON (🔧) shows when it has none. */
  icon?: string | null
  size?: 'sm' | 'lg'
}

/**
 * An equipment's icon emoji, wherever an equipment is referenced: the list
 * cards and the Dashboard.
 */
export function EquipmentAvatar({ icon, size = 'sm' }: EquipmentAvatarProps) {
  return (
    <span className={'equipment-avatar equipment-avatar--' + size}>
      <span className="equipment-avatar__emoji">{shownIcon(icon)}</span>
    </span>
  )
}
