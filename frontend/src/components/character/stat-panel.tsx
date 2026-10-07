import type { UseQueryResult } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import type { components } from '@/lib/api-types'
import { formatKoreanNumber } from '@/lib/korean-number'

type CharacterStat = components['schemas']['CharacterStat']
type StatDetail = components['schemas']['StatDetail']
type StatRow = { label: string; value: string }
type StatSection = { title: string; buildRows: (stats: Map<string, string>) => StatRow[] }

const CORE_STAT_NAMES = ['HP', 'MP', 'STR', 'DEX', 'INT', 'LUK']

// stat_name -> formatted display value. Grounded in a real final_stat
// response — see docs/planning/features/character.md's "Planned: 스탯 탭
// 개편" section for the field-by-field rationale.
const KOREAN_NUMBER_STAT_NAMES = new Set(['방어력', 'HP', 'MP', 'STR', 'DEX', 'INT', 'LUK'])
const PERCENT_STAT_NAMES = new Set([
  '데미지',
  '보스 몬스터 데미지',
  '최종 데미지',
  '방어율 무시',
  '크리티컬 확률',
  '크리티컬 데미지',
  '속성 내성 무시',
  '상태이상 추가 데미지',
  '무기 숙련도',
  '추가 경험치 획득',
  '아이템 드롭률',
  '메소 획득량',
  '버프 지속시간',
  '재사용 대기시간 미적용',
  '소환수 지속시간 증가',
  '스탠스',
])
// 공격 속도는 "단계" 단위(2026-09-16 확인). 상태이상 내성은 단위 없음(사용자
// 확인, 2026-09-20) — PERCENT_STAT_NAMES/STAGE_STAT_NAMES 어디에도 없이
// formatStatValue()의 기본 분기(숫자만)로 떨어지는 게 의도한 동작.
const STAGE_STAT_NAMES = new Set(['공격 속도'])

function formatStatValue(name: string, rawValue: string): string {
  const numeric = Number(rawValue)
  if (KOREAN_NUMBER_STAT_NAMES.has(name)) return formatKoreanNumber(numeric)
  if (PERCENT_STAT_NAMES.has(name)) return `${numeric.toLocaleString('ko-KR')}%`
  if (STAGE_STAT_NAMES.has(name)) return `${numeric.toLocaleString('ko-KR')}단계`
  return numeric.toLocaleString('ko-KR')
}

function pushStatRow(rows: StatRow[], stats: Map<string, string>, name: string): void {
  const rawValue = stats.get(name)
  if (rawValue == null) return
  rows.push({ label: name, value: formatStatValue(name, rawValue) })
}

const STAT_SECTIONS: StatSection[] = [
  {
    title: '성장 지표',
    buildRows: (stats) => {
      const rows: StatRow[] = []
      for (const name of ['스타포스', '아케인포스', '어센틱포스']) pushStatRow(rows, stats, name)
      return rows
    },
  },
  {
    title: '공격 지표',
    buildRows: (stats) => {
      const rows: StatRow[] = []
      pushStatRow(rows, stats, '공격력')
      pushStatRow(rows, stats, '마력')
      // 최소 스탯공격력은 최대 스탯공격력 × 무기 숙련도로 계산되는 값이라
      // "스탯공격력" 한 행으로 최대값만 보여준다.
      const maxAttack = stats.get('최대 스탯공격력')
      if (maxAttack != null) {
        rows.push({ label: '스탯공격력', value: formatKoreanNumber(Number(maxAttack)) })
      }
      for (const name of [
        '데미지',
        '보스 몬스터 데미지',
        '최종 데미지',
        '방어율 무시',
        '크리티컬 확률',
        '크리티컬 데미지',
        '속성 내성 무시',
        '상태이상 추가 데미지',
        '일반 몬스터 데미지',
      ]) {
        pushStatRow(rows, stats, name)
      }
      return rows
    },
  },
  {
    title: '방어/생존',
    buildRows: (stats) => {
      const rows: StatRow[] = []
      for (const name of ['방어력', '상태이상 내성', '스탠스']) pushStatRow(rows, stats, name)
      return rows
    },
  },
  {
    title: '유틸리티',
    buildRows: (stats) => {
      const rows: StatRow[] = []
      pushStatRow(rows, stats, '이동속도')
      pushStatRow(rows, stats, '점프력')
      pushStatRow(rows, stats, '버프 지속시간')
      pushStatRow(rows, stats, '공격 속도')
      // 재사용 대기시간 감소 (초)/(%) 두 필드를 한 행 "N초/M%"로 합친다.
      const seconds = stats.get('재사용 대기시간 감소 (초)')
      const percent = stats.get('재사용 대기시간 감소 (%)')
      if (seconds != null && percent != null) {
        rows.push({
          label: '재사용 대기시간 감소',
          value: `${Number(seconds).toLocaleString('ko-KR')}초/${Number(percent).toLocaleString('ko-KR')}%`,
        })
      }
      pushStatRow(rows, stats, '재사용 대기시간 미적용')
      pushStatRow(rows, stats, '소환수 지속시간 증가')
      pushStatRow(rows, stats, '무기 숙련도')
      return rows
    },
  },
  {
    title: '파밍',
    buildRows: (stats) => {
      const rows: StatRow[] = []
      for (const name of ['아이템 드롭률', '메소 획득량', '추가 경험치 획득']) {
        pushStatRow(rows, stats, name)
      }
      return rows
    },
  },
]

interface StatPanelProps {
  query: UseQueryResult<CharacterStat>
}

/** 최종 스탯 목록을 그린다.
 *
 * 조회와 떼어 놨다. 연무장 기록에도 **그때의 최종 스탯**이 통째로 들어 있어서
 * (`battle-practice/character-info`), 같은 그림을 두 군데서 쓴다. 단위 규칙
 * (`%`인지 `단계`인지 한글 수인지)이 한 벌만 있어야 둘이 안 어긋난다. */
export function FinalStatView({ finalStat }: { finalStat: StatDetail[] }) {
  const statsByName = new Map(finalStat.map((stat) => [stat.stat_name, stat.stat_value]))
  const combatPower = statsByName.get('전투력')
  const coreStats = finalStat.filter((stat) => CORE_STAT_NAMES.includes(stat.stat_name))

  return (
    <div className="flex flex-col gap-4 pt-4">
      {combatPower != null && (
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
          <p className="text-xs text-muted-foreground">전투력</p>
          <p className="text-2xl font-bold text-primary">
            {formatKoreanNumber(Number(combatPower))}
          </p>
        </div>
      )}

      {coreStats.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {coreStats.map((stat) => (
            <div key={stat.stat_name} className="rounded-md border p-2 text-center">
              <p className="text-xs text-muted-foreground">{stat.stat_name}</p>
              <p className="text-sm font-semibold">{formatKoreanNumber(Number(stat.stat_value))}</p>
            </div>
          ))}
        </div>
      )}

      {STAT_SECTIONS.map((section) => {
        const rows = section.buildRows(statsByName)
        if (rows.length === 0) return null

        return (
          <div key={section.title} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">{section.title}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StatPanel({ query }: StatPanelProps) {
  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <p className="pt-4 text-sm text-muted-foreground">스탯 정보를 불러오지 못했습니다.</p>
  }

  return <FinalStatView finalStat={query.data.final_stat ?? []} />
}
