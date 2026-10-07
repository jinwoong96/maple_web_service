import { JOBS_BY_CATEGORY, type JobCategory } from '@/lib/maple-jobs'

export type { JobCategory }

/** 직업 이름 → 계열. 명단은 `maple-jobs.ts`에 한 벌만 둔다 — 예전에는 여기에
 * 직접 적어 두었는데, OCR 열 판별에도 같은 명단이 필요해지면서 두 벌이
 * 어긋날 자리가 생겼다. 목록에 없는 이름은 추측하지 않고 `other`로 둔다. */
const JOB_CATEGORY_BY_NAME: Record<string, JobCategory> = Object.fromEntries(
  Object.entries(JOBS_BY_CATEGORY).flatMap(([category, names]) =>
    names.map((name) => [name, category as JobCategory]),
  ),
)

export function getJobCategory(className: string): JobCategory {
  return JOB_CATEGORY_BY_NAME[className] ?? 'other'
}

/** Background color per category — an original palette loosely inspired by
 * the general color mood of each category's reference icon (warrior=red,
 * magician=blue, bowman=green, thief=purple, pirate=warm gold), not a
 * reproduction of that artwork. Deliberately avoids the brand orange and the
 * item-rarity yellow/green/purple/blue already reserved elsewhere in the UI. */
const CATEGORY_BADGE_COLOR: Record<JobCategory, string> = {
  warrior: 'bg-red-600',
  magician: 'bg-blue-600',
  bowman: 'bg-emerald-600',
  thief: 'bg-fuchsia-600',
  pirate: 'bg-amber-800',
  other: 'bg-gray-500',
}

export function getJobCategoryColor(className: string): string {
  return CATEGORY_BADGE_COLOR[getJobCategory(className)]
}
