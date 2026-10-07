/** ④ 주간 컨텐츠 점수 — 화면에서 읽은 값을 길드 명단에 맞추는 로직.
 *
 * 게임 화면(`길드원 > 컨텐츠 참여 현황`)의 닉네임 컬럼은 그대로 쓸 수 없다.
 * 실제 스크린샷에서 확인한 표기들:
 *
 * | 화면 표기 | 실제 닉네임 |
 * | --- | --- |
 * | `부서진별(부..` | `부서진별` |
 * | `아름잼부터(..` | `아름잼부터` |
 * | `고구마라떼..` | `고구마라떼` |
 * | `문킹(문킹)` | `문킹` |
 *
 * **닉네임은 6글자 상한이고 6글자까지는 무조건 출력된다**(사용자 확인).
 * 그러므로 잘림(`..`)은 이름이 길어서가 아니다 — **접속 중인 인원**에게
 * `메인(접속캐릭)` 형태로 괄호가 붙고, 그 괄호 부분이 길어서 잘린다.
 */

import {
  jamoDistance,
  jamoSimilarity,
  truncatedAwareSimilarity,
} from '@/lib/hangul-similarity'

/** 잘림 표시. 화면이 칸을 넘는 글자를 이걸로 끊는다. */
const TRUNCATION_MARK = /[.·․…]{1,}$/u

/** 화면에 찍힌 닉네임 칸을 실제 닉네임 후보로 정리한다.
 *
 * **길이로 자르지 않는다.** "닉네임 6글자 상한"은 한글 기준이고, 영문·숫자
 * 이름은 더 길다 — 실측 명단 1024명 중 **37명이 6글자를 넘고** 최대 12자다
 * (`SKYWALK`, `qwerasdf12z`). 6자로 자르면 그런 이름을 오히려 망가뜨린다.
 * 길이 문제는 아래 `matchToRoster`의 점진적 접두사 탐색이 처리한다. */
