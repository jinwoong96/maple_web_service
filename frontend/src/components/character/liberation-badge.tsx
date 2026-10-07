import { Star } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getLiberationInfo } from '@/lib/liberation'
import { cn } from '@/lib/utils'

interface LiberationBadgeProps {
  liberationQuestClear: string | null | undefined
}

export function LiberationBadge({ liberationQuestClear }: LiberationBadgeProps) {
  const info = getLiberationInfo(liberationQuestClear)
  if (!info) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex size-5 cursor-default items-center justify-center rounded-full text-white shadow-sm',
            info.gradientClassName,
          )}
        >
          <Star className="size-3" fill="currentColor" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{info.label}</TooltipContent>
    </Tooltip>
  )
}
