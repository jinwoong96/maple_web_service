/** 그 판을 찍을 때의 캐릭터 상태.
 *
 * 기록은 남고 캐릭터는 계속 바뀐다. 반년 전 기수의 점수를 보면서 지금 스탯을
 * 같이 놓으면 아무 말도 안 된다 — **그때의 스탯**이 있어야 "이 점수는 이
 * 세팅에서 나온 것"이 된다.
 *
 * 응답은 장비·펫·유니온까지 통째로 오지만 여기서는 **점수를 설명하는 것**만
 * 고른다. 최종 스탯, 하이퍼스탯, 어빌리티다. 장비 하나하나는 캐릭터 상세
 * 화면이 이미 잘 보여주고, 여기서 다시 그리면 화면만 길어진다.
 */

import { FinalStatView } from '@/components/character/stat-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useBattlePracticeCharacterInfo } from '@/hooks/use-battle-practice'

export function ReplayCharacterInfo({ replayId }: { replayId: string }) {
  const query = useBattlePracticeCharacterInfo(replayId)

  if (query.isLoading) return <Skeleton className="h-64 w-full" />
  if (query.isError || !query.data) {
    return <p className="pt-4 text-sm text-muted-foreground">캐릭터 정보를 불러오지 못했습니다.</p>
  }

  const basic = query.data.basic_object
  const finalStat = query.data.stat_object?.basic_stat_object?.final_stat ?? []
  const hyperStat = (query.data.hyper_stat_object?.hyper_stat ?? []).filter(
    (entry) => (entry.stat_level ?? 0) > 0,
  )
  const ability = query.data.ability_object?.ability_info ?? []

  return (
    <div className="flex flex-col gap-4 pt-4">
      {basic && (
        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          {basic.character_image && (
            <img
              src={basic.character_image}
              alt=""
              className="size-16 shrink-0 object-contain"
            />
          )}
          <div className="text-sm">
            <p className="font-semibold">{basic.character_name}</p>
            <p className="text-muted-foreground">
              Lv.{basic.character_level} · {basic.character_class}
              {basic.character_class_level && ` (${basic.character_class_level}차)`}
            </p>
          </div>
        </div>
      )}

      {finalStat.length > 0 && <FinalStatView finalStat={finalStat} />}

      {hyperStat.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">하이퍼스탯</p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {hyperStat.map((entry) => (
              <div key={entry.stat_type} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">
                  {entry.stat_type}
                  <span className="ml-1 text-xs">Lv.{entry.stat_level}</span>
                </dt>
                <dd className="truncate font-medium">{entry.stat_increase ?? '-'}</dd>
              </div>
            ))}
          </div>
        </div>
      )}

      {ability.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">어빌리티</p>
          <ul className="flex flex-col gap-1 text-sm">
            {ability.map((entry, index) => (
              <li key={`${entry.ability_value}-${index}`} className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.ability_grade}
                </span>
                <span>{entry.ability_value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
