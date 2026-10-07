/** Theoretical probability reference for 모아보기's "실제 대비 이론 확률"
 * comparison. Sourced directly from Nexon's own official probability
 * disclosure pages (`maplestory.nexon.com/Guide/OtherProbability/cube/*`)
 * — the legally-required probability-item disclosures, the most
 * authoritative source available, not Namuwiki. Accessed 2026-09-21.
 * Static snapshots, not live data — there's no API for this; a re-price
 * by Nexon would go stale silently, same caveat as
 * `probability-cost-reference.ts`'s meso price tables. */

export type PotentialGrade = '레어' | '에픽' | '유니크' | '레전드리'

const GRADE_ORDER: PotentialGrade[] = ['레어', '에픽', '유니크', '레전드리']

export function isKnownGrade(grade: string | null | undefined): grade is PotentialGrade {
  return grade != null && (GRADE_ORDER as string[]).includes(grade)
}

export function gradeRank(grade: PotentialGrade): number {
  return GRADE_ORDER.indexOf(grade)
}

/** `1000 + L³(S+1)ⁿ/D`'s sibling data — the success/fail/destroy
 * probability at each star, source: `namu.wiki/w/메이플스토리/스타포스
 * 강화` (same page `probability-cost-reference.ts`'s cost formula came
 * from), accessed 2026-09-21. Values are fractions (0~1), keyed by the
 * *current* star before the attempt (matches `before_starforce_count`).
 * Stops at 29 (source's last listed row) — an attempt at a higher star
 * has no theoretical rate here and is excluded from the comparison, same
 * pattern as `getStarforceCost()`'s 23+ cutoff. */
export const STARFORCE_THEORETICAL_RATES: Record<
  number,
  { success: number; fail: number; destroy: number }
> = {
  0: { success: 0.9975, fail: 0.0025, destroy: 0 },
  1: { success: 0.945, fail: 0.055, destroy: 0 },
  2: { success: 0.8925, fail: 0.1075, destroy: 0 },
  3: { success: 0.8925, fail: 0.1075, destroy: 0 },
  4: { success: 0.84, fail: 0.16, destroy: 0 },
  5: { success: 0.7875, fail: 0.2125, destroy: 0 },
  6: { success: 0.735, fail: 0.265, destroy: 0 },
  7: { success: 0.6825, fail: 0.3175, destroy: 0 },
  8: { success: 0.63, fail: 0.37, destroy: 0 },
  9: { success: 0.5775, fail: 0.4225, destroy: 0 },
  10: { success: 0.525, fail: 0.475, destroy: 0 },
  11: { success: 0.4725, fail: 0.5275, destroy: 0 },
  12: { success: 0.42, fail: 0.58, destroy: 0 },
  13: { success: 0.3675, fail: 0.6325, destroy: 0 },
  14: { success: 0.315, fail: 0.685, destroy: 0 },
  15: { success: 0.315, fail: 0.66445, destroy: 0.02055 },
  16: { success: 0.315, fail: 0.66445, destroy: 0.02055 },
  17: { success: 0.1575, fail: 0.7751, destroy: 0.0674 },
  18: { success: 0.1575, fail: 0.7751, destroy: 0.0674 },
  19: { success: 0.1575, fail: 0.75825, destroy: 0.08425 },
  20: { success: 0.315, fail: 0.58225, destroy: 0.10275 },
  21: { success: 0.1575, fail: 0.716125, destroy: 0.126375 },
  22: { success: 0.1575, fail: 0.674, destroy: 0.1685 },
  23: { success: 0.105, fail: 0.716, destroy: 0.179 },
  24: { success: 0.105, fail: 0.716, destroy: 0.179 },
  25: { success: 0.105, fail: 0.716, destroy: 0.179 },
  26: { success: 0.0735, fail: 0.7416, destroy: 0.1853 },
  27: { success: 0.0525, fail: 0.758, destroy: 0.1895 },
  28: { success: 0.0315, fail: 0.7748, destroy: 0.1937 },
  29: { success: 0.0105, fail: 0.7916, destroy: 0.1979 },
}

/** Grade-up probability tables. Each maps the *current* grade (before the
 * reset) to the probability of leveling up to the next tier on this one
 * attempt — a grade missing from a table means that cube/system's maximum
 * output grade is below it (e.g. 장인의 큐브 tops out at 유니크, so it has
 * no 유니크→레전드리 entry at all, not a 0% one). */
type GradeUpRates = Partial<Record<PotentialGrade, number>>

