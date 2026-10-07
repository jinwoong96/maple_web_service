import { ChampionGradeBadge } from '@/components/character/champion-grade-badge'
import { JobCategoryIcon } from '@/components/character/job-category-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { components } from '@/lib/api-types'
import { getJobCategoryColor } from '@/lib/job-category'
import { cn } from '@/lib/utils'

type UnionChampion = components['schemas']['UnionChampion']

interface UnionChampionBadgeProps {
  champion: UnionChampion
}

export function UnionChampionBadge({ champion }: UnionChampionBadgeProps) {
  const badgeEffects = champion.champion_badge_info ?? []

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'relative flex size-9 shrink-0 cursor-default items-center justify-center rounded-full text-white shadow-sm',
            getJobCategoryColor(champion.champion_class),
          )}
        >
          <JobCategoryIcon className={champion.champion_class} iconClassName="size-4" />
          <ChampionGradeBadge
            grade={champion.champion_grade}
            className="absolute -right-1 -bottom-1 ring-2 ring-background"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1 text-left">
          <div className="flex items-center gap-1.5">
            <ChampionGradeBadge grade={champion.champion_grade} />
            <span className="font-medium">{champion.champion_name}</span>
          </div>
          <p className="text-muted-foreground">{champion.champion_class}</p>
          {badgeEffects.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 border-t pt-1">
              {badgeEffects.map((effect) => (
                <li key={effect.stat}>{effect.stat}</li>
              ))}
            </ul>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
