/** 명단 변동 화면의 종류별 색과 숫자 표기. 컴포넌트 파일과 나눠 둔다(Fast Refresh가
 * 컴포넌트만 내보내는 파일을 기대한다). */

import type { HeadCount } from '@/lib/guild-roster-diff'

export type Tone = 'join' | 'leave' | 'alliance' | 'rename' | 'partial' | 'unknown'

/** 종류별 색. 밝은 화면·어두운 화면 둘 다 정한다. */
export const TONE: Record<Tone, { header: string; tile: string; accent: string; chip: string }> = {
  join: {
    header: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    tile: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    accent: 'text-emerald-700 dark:text-emerald-300',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  },
  leave: {
    header: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
    tile: 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30',
    accent: 'text-rose-700 dark:text-rose-300',
    chip: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  },
  alliance: {
    header: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    tile: 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30',
    accent: 'text-sky-700 dark:text-sky-300',
    chip: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
  },
  rename: {
    header: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
    tile: 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
    accent: 'text-violet-700 dark:text-violet-300',
    chip: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  },
  partial: {
    header: 'border-border bg-muted text-foreground',
    tile: 'border-border bg-muted/50',
    accent: 'text-foreground',
    chip: 'border-border bg-muted text-foreground',
  },
  unknown: {
    header: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    tile: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    accent: 'text-amber-700 dark:text-amber-300',
    chip: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  },
}

/** `3명 (5캐릭)`. 같은 그룹 캐릭터는 합쳐 1명이다. 사람과 캐릭터 수가 같으면 캐릭은 생략. */
export function headCount(count: HeadCount): string {
  return count.people === count.characters ? `${count.people}명` : `${count.people}명 (${count.characters}캐릭)`
}