export function cleanCharacterName(raw: string): string {
  // 괄호 이후는 접속 중인 캐릭터 정보라 버린다.
  const cut = raw.split(/[(（[{]/)[0]
  return cut.replace(TRUNCATION_MARK, '').replace(/\s+/g, '')
}

/** 화면에서 잘린 흔적이 있는가. 있으면 뒤쪽 글자를 믿을 수 없다. */
export function looksTruncated(raw: string): boolean {
  return TRUNCATION_MARK.test(raw.trimEnd())
}

export type MatchConfidence =
  /** 명단에 그대로 있다. 사람이 볼 것도 없다. */
  | 'exact'
  /** 규칙으로 되돌렸다(잘린 이름 or 자모 몇 개 오인식). 눈으로 확인만 하면 된다. */
  | 'corrected'
  /** 후보는 있는데 하나로 좁혀지지 않았다. 사람이 골라야 한다. */
  | 'ambiguous'
  /** 명단에서 비슷한 것도 못 찾았다. */
  | 'none'

export interface NameMatch {
  /** 길드 명단에서 찾은 이름. 못 찾으면 `null`. */
  matched: string | null
  /** 정리한 뒤의 입력값. 화면에 "이렇게 읽었다"고 보여준다. */
  cleaned: string
  confidence: MatchConfidence
  /** `ambiguous`일 때 고를 후보들(유사도 높은 순). */
  suggestions: string[]
}

/** 길드 명단과 대조한다.
 *
 * **정답 후보가 길드 명단 안에 반드시 있다**는 게 이 기능의 버팀목이다.
 * OCR이 글자를 조금 틀려도 명단으로 되돌릴 수 있다. 명단에 없는 이름은
 * 저장하지 않고 사용자에게 돌려준다 — 오탈자 검증이 공짜로 따라온다.
 */
/** 이 정도는 넘어야 "같은 이름을 잘못 읽은 것"으로 본다.
 *
 * 자모 기준이라 6글자(자모 ~15개) 이름에서 0.8이면 자모 3개쯤 틀린 것까지
 * 받아들인다. 더 낮추면 엉뚱한 사람에게 붙기 시작한다. */
const SIMILARITY_THRESHOLD = 0.8

/** 1등과 2등이 이만큼은 벌어져야 하나로 확정한다.
 *
 * 길드에는 `산섀님` / `산섀님유챔5` / `산섀님유챔6`처럼 **서로 닮은 이름이
 * 무더기로** 있다. 근소한 차이로 1등을 고르면 조용히 엉뚱한 사람 점수가
 * 된다 — 그럴 땐 차라리 사람에게 묻는다. */
const AMBIGUITY_MARGIN = 0.06

/** 비율과 별개로, **자모가 이만큼만 틀렸으면** 같은 이름으로 본다.
 *
 * 짧은 이름은 자모가 적어서 한 글자만 틀려도 비율이 훅 떨어진다 — `라뮤`와
 * `라묘`는 자모 4개 중 1개 차이인데 비율로는 0.75라 임계(0.8)에 걸린다.
 * 사람 눈에는 명백히 같은 이름이다. 대신 2등도 이 안에 들면 여전히
 * 모호한 것으로 두고 물어본다. */
const MAX_JAMO_DISTANCE = 1

/** 1등과 2등의 **자모 거리**가 이만큼은 벌어져야 하나로 확정한다.
 *
 * 헷갈리는 자모 치환을 0.5로 세기 시작하면서, 1등이 0.5이고 2등이 1.0인
 * 경우까지 "둘 다 거리 1 이내"라는 이유로 모호로 밀렸다. 1등이 두 배 가까운
 * 차이로 앞서는데 사람에게 묻는 건 과하다. */
const DISTANCE_MARGIN = 0.5

/** 글자 종류가 아예 다르면 닮았다고 보지 않는다.
 *
 * OCR이 한글 닉네임을 통째로 로마자로 읽어 버리면(`박하늘`→`BEY`) 되돌릴
 * 방법이 없다. 그런데 짧은 로마자 쓰레기는 긴 한글 이름과 어쩌다 점수가
 * 맞아 **조용히 엉뚱한 사람에게 붙는다** — 실측에서 `OFSBRE`가
 * `OK감자튀김`으로 보정됐다.
 *
 * 그래서 **입력에 한글이 하나도 없는데 후보는 한글 위주**면 맞다고 보지
 * 않는다. `1네온`→`MI네온`처럼 입력에 한글이 있으면 그대로 통과한다. */
/** 접두사로 찾을 때 이만큼은 남겨야 한다.
 *
 * 한 글자까지 줄이면 **그 글자로 시작하는 명단 이름이 하나뿐일 때 무조건
 * 붙는다.** 실측에서 `OFSBRE..`가 `O` 하나 때문에 `OK감자튀김`으로,
 * `FHSEAI..`가 `F` 때문에 `Fiona`으로 보정됐다 — 유사도는 각각 0.07과
 * 0.17이었다. */
const MIN_PREFIX_LENGTH = 2

function scriptMismatch(input: string, candidate: string): boolean {
  const hangul = /[가-힣ㄱ-ㅎㅏ-ㅣ]/
  if (hangul.test(input)) return false
  const candidateHangul = [...candidate].filter((char) => hangul.test(char)).length
  return candidateHangul > candidate.length / 2
}

/** 길드 명단과 대조한다.
 *
 * **정답 후보가 길드 명단 안에 반드시 있다**는 게 이 기능의 버팀목이다.
 * 그래서 글자를 조금 틀려도 되돌릴 수 있다. 순서대로 시도한다.
 *
 * 1. 그대로 있으면 `exact`.
 * 2. 잘린 이름이면 접두사로 찾는다. 후보가 하나면 `corrected`.
 * 3. 자모 유사도로 가장 가까운 이름을 찾는다. 충분히 닮았고 2등과 벌어져
 *    있으면 `corrected`, 비슷한 게 여럿이면 `ambiguous`.
 *
 * 마지막까지 못 찾으면 `none`이고, 저장하지 않고 사용자에게 돌려준다.
 */
export function matchToRoster(raw: string, roster: readonly string[]): NameMatch {
  const cleaned = cleanCharacterName(raw)
  if (!cleaned) return { matched: null, cleaned, confidence: 'none', suggestions: [] }

  if (roster.includes(cleaned)) {
    return { matched: cleaned, cleaned, confidence: 'exact', suggestions: [] }
  }

  // **접두사 보정은 잘린 입력에만 쓴다.** 안 잘린 입력에 쓰면 짧은 이름이
  // 긴 이름에 조용히 흡수된다 — `포도`(정답 `포드`)이 `포도포도뽀도`의
  // 접두사라는 이유로 그쪽에 붙는 오매칭을 실제로 만들었다.
  if (looksTruncated(raw)) {
    const prefixed = roster.filter(
      (name) => name.startsWith(cleaned) && !scriptMismatch(cleaned, name),
    )
    if (prefixed.length === 1) {
      return { matched: prefixed[0], cleaned, confidence: 'corrected', suggestions: [] }
    }
  }

  // 잘려 들어온 경우엔 **뒤에서부터 한 글자씩 떼며** 맞는 이름을 찾는다.
  //
  // 구분자가 깨지면 이름 뒤에 쓰레기가 붙는다 — 실측에서 `슝슝(슝슝..`이
  // `슝슝K슝슝..`으로 읽혔다. 괄호를 못 찾으니 `슝슝K슝슝`이 통째로 이름이
  // 돼버린다. 어디서 깨졌는지 모르므로, 가장 긴 것부터 줄여가며 **명단에
  // 딱 하나로 맞는 지점**을 찾는다.
  if (looksTruncated(raw)) {
    for (let length = cleaned.length - 1; length >= MIN_PREFIX_LENGTH; length--) {
      const candidates = roster.filter(
        (name) =>
          name.startsWith(cleaned.slice(0, length)) && !scriptMismatch(cleaned, name),
      )
      if (candidates.length === 1) {
        return { matched: candidates[0], cleaned, confidence: 'corrected', suggestions: [] }
      }
      // 후보가 여럿이면 더 줄여봐야 늘기만 한다. 여기서 멈추고 사람에게 묻는다.
      if (candidates.length > 1) {
        return {
          matched: null,
          cleaned,
          confidence: 'ambiguous',
          suggestions: candidates.slice(0, 5),
        }
      }
    }
  }

  // 잘리지 않은 입력은 **전체 문자열끼리** 잰다. 앞부분 보너스를 주면 위의
  // 접두사 문제가 유사도 쪽으로 그대로 옮겨온다.
  const score = looksTruncated(raw)
    ? (name: string) => truncatedAwareSimilarity(cleaned, name)
    : (name: string) => jamoSimilarity(cleaned, name)

  const scored = roster
    .filter((name) => !scriptMismatch(cleaned, name))
    .map((name) => ({ name, score: score(name), distance: jamoDistance(cleaned, name) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const closeEnough = (entry: { score: number; distance: number }) =>
    entry.score >= SIMILARITY_THRESHOLD || entry.distance <= MAX_JAMO_DISTANCE

  if (!best || !closeEnough(best)) {
    return {
      matched: null,
      cleaned,
      confidence: 'none',
      suggestions: scored.slice(0, 3).map((entry) => entry.name),
    }
  }

  const second = scored[1]
  // 2등도 "자모 하나 차이"면 비율 차이가 커도 못 고른다 — 둘 다 그럴듯하다.
  if (
    second &&
    closeEnough(second) &&
    second.distance <= MAX_JAMO_DISTANCE &&
    second.distance - best.distance < DISTANCE_MARGIN
  ) {
    return {
      matched: null,
      cleaned,
      confidence: 'ambiguous',
      suggestions: scored
        .filter((entry) => entry.distance <= MAX_JAMO_DISTANCE)
        .slice(0, 5)
        .map((entry) => entry.name),
    }
  }
  if (second && best.score - second.score < AMBIGUITY_MARGIN) {
    return {
      matched: null,
      cleaned,
      confidence: 'ambiguous',
      suggestions: scored
        .filter((entry) => best.score - entry.score < AMBIGUITY_MARGIN)
        .slice(0, 5)
        .map((entry) => entry.name),
    }
  }

  return { matched: best.name, cleaned, confidence: 'corrected', suggestions: [] }
}

/** 붙여넣은 줄에서 **점수 후보로 셀 토큰**인가.
 *
 * 쉼표가 섞인 숫자만 센다 — 직업명에 든 숫자(`아크메이지(불,독)`)는 빼야 한다.
 * OCR 훅이 숫자 칸마다 그림을 딸 때도 이걸로 순번을 세야, 붙여넣기 쪽이 모은
 * 숫자와 순번이 어긋나지 않는다. */
export function isScoreToken(token: string): boolean {
  return /^[\d,]+$/.test(token) && parseScore(token) !== null
}

/** `304,130` 같은 표기를 숫자로. 쉼표와 공백을 버린다. */
export function parseScore(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

/** 그 날짜가 속한 주의 **목요일**. 길드 컨텐츠가 목요일에 리셋된다. */
export function weekStartOf(value: Date): string {
  const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  const shift = (utc.getUTCDay() - 4 + 7) % 7 // 일=0 … 목=4
  utc.setUTCDate(utc.getUTCDate() - shift)
  return utc.toISOString().slice(0, 10)
}

/** 최근 몇 주치 주차 목록(최신순). 주차 드롭다운의 기본 후보. */
export function recentWeeks(count: number, from: Date = new Date()): string[] {
  const weeks: string[] = []
  const cursor = new Date(from)
  for (let i = 0; i < count; i++) {
    weeks.push(weekStartOf(cursor))
    cursor.setDate(cursor.getDate() - 7)
  }
  return weeks
}
