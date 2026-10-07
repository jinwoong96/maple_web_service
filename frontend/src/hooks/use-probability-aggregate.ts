import { useCallback, useState } from 'react'

import { lookupItemLevels } from '@/lib/item-level-lookup'
import { type DateFetchFailure, fetchDateRangeHistory } from '@/lib/nexon-history-range'
import type {
  CubeHistory,
  CubeHistoryEntry,
  PotentialHistory,
  PotentialHistoryEntry,
  PotentialOptionEntry,
  StarforceHistory,
  StarforceHistoryEntry,
} from '@/lib/nexon-probability-types'
import {
  estimateCubeAppraisalCost,
  estimatePotentialEntryCost,
  getStarforceEntryCost,
  isScrollBasedStarforceEntry,
} from '@/lib/probability-cost-reference'
import {
  ADDITIONAL_POTENTIAL_GRADE_UP_RATES,
  isGradeUp,
  isKnownGrade,
  MAIN_POTENTIAL_GRADE_UP_RATES,
  matchCubeGradeUpTable,
  type PotentialGrade,
} from '@/lib/probability-theoretical-rates'

export interface CategoryStat {
  starforceAttempts: number
  potentialAttempts: number
  cubeAttempts: number
  estimatedMesoSpent: number
  /** 큐브 사용 시의 감정 비용 합계 — `estimatedMesoSpent`(스타포스 강화 +
   * 잠재능력 재설정)와는 별개로 합산한다 (사용자 요청, 2026-09-22). */
  cubeAppraisalCost: number
}

function emptyCategoryStat(): CategoryStat {
  return { starforceAttempts: 0, potentialAttempts: 0, cubeAttempts: 0, estimatedMesoSpent: 0, cubeAppraisalCost: 0 }
}

function addTo(
  map: Map<string, CategoryStat>,
  key: string | null,
  field: keyof CategoryStat,
  amount = 1,
): void {
  const resolvedKey = key ?? '알 수 없음'
  const stat = map.get(resolvedKey) ?? emptyCategoryStat()
  stat[field] += amount
  map.set(resolvedKey, stat)
}

export interface StarforceStarStat {
  star: number
  success: number
  fail: number
  destroy: number
}

/** Only "성공"/"실패"/"실패(유지)" have been seen live (2026-09-21) —
 * "파괴" itself is still unconfirmed, so this classifies by matching the
 * substring "파괴" rather than an exact known value, and treats anything
 * that isn't "성공" or destroy-labeled as a failure (a safe default —
 * every confirmed non-success value so far has been some flavor of
 * "실패"). */
function classifyStarforceResult(result: string): 'success' | 'fail' | 'destroy' {
  if (result.includes('파괴')) return 'destroy'
  if (result === '성공') return 'success'
  return 'fail'
}

export interface GradeUpRow {
  category: string
  grade: PotentialGrade
  attempts: number
  gradeUps: number
  /** `null` when no theoretical table covers this (category, grade) pair
   * — an event cube type `matchCubeGradeUpTable` couldn't match, or a
   * grade above what that cube/system can even produce. */
  theoreticalRate: number | null
}

function addGradeUpRow(
  rows: Map<string, GradeUpRow>,
  category: string,
  grade: PotentialGrade,
  gradeUp: boolean,
  theoreticalRate: number | null,
): void {
  const key = `${category}|${grade}`
  const row = rows.get(key) ?? { category, grade, attempts: 0, gradeUps: 0, theoreticalRate }
  row.attempts += 1
  if (gradeUp) row.gradeUps += 1
  rows.set(key, row)
}

const UNKNOWN_LABEL = '알 수 없음'

function groupKey(character: string | null, itemName: string | null): string {
  return `${character ?? UNKNOWN_LABEL}|${itemName ?? UNKNOWN_LABEL}`
}

