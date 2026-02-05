/**
 * SettingsToggle
 *
 * Toggle switch row with label and optional description.
 * Designed for use inside SettingsCard.
 */

import * as React from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { settingsUI } from './SettingsUIConstants'
import { Spinner } from '@heroui/react'

export interface SettingsToggleProps {
  /** Toggle label */
  label: string
  /** Optional description below label */
  description?: string
  /** Current checked state */
  checked: boolean
  /** Change handler */
  onCheckedChange: (checked: boolean) => void
  /** Disabled state */
  disabled?: boolean
  /** Show spinner and disable while updating */
  loading?: boolean
  /** Additional className */
  className?: string
  /** Whether the toggle is inside a card (affects padding) */
  inCard?: boolean
}

/**
 * SettingsToggle - Toggle switch with label and description
 *
 * @example
 * <SettingsCard>
 *   <SettingsToggle
 *     label="Desktop notifications"
 *     description="Get notified when AI finishes working"
 *     checked={enabled}
 *     onCheckedChange={setEnabled}
 *   />
 * </SettingsCard>
 */
export function SettingsToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  loading,
  className,
  inCard = true,
}: SettingsToggleProps) {
  const id = React.useId()
  const isDisabled = disabled || loading

  return (
    <div
      className={cn(
        'flex items-center justify-between',
        inCard ? 'px-4 py-3.5' : 'py-3',
        isDisabled && 'opacity-50',
        className
      )}
    >
      <label htmlFor={id} className={cn('flex-1 min-w-0 select-none', !isDisabled && 'cursor-pointer')}>
        <div className={settingsUI.label}>{label}</div>
        {description && (
          <div className={cn(settingsUI.description, settingsUI.labelDescriptionGap)}>{description}</div>
        )}
      </label>
      <div className="ml-4 shrink-0 flex items-center gap-2">
        {loading && (
          <Spinner size="sm" color="default" className="shrink-0" />
        )}
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={isDisabled}
          className="shrink-0"
        />
      </div>
    </div>
  )
}
