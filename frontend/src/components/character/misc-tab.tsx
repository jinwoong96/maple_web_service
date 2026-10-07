import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useCharacterAbility,
  useCharacterDojang,
  useCharacterHyperStat,
  useCharacterOtherStat,
  useCharacterPropensity,
} from '@/hooks/use-character'
import type { components } from '@/lib/api-types'
import { formatKoreanNumber } from '@/lib/korean-number'
import { formatTimeRecord } from '@/lib/format-time'
import { getItemRarityColors } from '@/lib/item-rarity'

type CharacterHyperStat = components['schemas']['CharacterHyperStat']
type HyperStatPreset = components['schemas']['HyperStatPreset']
type AbilityInfo = components['schemas']['AbilityInfo']

const DOJANG_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T/

function formatDojangDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const match = DOJANG_DATE_PATTERN.exec(isoDate)
  if (!match) return null
  const [, year, month, day] = match
  return `${year}년 ${Number(month)}월 ${Number(day)}일`
}

function getActiveHyperStatPreset(data: CharacterHyperStat): {
  stats: HyperStatPreset[]
  remainPoint: number | null
} {
  switch (data.use_preset_no) {
    case '1':
      return {
        stats: data.hyper_stat_preset_1 ?? [],
        remainPoint: data.hyper_stat_preset_1_remain_point ?? null,
      }
    case '3':
      return {
        stats: data.hyper_stat_preset_3 ?? [],
        remainPoint: data.hyper_stat_preset_3_remain_point ?? null,
      }
    default:
      return {
        stats: data.hyper_stat_preset_2 ?? [],
        remainPoint: data.hyper_stat_preset_2_remain_point ?? null,
      }
  }
}

function AbilityRow({ ability }: { ability: AbilityInfo }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`shrink-0 text-xs font-medium ${getItemRarityColors(ability.ability_grade).text}`}>
        {ability.ability_grade}
      </span>
      <span>{ability.ability_value}</span>
    </li>
  )
}

function HyperStatSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterHyperStat(ocid)

  if (query.isLoading) return <Skeleton className="h-40 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">하이퍼스탯 정보를 불러오지 못했습니다.</p>
  }

  const { stats, remainPoint } = getActiveHyperStatPreset(query.data)
  const investedStats = stats.filter((stat) => stat.stat_point != null && stat.stat_point > 0)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        사용 중 프리셋 {query.data.use_preset_no}
        {remainPoint != null && ` · 잔여 포인트 ${remainPoint.toLocaleString('ko-KR')}`}
      </p>
      {investedStats.length === 0 ? (
        <p className="text-sm text-muted-foreground">투자한 하이퍼스탯이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {investedStats.map((stat) => (
            <div key={stat.stat_type} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
              <div>
                <p className="font-medium">{stat.stat_type}</p>
                {stat.stat_increase && <p className="text-xs text-muted-foreground">{stat.stat_increase}</p>}
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Lv.{stat.stat_level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbilitySection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterAbility(ocid)

  if (query.isLoading) return <Skeleton className="h-40 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">어빌리티 정보를 불러오지 못했습니다.</p>
  }

  const data = query.data
  const abilityInfo = data.ability_info ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${getItemRarityColors(data.ability_grade).text}`}>
          {data.ability_grade}
        </p>
        {data.remain_fame != null && (
          <p className="text-xs text-muted-foreground">
            잔여 명성치 <span className="font-medium text-foreground">{formatKoreanNumber(data.remain_fame)}</span>
          </p>
        )}
      </div>
      {abilityInfo.length === 0 ? (
        <p className="text-sm text-muted-foreground">어빌리티 정보가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 rounded-lg border p-3">
          {abilityInfo.map((ability) => (
            <AbilityRow key={ability.ability_no} ability={ability} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PropensitySection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterPropensity(ocid)

  if (query.isLoading) return <Skeleton className="h-32 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">성향 정보를 불러오지 못했습니다.</p>
  }

  const data = query.data
  const rows = [
    { label: '카리스마', value: data.charisma_level },
    { label: '감성', value: data.sensibility_level },
    { label: '통찰력', value: data.insight_level },
    { label: '의지', value: data.willingness_level },
    { label: '손재주', value: data.handicraft_level },
    { label: '매력', value: data.charm_level },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border p-2 text-center">
          <p className="text-xs text-muted-foreground">{row.label}</p>
          <p className="text-sm font-semibold">{row.value}</p>
        </div>
      ))}
    </div>
  )
}

function DojangSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterDojang(ocid)

  if (query.isLoading) return <Skeleton className="h-24 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">무릉도장 정보를 불러오지 못했습니다.</p>
  }

  const data = query.data
  const recordDate = formatDojangDate(data.date_dojang_record)

  return (
    <div className="rounded-lg border bg-muted/40 p-4 text-center">
      <p className="text-xs text-muted-foreground">최고 기록</p>
      <p className="text-2xl font-bold text-primary">{data.dojang_best_floor}층</p>
      <p className="text-sm text-muted-foreground">{formatTimeRecord(data.dojang_best_time)}</p>
      {recordDate && <p className="mt-1 text-xs text-muted-foreground">{recordDate} 달성</p>}
    </div>
  )
}

function OtherStatSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterOtherStat(ocid)

  if (query.isLoading) return <Skeleton className="h-24 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">기타 스탯 정보를 불러오지 못했습니다.</p>
  }

  const otherStats = query.data.other_stat ?? []

  if (otherStats.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 기타 스탯이 없습니다.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {otherStats.map((group, index) => (
        <div key={`${group.other_stat_type}-${index}`} className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium text-muted-foreground">{group.other_stat_type}</p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {(group.stat_info ?? []).map((stat, statIndex) => (
              <li key={statIndex} className="flex items-center justify-between gap-2">
                <span>{stat.stat_name}</span>
                <span className="font-medium">{stat.stat_value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

interface MiscTabProps {
  ocid: string | undefined
}

/** 스킬 탭/스탯 탭과는 다른 인게임 창(하이퍼스탯, 어빌리티, 성향, 무릉도장,
 * 기타 스탯)들을 모아둔 탭 — docs/planning/features/character.md의
 * "Not yet built" 항목. 각 서브탭이 자체 훅을 갖고 있어 Radix Tabs가
 * 비활성 패널을 언마운트하는 덕에 열린 서브탭만 실제로 호출된다(랭킹
 * 페이지와 동일 패턴). 하이퍼스탯/어빌리티는 프리셋 시스템이 있지만,
 * 유니온 탭과 동일한 이유로 현재 활성 프리셋만 보여주고 나머지는 제외 —
 * 어빌리티는 top-level ability_grade/ability_info가 이미 활성 프리셋과
 * 동일함을 실 데이터로 확인함(2026-09-21). */
export function MiscTab({ ocid }: MiscTabProps) {
  return (
    <div className="pt-4">
      <Tabs defaultValue="hyper-stat">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="hyper-stat">하이퍼스탯</TabsTrigger>
            <TabsTrigger value="ability">어빌리티</TabsTrigger>
            <TabsTrigger value="propensity">성향</TabsTrigger>
            <TabsTrigger value="dojang">무릉도장</TabsTrigger>
            <TabsTrigger value="other-stat">기타 스탯</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hyper-stat" className="pt-4">
          <HyperStatSection ocid={ocid} />
        </TabsContent>
        <TabsContent value="ability" className="pt-4">
          <AbilitySection ocid={ocid} />
        </TabsContent>
        <TabsContent value="propensity" className="pt-4">
          <PropensitySection ocid={ocid} />
        </TabsContent>
        <TabsContent value="dojang" className="pt-4">
          <DojangSection ocid={ocid} />
        </TabsContent>
        <TabsContent value="other-stat" className="pt-4">
          <OtherStatSection ocid={ocid} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