function sortByDate<T>(entries: T[], getDate: (entry: T) => string | null): T[] {
  return [...entries].sort((a, b) => {
    const dateA = getDate(a)
    const dateB = getDate(b)
    return (dateA ? Date.parse(dateA) : 0) - (dateB ? Date.parse(dateB) : 0)
  })
}

export interface StarforceCard {
  character: string
  itemName: string
  itemIcon: string | null
  /** For "아이템 레벨순" sorting in the card grid — from the same
   * `item_level_reference` lookup `itemIcon` uses, so `null` for an item
   * not yet in that table (see `starforceItemsMissingLevel`). */
  itemLevel: number | null
  /** Sum of `getStarforceEntryCost` across this card's entries — scroll
   * attempts contribute 0, matching "메소가 소모되지 않으며". */
  totalCost: number
  startStar: number | null
  /** `null` when the item's last recorded attempt destroyed it — see
   * `destroyed`. */
  endStar: number | null
  destroyed: boolean
  /** Attempt/success/fail/destroy counts exclude scroll-based entries —
   * those are deterministic (100% success), not a probabilistic "시도", and
   * are counted separately via `scrollUsage`. */
  attempts: number
  success: number
  fail: number
  destroy: number
  /** The highest `before_starforce_count` this item was attempted at (its
   * current bottleneck stage), and the non-scroll success/fail/destroy
   * breakdown of attempts spent there (2026-09-22, per the user — a single
   * total count wasn't enough). */
  peakStar: number | null
  peakStarAttempts: number
  peakStarSuccess: number
  peakStarFail: number
  peakStarDestroy: number
  /** Scroll/ticket name → times used, for this (character, item) pair. */
  scrollUsage: Map<string, number>
}

export interface PotentialCubeCard {
  character: string
  itemName: string
  itemIcon: string | null
  /** For "아이템 레벨순" sorting — from the underlying entries'
   * `item_level` field (Nexon returns this directly on `history/potential`
   * and `history/cube` entries, unlike starforce). */
  itemLevel: number | null
  /** Sum of `estimatePotentialEntryCost` across this card's `history/
   * potential` entries — `history/cube` entries are never priced (same
   * convention as the 전체 tab, see `estimatePotentialEntryCost`'s doc
   * comment). */
  resetCost: number
  /** Sum of `estimateCubeAppraisalCost` across this card's `history/cube`
   * entries — kept separate from `resetCost` per the user (2026-09-22). */
  appraisalCost: number
  /** Cube type name → times used (`history/cube` entries only). */
  cubeUsage: Map<string, number>
  /** Grade (before the attempt) → attempt count, combining both `history/
   * potential` and `history/cube` entries for this item — kept separate
   * per the user (2026-09-22): 메인 잠재능력과 에디셔널 잠재능력은 서로
   * 다른 진행 상황이라 등급별 시도 횟수를 합치면 안 됨. */
  mainGradeAttempts: Map<string, number>
  additionalGradeAttempts: Map<string, number>
  /** The chronologically last entry's resulting option lines — "최종
   * 잠재능력". */
  finalMainOptions: PotentialOptionEntry[]
  finalAdditionalOptions: PotentialOptionEntry[]
}

