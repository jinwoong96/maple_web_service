/** ② 길드원 성장 추적 — 두 시점의 `character/basic`을 비교한다.
 *
 * `character_exp`는 **현재 레벨 안에서의 경험치**라, 레벨이 달라지면 단순
 * 뺄셈으로 성장량을 낼 수 없다. 그래서 레벨별 요구 경험치 테이블로 누적
 * 경험치를 만들어 빼는데, 그 테이블이 `exp-table.generated.ts`다.
 *
 * 값이 조 단위까지 가서 `number`로는 정밀도가 깨진다(299레벨 요구치만
 * 1,737,759,854,037,637로 `Number.MAX_SAFE_INTEGER`를 넘는다). 전부 `bigint`로
 * 다룬다.
 */

import { EXP_TABLE_PATCH_DATE, REQUIRED_EXP } from '@/lib/exp-table.generated'

export { EXP_TABLE_PATCH_DATE }

export const MAX_LEVEL = 300

/** `CUMULATIVE_EXP[level - 1]` = 1레벨부터 그 레벨에 도달하기까지 쌓은 총
 * 경험치. 한 번만 만들어 재사용한다. */
const CUMULATIVE_EXP: bigint[] = (() => {
  const totals: bigint[] = [0n]
  for (let level = 1; level < REQUIRED_EXP.length; level++) {
    totals.push(totals[level - 1] + REQUIRED_EXP[level - 1])
  }
  return totals
})()

export interface CharacterSnapshot {
  characterName: string
  level: number
  /** 현재 레벨 안에서의 경험치. */
  exp: bigint
  /** 현재 레벨 안에서의 진행률(%). 만렙은 0이다. */
  expRate: number
}

/** 1레벨부터 지금까지 쌓은 총 경험치. */
export function cumulativeExp(snapshot: CharacterSnapshot): bigint {
  const level = Math.min(Math.max(snapshot.level, 1), MAX_LEVEL)
  return CUMULATIVE_EXP[level - 1] + snapshot.exp
}

/** 누적 경험치를 소수 레벨로 되돌린다.
 *
 * **`expRate`를 쓰지 않는 게 핵심이다.** `exp`와 `expRate`가 서로 다른 기준일
 * 때가 있다 — 경험치 패치 뒤 넥슨이 캐릭터별로 뒤늦게 재계산하는데, 실측에서
 * `달토끼`는 **`exp`는 그대로인 채 `expRate`만 17.71% → 41.997%로** 바뀌었다.
 * 그 구간을 비교하면 경험치 성장은 0인데 레벨 환산만 +24레벨치가 찍혀 서로
 * 모순된 화면이 나온다.
 *
 * 그래서 레벨 환산도 **누적 경험치에서** 뽑는다. 두 값이 같은 출처라 절대
 * 어긋나지 않는다. */
export function fractionalLevelFromCumulative(total: bigint): number {
  if (total <= 0n) return 1
  // 누적값이 어느 레벨 구간에 있는지 찾는다(이분 탐색).
  let low = 0
  let high = CUMULATIVE_EXP.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (CUMULATIVE_EXP[mid] <= total) low = mid
    else high = mid - 1
  }
  const level = low + 1
  if (level >= MAX_LEVEL) return MAX_LEVEL
  const required = REQUIRED_EXP[level - 1]
  if (required <= 0n) return level
  const within = Number(total - CUMULATIVE_EXP[level - 1]) / Number(required)
  return level + Math.min(Math.max(within, 0), 1)
}

export interface CharacterGrowth {
  characterName: string
  before: CharacterSnapshot
  after: CharacterSnapshot
  /** 이 구간에 쌓은 경험치. 정렬 기준이다. */
  expGained: bigint
  /** 소수 레벨 차이. 표시용. */
  levelGained: number
  /** 두 시점 모두 만렙이라 **측정 자체가 불가능**한 캐릭터. */
  stuckAtMaxLevel: boolean
  /** 구간 중에 만렙을 찍었다. 그 구간의 성장은 계산되므로 목록에 남긴다. */
  reachedMaxLevel: boolean
}

