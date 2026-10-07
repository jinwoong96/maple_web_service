import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ExpBarProps {
  currentExp: number
  expRate: string
}

export function ExpBar({ currentExp, expRate }: ExpBarProps) {
  const ratePercent = Number.parseFloat(expRate)
  const clampedPercent = Number.isFinite(ratePercent) ? Math.min(Math.max(ratePercent, 0), 100) : 0
  const totalExpForLevel = ratePercent > 0 ? Math.round(currentExp / (ratePercent / 100)) : null

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-2 flex-1 cursor-default overflow-hidden rounded-full bg-black/85">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-700 via-lime-400 to-yellow-200"
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          EXP : {currentExp.toLocaleString('ko-KR')}
          {totalExpForLevel !== null && ` / ${totalExpForLevel.toLocaleString('ko-KR')}`} [{expRate}
          %]
        </TooltipContent>
      </Tooltip>
      <span className="shrink-0 text-xs text-muted-foreground">{expRate}%</span>
    </div>
  )
}