export interface ProbabilityAggregateResult {
  byCharacter: Map<string, CategoryStat>
  byItem: Map<string, CategoryStat>
  total: CategoryStat
  /** `cube_type` values seen but never priced — `history/cube` entries are
   * never priced at all (see `estimatePotentialEntryCost`'s doc comment),
   * surfaced so the "합산 사용금액"이 실제로는 부분적이라는 걸 사용자가
   * 알 수 있도록. */
  unpricedCubeTypes: Set<string>
  /** `target_item` names from `history/starforce` with no row in our
   * backend's `item_level_reference` table yet (see
   * `backend/scripts/crawl_item_levels.py`) — those attempts are counted
   * but not priced. Empty doesn't mean "all priced correctly", just "we
   * had a level to plug into the formula for all of them". */
  starforceItemsMissingLevel: Set<string>
  /** Dates that failed to fetch (429 outlasting retries, a boundary date
   * past retention, etc.) across all 3 categories — a non-empty list means
   * the totals above are an undercount for those dates, not a true zero. */
  failures: DateFetchFailure[]
  /** Success/fail/destroy counts per current star (`before_starforce_count`),
   * for the "실제 대비 이론 확률" table — see
   * `lib/probability-theoretical-rates.ts`. */
  starforceByStar: Map<number, StarforceStarStat>
  /** Grade-up attempts/successes per (카테고리, 등급) — 잠재능력/에디셔널
   * 잠재능력/each matched 큐브 tier kept separate since each has its own
   * theoretical rate. */
  gradeUpRows: GradeUpRow[]
  /** Scroll/ticket name → times used, across every starforce entry (all
   * items/characters combined) — see `isScrollBasedStarforceEntry`. */
  scrollUsage: Map<string, number>
  /** Per-(character, item) card data for the 스타포스/잠재능력·큐브 모아보기
   * sub-tabs. */
  starforceCards: StarforceCard[]
  potentialCubeCards: PotentialCubeCard[]
}

export interface AggregateProgress {
  starforce: number
  potential: number
  cube: number
}

export type AggregateStatus = 'idle' | 'loading' | 'done' | 'error'

/** Fetches **every date** in `[endDate, startDate]` (not just what's been
 * manually paginated in the per-category tabs) so "아이템/캐릭터별 합산"
 * is a real total, not a partial one — a plain hook (not TanStack Query)
 * since we want live progress feedback across a long sequence of
 * concurrent requests, which a single `queryFn` call doesn't expose. See
 * "모아보기"/"날짜 구간 조회" in docs/planning/features/probability.md. */