export function computeGrowth(before: CharacterSnapshot, after: CharacterSnapshot): CharacterGrowth {
  const beforeTotal = cumulativeExp(before)
  const afterTotal = cumulativeExp(after)
  const gained = afterTotal - beforeTotal
  return {
    characterName: after.characterName,
    before,
    after,
    // 만렙에서 `exp`가 0으로 떨어지고, 경험치 패치 때도 `exp`가 줄 수 있다.
    //
    // 후자는 패치로 요구치가 이미 가진 경험치보다 낮아진 경우다(실측
    // `마카롱공주`: 393.9억 → 381.4억이면서 `exp`가 표의 226레벨 요구치와
    // **정확히 일치**). 저장값이 잘린 건지 API 응답에만 안 실린 건지는
    // 가리지 못했다 — 자세한 건 `docs/planning/features/guild-admin.md`.
    //
    // 어느 쪽이든 우리가 볼 수 있는 값으로는 성장이 음수가 되므로 0으로 막는다.
    expGained: gained > 0n ? gained : 0n,
    levelGained:
      gained > 0n
        ? fractionalLevelFromCumulative(afterTotal) - fractionalLevelFromCumulative(beforeTotal)
        : 0,
    stuckAtMaxLevel: before.level >= MAX_LEVEL && after.level >= MAX_LEVEL,
    reachedMaxLevel: before.level < MAX_LEVEL && after.level >= MAX_LEVEL,
  }
}

export interface PersonGrowth {
  /** ⓪ 그룹의 id. 그룹이 없으면 캐릭터 이름. */
  id: string
  /** 표시용 대표 캐릭터 — 그룹 안에서 **마지막 시점 레벨이 가장 높은** 캐릭터. */
  representativeName: string
  characters: CharacterGrowth[]
  /** 그룹 전체의 성장 합. 본캐가 만렙이라 멈춰 있어도 부캐를 키우면 잡힌다. */
  totalExpGained: bigint
  /** 그룹의 **모든** 캐릭터가 두 시점 다 만렙 — 측정 불가. */
  allStuckAtMaxLevel: boolean
}

/** 캐릭터별 성장을 사람 단위로 묶는다.
 *
 * 성장량을 그룹 합으로 내는 게 핵심이다. 대표 캐릭터만 보면 **본캐는 만렙이라
 * 멈춰 있고 부캐를 키우는 사람**이 "안 크는 사람"으로 잡힌다. */
export function groupGrowthByPerson(
  growths: CharacterGrowth[],
  groups: { id: string; members: string[] }[] | null,
  /** 그룹 id → ⓪에서 정한 대표 이름. 있으면 레벨로 고르지 않고 이걸 보여준다. */
  representatives?: ReadonlyMap<string, string>,
): PersonGrowth[] {
  const groupIdByName = new Map<string, string>()
  for (const group of groups ?? []) {
    for (const name of group.members) groupIdByName.set(name, group.id)
  }

  const buckets = new Map<string, CharacterGrowth[]>()
  for (const growth of growths) {
    const key = groupIdByName.get(growth.characterName) ?? growth.characterName
    const bucket = buckets.get(key)
    if (bucket) bucket.push(growth)
    else buckets.set(key, [growth])
  }

  const people: PersonGrowth[] = []
  for (const [id, characters] of buckets) {
    const representative = characters.reduce((best, current) =>
      current.after.level > best.after.level ? current : best,
    )
    people.push({
      id,
      representativeName: representatives?.get(id) ?? representative.characterName,
      characters: [...characters].sort((a, b) => b.after.level - a.after.level),
      totalExpGained: characters.reduce((sum, c) => sum + c.expGained, 0n),
      allStuckAtMaxLevel: characters.every((c) => c.stuckAtMaxLevel),
    })
  }
  return people
}

/** 성장이 **적은 순**으로. 이 화면의 목적이 "누가 안 크고 있나"를 찾는 것이라,
 * 찾으러 온 사람이 맨 위에 있어야 한다. */
