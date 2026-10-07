import { cn } from '@/lib/utils'

/** SSS/SS/S share a warm gold treatment, A/B/C a plain white one — matches
 * the in-game grouping (reference colors only, not a reproduction of the
 * badge artwork itself). */
const TOP_TIER_GRADES = new Set(['SSS', 'SS', 'S'])

interface ChampionGradeBadgeProps {
  grade: string
  className?: string
}

export function ChampionGradeBadge({ grade, className }: ChampionGradeBadgeProps) {
  const textColor = TOP_TIER_GRADES.has(grade) ? 'text-amber-300' : 'text-white'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold',
        textColor,
        className,
      )}
    >
      {grade}
    </span>
  )
}
