import { forwardRef } from 'react'

import { getItemRarityColors } from '@/lib/item-rarity'
import { cn } from '@/lib/utils'

interface EquipmentSlotIconProps {
  iconUrl?: string | null
  label: string
  /** `potential_option_grade` — omit for cash items, which don't carry one. */
  grade?: string | null
  /** Shown only when > 0 — rings/accessories report `"0"` because they
   * can't be starforced at all, not because they're at 0 stars. */
  starforce?: number
}

export function EquipmentSlotIcon({ iconUrl, label, grade, starforce }: EquipmentSlotIconProps) {
  const rarity = getItemRarityColors(grade)

  return (
    <div
      className={cn(
        'relative flex h-[84px] w-[84px] items-center justify-center rounded-lg border-2 bg-muted/40',
        grade ? rarity.border : 'border-border',
      )}
    >
      {iconUrl && <img src={iconUrl} alt={label} className="h-11 w-11" />}
      {Boolean(starforce) && (
        <span className="absolute -right-1.5 -bottom-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {starforce}
        </span>
      )}
    </div>
  )
}

export function EquipmentSlotGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">{children}</div>
}

interface EquipmentSlotButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  label: string
  /** Extra line under the label — e.g. `Lv.30` for skills. Equipment/cash
   * callers don't pass this. */
  sublabel?: string
}

/** `forwardRef` + prop spreading is required here, not optional — this is
 * used as a Radix `Dialog.Trigger asChild` child (`equipment-tooltip.tsx`,
 * `skill-tab.tsx`), and `asChild` clones its child with `onClick`/`ref`/
 * `aria-*` props. A component that doesn't forward them silently drops the
 * click handler — the button renders but never opens the dialog. */
export const EquipmentSlotButton = forwardRef<HTMLButtonElement, EquipmentSlotButtonProps>(
  function EquipmentSlotButton({ label, sublabel, children, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn('flex cursor-pointer flex-col items-center gap-1', className)}
        {...props}
      >
        {children}
        <span className="line-clamp-1 w-[84px] text-center text-[10px] text-muted-foreground">
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] font-medium text-foreground">{sublabel}</span>
        )}
      </button>
    )
  },
)
