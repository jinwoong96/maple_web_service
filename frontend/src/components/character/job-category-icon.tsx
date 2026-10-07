import { Anchor, Feather, Sparkles, Sword, Swords, Wand2, type LucideIcon } from 'lucide-react'

import { getJobCategory, type JobCategory } from '@/lib/job-category'
import { cn } from '@/lib/utils'

const ICON_BY_CATEGORY: Record<JobCategory, LucideIcon> = {
  warrior: Sword,
  magician: Wand2,
  bowman: Swords,
  thief: Feather,
  pirate: Anchor,
  other: Sparkles,
}

interface JobCategoryIconProps {
  className: string
  iconClassName?: string
}

/** A generic (non-illustration) icon standing in for a job's broad category —
 * see lib/job-category.ts for why this isn't the job's actual artwork. */
export function JobCategoryIcon({ className, iconClassName }: JobCategoryIconProps) {
  const category = getJobCategory(className)
  const Icon = ICON_BY_CATEGORY[category]
  return <Icon className={cn('size-4', iconClassName)} />
}
