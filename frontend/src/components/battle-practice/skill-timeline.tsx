/** 그 판에서 스킬을 **언제** 썼는지.
 *
 * 요약 화면의 "스킬별 데미지 비중"은 무엇이 많이 때렸는지를 말해주지만,
 * 순서와 간격은 말해주지 않는다. 딜 사이클을 되짚어 보려면 시간 축이 필요하다.
 *
 * 한 판이 수천 줄이라 넥슨이 쪽으로 잘라 준다. 몇 쪽인지는 응답이 알려주므로
 * 화면이 미리 알 필요가 없다.
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBattlePracticeSkillTimeline } from '@/hooks/use-battle-practice'

/** 경과 시간을 `분:초.밀리` 로. 딜 사이클은 초 단위로 갈리므로 밀리초까지
 * 보여야 "이 스킬 직후에 저걸 썼다"가 읽힌다. */
function formatElapsed(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const rest = milliseconds % 1000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(rest).padStart(3, '0')}`
}

export function SkillTimeline({ replayId }: { replayId: string }) {
  const [page, setPage] = useState(1)
  const query = useBattlePracticeSkillTimeline(replayId, page)

  if (query.isLoading) return <Skeleton className="h-64 w-full" />
  if (query.isError || !query.data) {
    return <p className="pt-4 text-sm text-muted-foreground">스킬 타임라인을 불러오지 못했습니다.</p>
  }

  const entries = query.data.skill_timeline ?? []
  const totalPages = query.data.total_page_no ?? 1

  if (entries.length === 0) {
    return <p className="pt-4 text-sm text-muted-foreground">기록된 스킬 사용이 없습니다.</p>
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
        {entries.map((entry, index) => (
          <li
            key={`${entry.elapse_time}-${entry.skill_name}-${index}`}
            className="flex items-center gap-3 px-3 py-1.5 text-sm"
          >
            <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
              {entry.elapse_time != null ? formatElapsed(entry.elapse_time) : '-'}
            </span>
            <span className="truncate">{entry.skill_name}</span>
            {/* 헥사 스킬은 따로 표시한다 — 사이클에서 차지하는 자리가 다르다. */}
            {entry.hexa_skill_specificity_flag === '1' && (
              <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                HEXA
              </span>
            )}
            {entry.sequence_name && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {entry.sequence_name}
              </span>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            이전
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
}
