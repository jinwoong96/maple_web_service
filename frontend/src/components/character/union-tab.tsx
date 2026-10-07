import { ChampionGradeBadge } from '@/components/character/champion-grade-badge'
import { JobCategoryIcon } from '@/components/character/job-category-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { useUnionArtifact, useUnionChampion, useUnionInfo, useUnionRaider } from '@/hooks/use-union'
import type { components } from '@/lib/api-types'
import { getJobCategoryColor } from '@/lib/job-category'
import { cn } from '@/lib/utils'

type UnionChampion = components['schemas']['UnionChampion']

function ChampionRow({ champion }: { champion: UnionChampion }) {
  const badgeEffects = champion.champion_badge_info ?? []

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-white',
          getJobCategoryColor(champion.champion_class),
        )}
      >
        <JobCategoryIcon className={champion.champion_class} iconClassName="size-4" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <ChampionGradeBadge grade={champion.champion_grade} />
          <span className="text-sm font-medium">{champion.champion_name}</span>
          <span className="text-xs text-muted-foreground">{champion.champion_class}</span>
        </div>
        {badgeEffects.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {badgeEffects.map((effect, index) => (
              <li key={index}>{effect.stat}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface UnionTabProps {
  ocid: string | undefined
}

/** 유니온 레벨/아티팩트 요약은 이미 `CharacterInfoCard`의 상단 스트립에도
 * 나오지만(레벨 숫자 + 챔피언 뱃지), 아티팩트 효과/크리스탈과 레이더
 * (공격대원 효과/상태 스탯)는 어디에도 없었음 — 이 탭에서 전부 노출.
 * `union_block[]`(레이더 보드 배치)은 다섯별/고구마라떼 둘 다 항상 빈
 * 배열로 와서 — 공개 캐릭터 조회로는 안 내려오는 것으로 보임 — 렌더링
 * 안 함. `union_state_stat_preset[]`/`union_raider_preset_N` 같은
 * 프리셋 변형은 장비 탭의 아이템 프리셋과 같은 이유로 제외, 현재
 * 활성값(`use_preset_no`가 가리키는 값, top-level 필드와 일치 확인됨)만
 * 보여줌. */
export function UnionTab({ ocid }: UnionTabProps) {
  const infoQuery = useUnionInfo(ocid)
  const artifactQuery = useUnionArtifact(ocid)
  const raiderQuery = useUnionRaider(ocid)
  const championQuery = useUnionChampion(ocid)

  if (infoQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (infoQuery.isError || !infoQuery.data) {
    return <p className="pt-4 text-sm text-muted-foreground">유니온 정보를 불러오지 못했습니다.</p>
  }

  const info = infoQuery.data
  const artifactEffects = artifactQuery.data?.union_artifact_effect ?? []
  const artifactCrystals = artifactQuery.data?.union_artifact_crystal ?? []
  const raiderStats = raiderQuery.data?.union_raider_stat ?? []
  const stateStats = raiderQuery.data?.union_state_stat ?? []
  const occupiedStats = raiderQuery.data?.union_occupied_stat ?? []
  const champions = championQuery.data ?? []

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">유니온 등급</p>
            <p className="text-lg font-semibold">{info.union_grade}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">유니온 레벨</p>
            <p className="text-lg font-semibold">{info.union_level.toLocaleString('ko-KR')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-sm">
          <div>
            <p className="text-muted-foreground">아티팩트 레벨</p>
            <p className="font-semibold">{info.union_artifact_level}</p>
          </div>
          <div>
            <p className="text-muted-foreground">아티팩트 경험치</p>
            <p className="font-semibold">{info.union_artifact_exp.toLocaleString('ko-KR')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">아티팩트 포인트</p>
            <p className="font-semibold">{info.union_artifact_point.toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>

      {artifactEffects.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">아티팩트 효과</p>
          <ul className="flex flex-col gap-1 text-sm">
            {artifactEffects.map((effect, index) => (
              <li key={index} className="flex items-center justify-between gap-2">
                <span>{effect.name}</span>
                <span className="shrink-0 font-medium">Lv.{effect.level}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {artifactCrystals.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">아티팩트 크리스탈</p>
          <div className="flex flex-col gap-2">
            {artifactCrystals.map((crystal, index) => (
              <div key={index} className="flex flex-col gap-0.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{crystal.name}</span>
                  <span className="text-xs text-muted-foreground">Lv.{crystal.level}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    crystal.crystal_option_name_1,
                    crystal.crystal_option_name_2,
                    crystal.crystal_option_name_3,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(raiderStats.length > 0 || stateStats.length > 0 || occupiedStats.length > 0) && (
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">유니온 레이더</p>
            {raiderQuery.data?.union_max_point != null && (
              <p className="text-xs text-muted-foreground">
                최대 포인트 <span className="font-medium text-foreground">{raiderQuery.data.union_max_point}</span>
              </p>
            )}
          </div>
          {stateStats.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">상태 스탯</p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {stateStats.map((stat, index) => (
                  <li key={index}>{stat}</li>
                ))}
              </ul>
            </div>
          )}
          {occupiedStats.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">점령 스탯</p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {occupiedStats.map((stat, index) => (
                  <li key={index}>{stat}</li>
                ))}
              </ul>
            </div>
          )}
          {raiderStats.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                공격대원 효과 ({raiderStats.length})
              </p>
              <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                {raiderStats.map((stat, index) => (
                  <li key={index}>{stat}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {champions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">챔피언 ({champions.length})</p>
          <div className="flex flex-col gap-2">
            {champions.map((champion) => (
              <ChampionRow
                key={champion.champion_slot ?? champion.champion_name}
                champion={champion}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
