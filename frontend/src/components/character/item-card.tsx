import { forwardRef } from 'react'
import { Gem, Sparkles, Star } from 'lucide-react'

import { getItemRarityColors } from '@/lib/item-rarity'
import { cn } from '@/lib/utils'

export function ItemCardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
}

interface ItemCardProps extends React.ComponentPropsWithoutRef<'button'> {
  iconUrl?: string | null
  name: string
  part: string
  /** `potential_option_grade` — colors the icon border. Cash items don't
   * carry one, so this and the three props below are all optional; when
   * none are set the badge row doesn't render at all. */
  grade?: string | null
  /** Omit (or 0) for items that can't be starforced — cash items, rings on
   * some responses — rather than showing a "0성" badge. */
  starforce?: number
  potentialGrade?: string | null
  additionalPotentialGrade?: string | null
  hasExceptional?: boolean
}

/** Equipment/cash item row — icon plus the fields a player checks before
 * opening the detail modal (starforce, 잠재능력/에디셔널 잠재능력 grade,
 * 익셉셔널), replacing the old bare-icon grid per user feedback: those were
 * only visible after clicking through. `forwardRef` + prop spreading for
 * the same reason as `EquipmentSlotButton` — this is a Radix `Dialog.
 * Trigger asChild` child. */
export const ItemCard = forwardRef<HTMLButtonElement, ItemCardProps>(function ItemCard(
  {
    iconUrl,
    name,
    part,
    grade,
    starforce,
    potentialGrade,
    additionalPotentialGrade,
    hasExceptional,
    className,
    ...props
  },
  ref,
) {
  const rarity = getItemRarityColors(grade)
  const showBadges = Boolean(starforce) || potentialGrade || additionalPotentialGrade || hasExceptional

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-accent',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 bg-muted/40',
          grade ? rarity.border : 'border-border',
        )}
      >
        {iconUrl && <img src={iconUrl} alt={name} className="h-9 w-9" />}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div>
          <p className="line-clamp-1 text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{part}</p>
        </div>
        {showBadges && (
          <div className="flex flex-wrap items-center gap-1.5">
            {Boolean(starforce) && (
              <span
                className="flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700"
                title={`스타포스 ${starforce}성`}
              >
                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                {starforce}
              </span>
            )}
            {potentialGrade && (
              <span title={`잠재능력: ${potentialGrade}`}>
                <Gem className={cn('h-3.5 w-3.5', getItemRarityColors(potentialGrade).text)} />
              </span>
            )}
            {additionalPotentialGrade && (
              <span title={`에디셔널 잠재능력: ${additionalPotentialGrade}`}>
                <Sparkles
                  className={cn('h-3.5 w-3.5', getItemRarityColors(additionalPotentialGrade).text)}
                />
              </span>
            )}
            {hasExceptional && (
              <span
                className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white"
                title="익셉셔널"
              >
                EX
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
})