/** maplestory.nexon.com/Guide/OtherProbability/cube/black — explicitly
 * covers 카르마 블랙 큐브/대적자의 블랙 큐브 by name, and our meso
 * "잠재능력 재설정" system is confirmed (see probability.md) to mirror
 * black-cube odds. */
export const MAIN_POTENTIAL_GRADE_UP_RATES: GradeUpRates = {
  레어: 0.150000001275,
  에픽: 0.035,
  유니크: 0.014,
}

/** .../cube/addi ("화이트 에디셔널 큐브") — explicitly covers 카르마/
 * 대적자의 화이트 에디셔널 큐브 by name. */
export const ADDITIONAL_POTENTIAL_GRADE_UP_RATES: GradeUpRates = {
  레어: 0.047619,
  에픽: 0.019608,
  유니크: 0.007,
}

/** Named cube-tier probability tables, keyed by the substring used to
 * match a real `cube_type` string to the right table (see
 * `matchCubeGradeUpTable`) — every table sourced from Nexon's official
 * page for that tier, each of which lists the real event-cube names
 * (메멘토 실버/골드, 카르마, 대적자의 ...) it applies to. Checked in this
 * order; "화이트"/"브론즈" never collide with "실버"/"골드"/"레드"/"블랙"
 * in practice. */
const CUBE_GRADE_UP_TABLES: { keyword: string; label: string; rates: GradeUpRates }[] = [
  {
    // .../cube/strangeAddi ("브론즈 에디셔널 큐브"/"수상한 에디셔널 큐브") — max grade 에픽
    keyword: '브론즈',
    label: '브론즈 에디셔널 큐브',
    rates: { 레어: 0.004 },
  },
  {
    keyword: '화이트',
    label: '화이트 에디셔널 큐브',
    rates: ADDITIONAL_POTENTIAL_GRADE_UP_RATES,
  },
  {
    // .../cube/master ("장인의 큐브/실버 큐브") — max grade 유니크
    keyword: '실버',
    label: '장인의 큐브(실버)',
    rates: { 레어: 0.047619, 에픽: 0.011858 },
  },
  {
    keyword: '장인',
    label: '장인의 큐브',
    rates: { 레어: 0.047619, 에픽: 0.011858 },
  },
  {
    // .../cube/artisan ("명장의 큐브/골드 큐브")
    keyword: '골드',
    label: '명장의 큐브(골드)',
    rates: { 레어: 0.079994, 에픽: 0.016959, 유니크: 0.001996 },
  },
  {
    keyword: '명장',
    label: '명장의 큐브',
    rates: { 레어: 0.079994, 에픽: 0.016959, 유니크: 0.001996 },
  },
  {
    // .../cube/red ("레드 큐브")
    keyword: '레드',
    label: '레드 큐브',
    rates: { 레어: 0.060000002444, 에픽: 0.018, 유니크: 0.003 },
  },
  {
    keyword: '블랙',
    label: '블랙 큐브',
    rates: MAIN_POTENTIAL_GRADE_UP_RATES,
  },
]

/** Matches a real `cube_type` string (e.g. "메멘토 실버 큐브 (200제)",
 * "카르마 블랙 큐브") to its probability table via substring keyword.
 * Returns `null` for an unrecognized type — an event-only cube with no
 * confirmed table is excluded from the comparison rather than guessing at
 * its odds. */
export function matchCubeGradeUpTable(cubeType: string): { label: string; rates: GradeUpRates } | null {
  const match = CUBE_GRADE_UP_TABLES.find((table) => cubeType.includes(table.keyword))
  return match ? { label: match.label, rates: match.rates } : null
}

/** Whether `afterOptions` represent a grade-up from `beforeGrade` — the
 * item's overall potential grade always equals its **first** option
 * line's grade (per the user, 2026-09-22 — lines 2/3 can independently
 * land at or below that first line's grade, so checking all 3 like an
 * earlier version of this function did was wrong: a real "성공" attempt
 * routinely rerolls lines 2/3 to a lower grade than line 1 even with no
 * grade-up at all, which would've made this under-count). Still not
 * validated against a real observed grade-up event (no `item_upgrade_
 * result` value distinctly means "등급업" — see docs/planning/features/
 * probability.md's "Known debt" — but the detection rule itself is now
 * grounded in confirmed game mechanics, not guessed). */
export function isGradeUp(
  beforeGrade: string | null,
  afterOptions: { grade: string | null }[],
): boolean {
  if (!isKnownGrade(beforeGrade) || afterOptions.length === 0) return false
  const firstLineGrade = afterOptions[0].grade
  if (!isKnownGrade(firstLineGrade)) return false
  return gradeRank(firstLineGrade) > gradeRank(beforeGrade)
}