export function useProbabilityAggregate() {
  const [status, setStatus] = useState<AggregateStatus>('idle')
  const [progress, setProgress] = useState<AggregateProgress>({ starforce: 0, potential: 0, cube: 0 })
  const [result, setResult] = useState<ProbabilityAggregateResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(async (apiKey: string, startDate: string, endDate: string) => {
    setStatus('loading')
    setError(null)
    setResult(null)
    setProgress({ starforce: 0, potential: 0, cube: 0 })

    try {
      const [starforceResult, potentialResult, cubeResult] = await Promise.all([
        fetchDateRangeHistory<StarforceHistory, StarforceHistoryEntry>(
          '/maplestory/v1/history/starforce',
          apiKey,
          startDate,
          endDate,
          (page) => page.starforce_history,
          (page) => page.next_cursor,
          (datesFetched, totalDates) =>
            setProgress((prev) => ({ ...prev, starforce: Math.round((datesFetched / totalDates) * 100) })),
        ),
        fetchDateRangeHistory<PotentialHistory, PotentialHistoryEntry>(
          '/maplestory/v1/history/potential',
          apiKey,
          startDate,
          endDate,
          (page) => page.potential_history,
          (page) => page.next_cursor,
          (datesFetched, totalDates) =>
            setProgress((prev) => ({ ...prev, potential: Math.round((datesFetched / totalDates) * 100) })),
        ),
        fetchDateRangeHistory<CubeHistory, CubeHistoryEntry>(
          '/maplestory/v1/history/cube',
          apiKey,
          startDate,
          endDate,
          (page) => page.cube_history,
          (page) => page.next_cursor,
          (datesFetched, totalDates) =>
            setProgress((prev) => ({ ...prev, cube: Math.round((datesFetched / totalDates) * 100) })),
        ),
      ])

      const starforceEntries = starforceResult.entries
      const potentialEntries = potentialResult.entries
      const cubeEntries = cubeResult.entries
      const failures = [...starforceResult.failures, ...potentialResult.failures, ...cubeResult.failures]

      const byCharacter = new Map<string, CategoryStat>()
      const byItem = new Map<string, CategoryStat>()
      const total = emptyCategoryStat()
      const unpricedCubeTypes = new Set<string>()
      const starforceItemsMissingLevel = new Set<string>()
      const starforceByStar = new Map<number, StarforceStarStat>()
      const gradeUpRowsMap = new Map<string, GradeUpRow>()
      const scrollUsage = new Map<string, number>()

      const allItemNames = [
        ...starforceEntries.map((entry) => entry.target_item),
        ...potentialEntries.map((entry) => entry.target_item),
        ...cubeEntries.map((entry) => entry.target_item),
      ].filter((name): name is string => name != null)
      const itemLevels = await lookupItemLevels(allItemNames)

      for (const entry of starforceEntries) {
        addTo(byCharacter, entry.character_name, 'starforceAttempts')
        addTo(byItem, entry.target_item, 'starforceAttempts')
        total.starforceAttempts += 1

        const itemLevel = entry.target_item ? (itemLevels.get(entry.target_item)?.level ?? null) : null
        const cost = getStarforceEntryCost(entry, itemLevel)
        if (cost != null) {
          addTo(byCharacter, entry.character_name, 'estimatedMesoSpent', cost)
          addTo(byItem, entry.target_item, 'estimatedMesoSpent', cost)
          total.estimatedMesoSpent += cost
        } else if (entry.target_item && itemLevel == null && !isScrollBasedStarforceEntry(entry)) {
          starforceItemsMissingLevel.add(entry.target_item)
        }

        if (isScrollBasedStarforceEntry(entry)) {
          const name = entry.upgrade_item ?? UNKNOWN_LABEL
          scrollUsage.set(name, (scrollUsage.get(name) ?? 0) + 1)
        } else if (entry.before_starforce_count != null) {
          const star = entry.before_starforce_count
          const stat = starforceByStar.get(star) ?? { star, success: 0, fail: 0, destroy: 0 }
          stat[classifyStarforceResult(entry.item_upgrade_result)] += 1
          starforceByStar.set(star, stat)
        }
      }

      const starforceCards: StarforceCard[] = []
      const starforceGroups = new Map<string, StarforceHistoryEntry[]>()
      for (const entry of starforceEntries) {
        const key = groupKey(entry.character_name, entry.target_item)
        const list = starforceGroups.get(key) ?? []
        list.push(entry)
        starforceGroups.set(key, list)
      }
      for (const groupEntries of starforceGroups.values()) {
        const sorted = sortByDate(groupEntries, (entry) => entry.date_create)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const itemName = first.target_item ?? UNKNOWN_LABEL
        const character = first.character_name ?? UNKNOWN_LABEL
        const itemIcon = first.target_item ? (itemLevels.get(first.target_item)?.icon ?? null) : null

        let cardCost = 0
        let attempts = 0
        let success = 0
        let fail = 0
        let destroyCount = 0
        const cardScrollUsage = new Map<string, number>()
        const attemptsByBeforeStar = new Map<
          number,
          { attempts: number; success: number; fail: number; destroy: number }
        >()

        for (const entry of sorted) {
          const itemLevel = entry.target_item ? (itemLevels.get(entry.target_item)?.level ?? null) : null
          const cost = getStarforceEntryCost(entry, itemLevel)
          if (cost != null) cardCost += cost

          if (isScrollBasedStarforceEntry(entry)) {
            const name = entry.upgrade_item ?? UNKNOWN_LABEL
            cardScrollUsage.set(name, (cardScrollUsage.get(name) ?? 0) + 1)
            continue
          }

          attempts += 1
          const outcome = classifyStarforceResult(entry.item_upgrade_result)
          if (outcome === 'success') success += 1
          else if (outcome === 'destroy') destroyCount += 1
          else fail += 1

          if (entry.before_starforce_count != null) {
            const star = entry.before_starforce_count
            const stat = attemptsByBeforeStar.get(star) ?? { attempts: 0, success: 0, fail: 0, destroy: 0 }
            stat.attempts += 1
            stat[outcome] += 1
            attemptsByBeforeStar.set(star, stat)
          }
        }

        const destroyed = classifyStarforceResult(last.item_upgrade_result) === 'destroy'
        let peakStar: number | null = null
        let peakStarStat = { attempts: 0, success: 0, fail: 0, destroy: 0 }
        for (const [star, stat] of attemptsByBeforeStar) {
          if (peakStar == null || star > peakStar) {
            peakStar = star
            peakStarStat = stat
          }
        }

        starforceCards.push({
          character,
          itemName,
          itemIcon,
          itemLevel: first.target_item ? (itemLevels.get(first.target_item)?.level ?? null) : null,
          totalCost: cardCost,
          startStar: first.before_starforce_count,
          endStar: destroyed ? null : (last.after_starforce_count ?? last.before_starforce_count),
          destroyed,
          attempts,
          success,
          fail,
          destroy: destroyCount,
          peakStar,
          peakStarAttempts: peakStarStat.attempts,
          peakStarSuccess: peakStarStat.success,
          peakStarFail: peakStarStat.fail,
          peakStarDestroy: peakStarStat.destroy,
          scrollUsage: cardScrollUsage,
        })
      }

      for (const entry of potentialEntries) {
        addTo(byCharacter, entry.character_name, 'potentialAttempts')
        addTo(byItem, entry.target_item, 'potentialAttempts')
        total.potentialAttempts += 1

        const cost = estimatePotentialEntryCost(entry)
        if (cost != null) {
          addTo(byCharacter, entry.character_name, 'estimatedMesoSpent', cost)
          addTo(byItem, entry.target_item, 'estimatedMesoSpent', cost)
          total.estimatedMesoSpent += cost
        }

        const isAdditional = entry.potential_type.includes('에디셔널')
        const grade = isAdditional ? entry.additional_potential_option_grade : entry.potential_option_grade
        if (isKnownGrade(grade)) {
          const afterOptions = isAdditional ? entry.after_additional_potential_option : entry.after_potential_option
          const category = isAdditional ? '에디셔널 잠재능력' : '잠재능력'
          const theoreticalRate =
            (isAdditional
              ? ADDITIONAL_POTENTIAL_GRADE_UP_RATES
              : MAIN_POTENTIAL_GRADE_UP_RATES)[grade] ?? null
          addGradeUpRow(gradeUpRowsMap, category, grade, isGradeUp(grade, afterOptions), theoreticalRate)
        }
      }

      for (const entry of cubeEntries) {
        addTo(byCharacter, entry.character_name, 'cubeAttempts')
        addTo(byItem, entry.target_item, 'cubeAttempts')
        total.cubeAttempts += 1
        unpricedCubeTypes.add(entry.cube_type)

        const appraisalCost = estimateCubeAppraisalCost(entry)
        if (appraisalCost != null) {
          addTo(byCharacter, entry.character_name, 'cubeAppraisalCost', appraisalCost)
          addTo(byItem, entry.target_item, 'cubeAppraisalCost', appraisalCost)
          total.cubeAppraisalCost += appraisalCost
        }

        const matchedTable = matchCubeGradeUpTable(entry.cube_type)
        if (matchedTable) {
          const isAdditional = entry.cube_type.includes('에디셔널')
          const grade = isAdditional ? entry.additional_potential_option_grade : entry.potential_option_grade
          if (isKnownGrade(grade)) {
            const afterOptions = isAdditional
              ? entry.after_additional_potential_option
              : entry.after_potential_option
            addGradeUpRow(
              gradeUpRowsMap,
              matchedTable.label,
              grade,
              isGradeUp(grade, afterOptions),
              matchedTable.rates[grade] ?? null,
            )
          }
        }
      }

      interface NormalizedPotentialEntry {
        character: string | null
        itemName: string | null
        dateCreate: string | null
        itemLevel: number | null
        isAdditional: boolean
        grade: string | null
        cost: number | null
        appraisalCost: number | null
        cubeType: string | null
        afterMain: PotentialOptionEntry[]
        afterAdditional: PotentialOptionEntry[]
      }

      const normalizedPotentialCube: NormalizedPotentialEntry[] = [
        ...potentialEntries.map((entry): NormalizedPotentialEntry => {
          const isAdditional = entry.potential_type.includes('에디셔널')
          return {
            character: entry.character_name,
            itemName: entry.target_item,
            dateCreate: entry.date_create,
            itemLevel: entry.item_level,
            isAdditional,
            grade: isAdditional ? entry.additional_potential_option_grade : entry.potential_option_grade,
            cost: estimatePotentialEntryCost(entry),
            appraisalCost: null,
            cubeType: null,
            afterMain: entry.after_potential_option,
            afterAdditional: entry.after_additional_potential_option,
          }
        }),
        ...cubeEntries.map((entry): NormalizedPotentialEntry => {
          const isAdditional = entry.cube_type.includes('에디셔널')
          return {
            character: entry.character_name,
            itemName: entry.target_item,
            dateCreate: entry.date_create,
            itemLevel: entry.item_level,
            isAdditional,
            grade: isAdditional ? entry.additional_potential_option_grade : entry.potential_option_grade,
            cost: null,
            appraisalCost: estimateCubeAppraisalCost(entry),
            cubeType: entry.cube_type,
            afterMain: entry.after_potential_option,
            afterAdditional: entry.after_additional_potential_option,
          }
        }),
      ]

      const potentialCubeGroups = new Map<string, NormalizedPotentialEntry[]>()
      for (const entry of normalizedPotentialCube) {
        const key = groupKey(entry.character, entry.itemName)
        const list = potentialCubeGroups.get(key) ?? []
        list.push(entry)
        potentialCubeGroups.set(key, list)
      }

      const potentialCubeCards: PotentialCubeCard[] = []
      for (const groupEntries of potentialCubeGroups.values()) {
        const sorted = sortByDate(groupEntries, (entry) => entry.dateCreate)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const itemName = first.itemName ?? UNKNOWN_LABEL
        const character = first.character ?? UNKNOWN_LABEL
        const itemIcon = first.itemName ? (itemLevels.get(first.itemName)?.icon ?? null) : null
        const itemLevel = sorted.find((entry) => entry.itemLevel != null)?.itemLevel ?? null

        let resetCost = 0
        let appraisalCost = 0
        const cubeUsage = new Map<string, number>()
        const mainGradeAttempts = new Map<string, number>()
        const additionalGradeAttempts = new Map<string, number>()

        for (const entry of sorted) {
          if (entry.cost != null) resetCost += entry.cost
          if (entry.appraisalCost != null) appraisalCost += entry.appraisalCost
          if (entry.cubeType != null) {
            cubeUsage.set(entry.cubeType, (cubeUsage.get(entry.cubeType) ?? 0) + 1)
          }
          const gradeKey = entry.grade ?? UNKNOWN_LABEL
          const target = entry.isAdditional ? additionalGradeAttempts : mainGradeAttempts
          target.set(gradeKey, (target.get(gradeKey) ?? 0) + 1)
        }

        potentialCubeCards.push({
          character,
          itemName,
          itemIcon,
          itemLevel,
          resetCost,
          appraisalCost,
          cubeUsage,
          mainGradeAttempts,
          additionalGradeAttempts,
          finalMainOptions: last.afterMain,
          finalAdditionalOptions: last.afterAdditional,
        })
      }

      setResult({
        byCharacter,
        byItem,
        total,
        unpricedCubeTypes,
        starforceItemsMissingLevel,
        failures,
        starforceByStar,
        gradeUpRows: Array.from(gradeUpRowsMap.values()),
        scrollUsage,
        starforceCards,
        potentialCubeCards,
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setStatus('error')
    }
  }, [])

  return { status, progress, result, error, run }
}
