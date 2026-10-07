/** Meso cost reference for 잠재능력 재설정 (potential reset), sourced from
 * Namuwiki (https://namu.wiki/w/잠재능력, accessed 2026-09-21) since Nexon's
 * history endpoints don't return a cost field. As of the 2024-01-09
 * "큐브 삭제 및 잠재능력 재설정 메소화" patch, resetting potential/
 * additional-potential costs meso directly (no cube item) at a fixed price
 * per item-level bracket and *current* grade — this table is that price,
 * not an average or an expected value. Table values are static and will
 * drift out of date if Nexon repriced this after the Namuwiki edit date
 * above; there's no API to re-derive them, so this needs a manual refresh
 * if the numbers look wrong later. */

export type PotentialGrade = '레어' | '에픽' | '유니크' | '레전드리'

interface LevelBracket {
  minLevel: number
  maxLevel: number
  label: string
}

const LEVEL_BRACKETS: LevelBracket[] = [
  { minLevel: 1, maxLevel: 159, label: '1~159' },
  { minLevel: 160, maxLevel: 199, label: '160~199' },
  { minLevel: 200, maxLevel: 249, label: '200~249' },
  { minLevel: 250, maxLevel: 300, label: '250~300' },
]

function findBracketLabel(itemLevel: number): string | null {
  const bracket = LEVEL_BRACKETS.find((b) => itemLevel >= b.minLevel && itemLevel <= b.maxLevel)
  return bracket?.label ?? null
}

const MAIN_POTENTIAL_RESET_COST: Record<string, Record<PotentialGrade, number>> = {
  '1~159': { 레어: 4_000_000, 에픽: 16_000_000, 유니크: 34_000_000, 레전드리: 40_000_000 },
  '160~199': { 레어: 4_250_000, 에픽: 17_000_000, 유니크: 36_125_000, 레전드리: 42_500_000 },
  '200~249': { 레어: 4_500_000, 에픽: 18_000_000, 유니크: 38_250_000, 레전드리: 45_000_000 },
  '250~300': { 레어: 5_000_000, 에픽: 20_000_000, 유니크: 42_500_000, 레전드리: 50_000_000 },
}

const ADDITIONAL_POTENTIAL_RESET_COST: Record<string, Record<PotentialGrade, number>> = {
  '1~159': { 레어: 9_750_000, 에픽: 27_300_000, 유니크: 66_300_000, 레전드리: 78_000_000 },
  '160~199': { 레어: 10_375_000, 에픽: 29_050_000, 유니크: 70_550_000, 레전드리: 83_000_000 },
  '200~249': { 레어: 11_000_000, 에픽: 30_800_000, 유니크: 74_800_000, 레전드리: 88_000_000 },
  '250~300': { 레어: 12_250_000, 에픽: 34_300_000, 유니크: 83_300_000, 레전드리: 98_000_000 },
}

const KNOWN_GRADES = new Set<string>(['레어', '에픽', '유니크', '레전드리'])

/** Cost to reset a potential currently at `grade`, for an item at
 * `itemLevel`. Returns `null` when the grade isn't priceable (e.g. "노멀" —
 * an item with no potential yet doesn't have a reset cost) or the level
 * falls outside the known brackets (below 1 or above 300 — shouldn't
 * happen for real equipment, but the API doesn't guarantee it). */
export function getPotentialResetCost(
  itemLevel: number | null,
  grade: string | null,
  isAdditional: boolean,
): number | null {
  if (itemLevel == null || grade == null || !KNOWN_GRADES.has(grade)) return null
  const bracketLabel = findBracketLabel(itemLevel)
  if (!bracketLabel) return null
  const table = isAdditional ? ADDITIONAL_POTENTIAL_RESET_COST : MAIN_POTENTIAL_RESET_COST
  return table[bracketLabel][grade as PotentialGrade]
}

interface PriceablePotentialEntry {
  potential_type: string
  item_level: number | null
  potential_option_grade: string | null
  additional_potential_option_grade: string | null
}

/** `history/potential` entries only — see "모아보기" section in
 * `docs/planning/features/probability.md` for why `history/cube` entries'
 * *cube item* cost is deliberately never priced (cube items were
 * discontinued by the same patch that introduced this meso reset system; a
 * `cube_type` seen live is an event-only cube with no reliable meso price,
 * not a purchasable one) — `estimateCubeAppraisalCost()` below prices a
 * separate, smaller fee that *does* apply to cube entries. */
export function estimatePotentialEntryCost(entry: PriceablePotentialEntry): number | null {
  const isAdditional = entry.potential_type.includes('에디셔널')
  const grade = isAdditional ? entry.additional_potential_option_grade : entry.potential_option_grade
  return getPotentialResetCost(entry.item_level, grade, isAdditional)
}

