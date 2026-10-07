/** 표에서 뽑은 숫자 열들이 각각 무엇인지 **값으로** 알아낸다.
 *
 * 지금까지는 열 순서를 상수로 박아 뒀다(`[레벨, 주간미션, 지하수로,
 * 플래그레이스]`). 그런데 그 순서는 **화면을 어떻게 정렬했는지, 창을 얼마나
 * 넓혔는지**에 따라 달라질 수 있고, 표본 12장이 한결같았던 건 한 사람이
 * 같은 방식으로 찍었기 때문이다.
 *
 * 다행히 이 네 값은 **범위가 서로 겹치지 않는다.** 값만 보고도 무엇인지
 * 거의 확실하게 가린다.
 *
 * | 열 | 범위 | 특징 |
 * | --- | --- | --- |
 * | 레벨 | 1~300 | 거의 전부 200 이상 |
 * | 주간미션 | 0~10 | 한 자리 |
 * | 지하수로 | 0~수십만 | 유일하게 자릿수가 큼 |
 * | 플래그레이스 | 0 또는 1000 단위 | 값 종류가 몇 개 안 됨 |
 */

/** 컨텐츠 종류. 백엔드의 `content_type`과 같은 값을 쓴다. */
export type ScoreContent = 'weekly-mission' | 'underground' | 'flag-race'

/** 점수가 아닌 열도 알아둬야 오해 없이 건너뛴다. */
export type ColumnKind = ScoreContent | 'level' | 'unknown'

export interface ColumnGuess {
  /** 몇 번째 열인지. `OcrRow.cells`의 인덱스. */
  index: number
  kind: ColumnKind
  /** 0~1. 이 열의 값 중 그 성격에 들어맞는 비율. */
  confidence: number
  /** 사람이 확인할 수 있게 남기는 요약. */
  sample: number[]
}

/** 레벨로 볼 범위. 저레벨 길드원도 있으니 아래쪽은 넉넉히 둔다. */
const LEVEL_RANGE = [1, 300] as const
/** 주간미션 최대치. */
const WEEKLY_MISSION_MAX = 10
/** 지하수로 점수로 볼 최소치. 이보다 작으면 레벨·미션과 구별이 안 된다. */
const UNDERGROUND_MIN = 1000

/** 이 비율은 넘어야 그 성격으로 인정한다. */
const MIN_CONFIDENCE = 0.7

/** 값 하나가 어떤 성격에 맞는지. */
function fits(kind: ColumnKind, value: number): boolean {
  switch (kind) {
    case 'weekly-mission':
      return Number.isInteger(value) && value >= 0 && value <= WEEKLY_MISSION_MAX
    case 'level':
      return Number.isInteger(value) && value >= LEVEL_RANGE[0] && value <= LEVEL_RANGE[1]
    case 'underground':
      return value >= UNDERGROUND_MIN
    case 'flag-race':
      // 0 아니면 1000 단위. 실측에서 본 값은 0과 1,000뿐이었다.
      return value === 0 || (value % 1000 === 0 && value > 0)
    case 'unknown':
      return false
  }
}

/** 이 열의 값들을 보고 성격을 고른다.
 *
 * 범위가 겹치는 구간이 있다 — 값이 전부 0이면 주간미션·플래그레이스 둘 다
 * 맞고, 레벨 범위(1~300)는 주간미션(0~10)을 품는다. 그래서 **더 좁은
 * 성격부터** 본다: 자리수가 큰 지하수로 → 한 자리 주간미션 → 레벨 →
 * 나머지를 플래그레이스.
 */
function guessKind(values: readonly number[]): { kind: ColumnKind; confidence: number } {
  if (values.length === 0) return { kind: 'unknown', confidence: 0 }

  const ratioOf = (kind: ColumnKind) =>
    values.filter((value) => fits(kind, value)).length / values.length

  const underground = ratioOf('underground')
  // 지하수로는 유일하게 네 자리를 넘는 값이 섞인다. 다만 전부 0인 열에도
  // 맞아 버리므로 "큰 값이 실제로 있는지"를 함께 본다.
  if (underground >= MIN_CONFIDENCE && values.some((value) => value >= UNDERGROUND_MIN)) {
    return { kind: 'underground', confidence: underground }
  }

  const weekly = ratioOf('weekly-mission')
  const level = ratioOf('level')
  // 주간미션은 한 자리라 레벨과 확실히 갈린다. 다만 값이 전부 0인 열은
  // 플래그레이스일 수도 있어서 뒤로 미룬다.
  if (weekly >= MIN_CONFIDENCE && values.some((value) => value > 0 && value <= WEEKLY_MISSION_MAX)) {
    return { kind: 'weekly-mission', confidence: weekly }
  }
  if (level >= MIN_CONFIDENCE) return { kind: 'level', confidence: level }

  const flag = ratioOf('flag-race')
  if (flag >= MIN_CONFIDENCE) return { kind: 'flag-race', confidence: flag }

  return { kind: 'unknown', confidence: 0 }
}

/** `304,130` 같은 표기를 숫자로. 숫자가 아니면 `null`. */
function toNumber(cell: string): number | null {
  const digits = cell.replace(/[^\d]/g, '')
  if (!digits || !/\d/.test(cell)) return null
  // 숫자 말고 다른 글자가 섞인 칸은 점수 열이 아니다(`듀얼블레이더` 등).
  if (/[^\d,.\s]/.test(cell)) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

/** 표 전체를 보고 각 열이 무엇인지 추정한다.
 *
 * 한 행만 보면 못 가린다 — 레벨 `297`과 지하수로 `297`은 구별이 안 된다.
 * **열 전체의 분포**를 봐야 갈린다. */
export function guessColumns(rows: readonly { cells: string[] }[]): ColumnGuess[] {
  const width = rows.reduce((max, row) => Math.max(max, row.cells.length), 0)
  const guesses: ColumnGuess[] = []

  for (let index = 0; index < width; index++) {
    const values = rows
      .map((row) => toNumber(row.cells[index] ?? ''))
      .filter((value): value is number => value !== null)
    const { kind, confidence } = guessKind(values)
    guesses.push({ index, kind, confidence, sample: values.slice(0, 5) })
  }

  // 같은 성격이 두 열에 붙으면 확신이 높은 쪽만 남긴다.
  const best = new Map<ColumnKind, ColumnGuess>()
  for (const guess of guesses) {
    if (guess.kind === 'unknown') continue
    const previous = best.get(guess.kind)
    if (!previous || guess.confidence > previous.confidence) best.set(guess.kind, guess)
  }
  return guesses.map((guess) =>
    guess.kind !== 'unknown' && best.get(guess.kind) !== guess
      ? { ...guess, kind: 'unknown' as const, confidence: 0 }
      : guess,
  )
}

/** 그 컨텐츠의 점수가 몇 번째 열인지. 못 찾으면 `null`. */
export function columnFor(guesses: readonly ColumnGuess[], content: ScoreContent): number | null {
  return guesses.find((guess) => guess.kind === content)?.index ?? null
}