export function sortByGrowthAscending<T extends PersonGrowth>(people: T[]): T[] {
  return [...people].sort((a, b) => {
    if (a.totalExpGained === b.totalExpGained) {
      return a.representativeName.localeCompare(b.representativeName)
    }
    return a.totalExpGained < b.totalExpGained ? -1 : 1
  })
}

/** 비교 구간이 경험치 요구량 변경 패치를 걸치는가.
 *
 * 걸치면 그 구간의 절대 경험치 성장량이 부정확하다 — 2026-03-19 패치는
 * 210~259 구간을 약 49.7% 낮췄다. 기능을 끄지는 않는다(260 이상은 정확하다).
 * 경고만 띄우고 해당 구간 행에 표식을 단다. */
export function spansExpTablePatch(oldDate: string, newDate: string): boolean {
  return oldDate < EXP_TABLE_PATCH_DATE && EXP_TABLE_PATCH_DATE <= newDate
}

/** 패치가 건드린 레벨 구간. 이 구간에 걸쳐 있던 캐릭터만 표식을 단다. */
export const PATCH_AFFECTED_LEVEL_RANGE = { min: 210, max: 259 } as const

export function isAffectedByExpPatch(growth: CharacterGrowth): boolean {
  const { min, max } = PATCH_AFFECTED_LEVEL_RANGE
  return growth.before.level <= max && growth.after.level >= min
}

/** 역산 검증 — `요구치 = exp / (expRate / 100)`.
 *
 * `exp_rate`가 소수점 3자리로 반올림돼 오차가 조금 있다(실측 대조에서 최대
 * 0.6%, 대부분 0.01% 이하).
 *
 * **판정은 중앙값으로 한다.** 개별 캐릭터가 크게 어긋나는 건 흔한데, 그게
 * 표가 낡았다는 뜻은 아니기 때문이다 — 일부 캐릭터는 `exp`/`exp_rate`가
 * **경험치 패치 이전 기준으로 남아 있다.** 길드 B 길드에서 250~253레벨
 * 9명이 정확히 2.371배, 221~223레벨 6명이 1.271배로 어긋났는데, 이는
 * 2026-03-19 패치의 구간별 감소율(250~259 최대 58% → `1/(1-0.58)=2.38`)과
 * 맞아떨어진다. 같은 250레벨이라도 갱신된 캐릭터는 1.000배로 정확했다.
 *
 * 즉 **몇 명이 어긋났나**가 아니라 **전체가 한쪽으로 쏠렸나**를 봐야 한다.
 * 표가 진짜 낡았다면 거의 모든 캐릭터가 같은 방향으로 어긋나 중앙값이
 * 커진다. 처음엔 "1% 초과가 표본의 10% 이상"으로 봤는데, 길드 B의 멀쩡한
 * 결과에 10.1%로 경고가 떴다. */
export const EXP_TABLE_ERROR_THRESHOLD = 0.01

/** 부호 있는 상대 오차. 양수면 실제 요구치가 우리 표보다 크다는 뜻이다. */
export function signedImpliedExpError(snapshot: CharacterSnapshot): number | null {
  if (snapshot.level < 1 || snapshot.level >= MAX_LEVEL) return null
  if (snapshot.expRate <= 0.05 || snapshot.exp <= 0n) return null
  const table = Number(REQUIRED_EXP[snapshot.level - 1])
  if (table <= 0) return null
  const implied = Number(snapshot.exp) / (snapshot.expRate / 100)
  return (implied - table) / table
}

/** 표본 오차들의 중앙값. 이게 임계값을 넘으면 테이블이 낡은 것으로 본다. */
export function medianError(errors: number[]): number | null {
  if (errors.length === 0) return null
  const sorted = [...errors].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function impliedRequiredExpError(snapshot: CharacterSnapshot): number | null {
  if (snapshot.level < 1 || snapshot.level >= MAX_LEVEL) return null
  // 진행률이 0에 가까우면 반올림 오차가 폭발한다.
  if (snapshot.expRate <= 0.05 || snapshot.exp <= 0n) return null
  const table = Number(REQUIRED_EXP[snapshot.level - 1])
  if (table <= 0) return null
  const implied = Number(snapshot.exp) / (snapshot.expRate / 100)
  return Math.abs(implied - table) / table
}