/** 감정 비용 — using a cube (or otherwise rolling potential onto an item)
 * charges this small level-based fee *in addition to* the reset cost
 * above, every time, independent of grade. Source: a widely-cited
 * `n × n × 계수` breakdown (n = item level), cross-checked against worked
 * examples (60레벨→900메소, 120레벨→36,000메소, 200레벨→800,000메소, all
 * exact) — accessed 2026-09-22. Doesn't model the "통찰력 60/90레벨 이상이면
 * 해당 구간 무료" discount (not derivable from history data — we don't know
 * the account's 통찰력 node level), so this is a one-directional
 * overestimate for accounts with that node maxed, same caveat shape as the
 * 파괴방지 starforce surcharge. */
const APPRAISAL_COST_TIERS: { maxLevel: number; coefficient: number }[] = [
  { maxLevel: 30, coefficient: 0 },
  { maxLevel: 70, coefficient: 0.25 },
  { maxLevel: 120, coefficient: 2.5 },
  { maxLevel: Infinity, coefficient: 20 },
]

export function getCubeAppraisalCost(itemLevel: number | null): number | null {
  if (itemLevel == null || itemLevel < 1) return null
  const tier = APPRAISAL_COST_TIERS.find((t) => itemLevel <= t.maxLevel)
  if (!tier) return null
  return Math.round(itemLevel ** 2 * tier.coefficient)
}

interface PriceableCubeEntry {
  item_level: number | null
}

export function estimateCubeAppraisalCost(entry: PriceableCubeEntry): number | null {
  return getCubeAppraisalCost(entry.item_level)
}

/** 스타포스 강화 비용 공식, sourced from
 * `namu.wiki/w/메이플스토리/스타포스 강화` (accessed 2026-09-21):
 * `1000 + L³(S+1)ⁿ / D`, final result rounded to the nearest 10 meso — `L`
 * = item level, `S` = the *current* star count before this attempt (paid
 * per attempt regardless of success/fail/destroy), `n`/`D` vary by tier.
 * Confirmed for every star 0~22; 23+ has no published cost in that source
 * (`getStarforceCost` returns `null` there rather than guessing).
 *
 * Deliberately does **not** add the 파괴 방지(안전 강화) +200% surcharge
 * even when `protect_shield` was used — the surcharge is only confirmed
 * for 15~17성 (안전 강화가 가능한 유일한 구간이 15~17성이므로 사실상
 * 전체 구간), so this is a known, one-directional underestimate for any
 * attempt where it was actually used; see "Known debt". */
const STARFORCE_COST_TIERS: { maxStar: number; exponent: number; denominator: number }[] = [
  { maxStar: 5, exponent: 1, denominator: 36 },
  { maxStar: 10, exponent: 2.7, denominator: 571 },
  { maxStar: 11, exponent: 2.7, denominator: 314 },
  { maxStar: 12, exponent: 2.7, denominator: 214 },
  { maxStar: 13, exponent: 2.7, denominator: 157 },
  { maxStar: 14, exponent: 2.7, denominator: 107 },
  { maxStar: 16, exponent: 2.7, denominator: 200 },
  { maxStar: 17, exponent: 2.7, denominator: 150 },
  { maxStar: 18, exponent: 2.7, denominator: 70 },
  { maxStar: 19, exponent: 2.7, denominator: 45 },
  { maxStar: 20, exponent: 2.7, denominator: 200 },
  { maxStar: 21, exponent: 2.7, denominator: 125 },
  { maxStar: 22, exponent: 2.7, denominator: 200 },
]

export function getStarforceCost(itemLevel: number, currentStar: number): number | null {
  const tier = STARFORCE_COST_TIERS.find((t) => currentStar <= t.maxStar)
  if (!tier) return null
  const raw = 1000 + (itemLevel ** 3 * (currentStar + 1) ** tier.exponent) / tier.denominator
  return Math.round(raw / 10) * 10
}

export function estimateStarforceEntryCost(
  beforeStarforceCount: number | null,
  itemLevel: number | null,
): number | null {
  if (beforeStarforceCount == null || itemLevel == null) return null
  return getStarforceCost(itemLevel, beforeStarforceCount)
}

/** A non-empty `upgrade_item` means this attempt used a starforce
 * scroll/ticket (e.g. "카르마 스타포스 17성 강화권") instead of the normal
 * meso-based system — confirmed live (2026-09-22) via a real entry with
 * `before_starforce_count: 0, after_starforce_count: 17,
 * item_upgrade_result: "성공"`. Such attempts cost no meso and always
 * succeed, so they're excluded from the meso-cost formula and from
 * probability tallies — see `getStarforceEntryCost` and
 * `docs/planning/features/probability.md`. */
export function isScrollBasedStarforceEntry(entry: { upgrade_item: string | null }): boolean {
  return Boolean(entry.upgrade_item)
}

interface CostableStarforceEntry {
  before_starforce_count: number | null
  upgrade_item: string | null
}

/** Per-entry meso cost, scroll-aware — a scroll-based attempt always costs
 * 0 regardless of star/level, otherwise falls back to the normal formula. */
export function getStarforceEntryCost(entry: CostableStarforceEntry, itemLevel: number | null): number | null {
  if (isScrollBasedStarforceEntry(entry)) return 0
  return estimateStarforceEntryCost(entry.before_starforce_count, itemLevel)
}
