/** 한글 이름을 "조금 틀리게" 읽었을 때 원래 이름으로 되돌리기 위한 유사도.
 *
 * OCR은 한 글자를 통째로 틀리기보다 **자모 하나**를 틀린다 — `ㅇ`을 `ㅁ`으로,
 * `ㅜ`를 `ㅠ`로 읽는 식이다. 그런데 음절 단위로 비교하면 `강`과 `망`이 완전히
 * 다른 글자로 취급돼서, 한 획 차이도 "전혀 다른 이름"이 된다.
 *
 * 그래서 **자모로 풀어서** 비교한다. `강` → `ㄱㅏㅇ`, `망` → `ㅁㅏㅇ`이 되어
 * 3개 중 1개만 다르다. 이러면 편집 거리가 실제 오인식 정도를 반영한다.
 */

const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONGSEONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'

const HANGUL_BASE = 0xac00
const HANGUL_COUNT = 11172

/** OCR이 자주 뒤바꾸는 글자들을 한쪽으로 모은다.
 *
 * 실제로 본 것: `콩불0(콩불..`가 `콩불0K콩불..`로 읽혔다 — 여는 괄호가 `K`가
 * 됐다. 숫자/로마자 혼동은 그보다 흔하다. */
const CONFUSABLES: Record<string, string> = {
  O: '0',
  o: '0',
  ｏ: '0',
  Ｏ: '0',
  l: '1',
  I: '1',
  '|': '1',
  ｌ: '1',
  Z: '2',
  S: '5',
  B: '8',
}

function normalizeConfusables(value: string): string {
  return [...value].map((char) => CONFUSABLES[char] ?? char).join('')
}

/** 풀어둔 결과를 기억한다.
 *
 * 같은 이름을 **수천 번 다시 푼다.** 명단 대조는 한 줄마다 명단 전체(실측
 * 1,024명)와 비교한다 — 사진 한 장이 20만 번쯤 부른다.
 *
 * 다만 **큰 몫은 아니다.** 1,024명 정렬 한 번이 9.5ms → 8.5ms, 10% 남짓이다.
 * 나머지는 편집거리 표 계산이라 캐시로 줄지 않는다. 화면이 버벅이는 문제는
 * 캐시가 아니라 "언제 다시 재는지"로 풀어야 한다 — 이름 칸이 타자마다가
 * 아니라 칸을 벗어날 때 반영하는 이유다(`components/guild-admin/row-editor.tsx`).
 *
 * 순수 함수라 캐시가 틀릴 일이 없다. 다만 OCR이 만들어내는 쓰레기 문자열까지
 * 쌓이므로 상한을 둔다. */
const JAMO_CACHE = new Map<string, string>()
const JAMO_CACHE_LIMIT = 8192

/** 한글 음절을 자모로 푼다. 한글이 아닌 글자는 그대로 둔다. */
export function toJamo(value: string): string {
  const cached = JAMO_CACHE.get(value)
  if (cached !== undefined) return cached
  const result = decomposeJamo(value)
  // 상한을 넘으면 통째로 비운다. 가장 오래된 것을 고르는 비용이 아까울 만큼
  // 이 캐시는 단순하다 — 명단은 곧 다시 채워진다.
  if (JAMO_CACHE.size >= JAMO_CACHE_LIMIT) JAMO_CACHE.clear()
  JAMO_CACHE.set(value, result)
  return result
}

/** 음절마다 **첫 자음만** 뽑는다. 한글이 아닌 글자는 그대로 둔다.
 *
 * 초성 검색(`ㄱㅈ` → `겹줄`)에 쓴다. 자모로 다 풀면 `ㄱㅕㅂㅈㅜㄹ`이라
 * `ㄱㅈ`이 이어진 자리가 없어서 안 걸린다. */
export function toInitials(value: string): string {
  let out = ''
  for (const char of value) {
    const offset = char.charCodeAt(0) - HANGUL_BASE
    out += offset >= 0 && offset < HANGUL_COUNT ? CHOSEONG[Math.floor(offset / 588)] : char.toLowerCase()
  }
  return out
}

function decomposeJamo(value: string): string {
  let out = ''
  for (const char of normalizeConfusables(value)) {
    const offset = char.charCodeAt(0) - HANGUL_BASE
    if (offset >= 0 && offset < HANGUL_COUNT) {
      out += CHOSEONG[Math.floor(offset / 588)]
      out += JUNGSEONG[Math.floor((offset % 588) / 28)]
      const jong = JONGSEONG[offset % 28]
      if (jong !== ' ') out += jong
    } else {
      out += char.toLowerCase()
    }
  }
  return out
}

/** **눈으로 구별이 안 되는 자모끼리는 값을 덜 매긴다.**
 *
 * 모든 자모 치환을 똑같이 1로 세면, 한 획 차이로 잘못 읽은 이름이 전혀 다른
 * 이름과 같은 취급을 받는다. 실측 12장에서 실제로 걸린 예가
 * `모나레홈`(정답 `모나레옹`)이다 — `ㅎ↔ㅇ`와 `ㅁ↔ㅇ` 두 군데가 틀려
 * 자모 9개 중 2개 차이(유사도 0.78)가 되어 임계값 0.8에 못 미쳤다.
 *
 * 아래 묶음은 **실측 빈도**와 게임 폰트의 생김새를 같이 본 것이다. 12장에서
 * 센 치환 빈도는 `ㅁ→ㅇ` 25회가 압도적이었고, 그다음이 `ㅗ↔ㅛ`, `ㅈ↔ㅊ`,
 * `ㅎ↔ㅇ`, `ㅌ↔ㄷ`, `ㅍ↔ㅈ`이었다. 글자가 작아지면 `ㅗㅡㅜ`나 `ㅐㅒㅔㅖ`는
 * 사람도 잘 구별하지 못한다.
 *
 * 로마자 `I`·`l`·`1`이나 `O`·`0`은 여기가 아니라 위의 `CONFUSABLES`에서
 * 아예 같은 글자로 모아 버린다 — 게임 폰트에서 **생김새가 같아서** 덜
 * 매기는 정도로는 부족하다. */
const CONFUSABLE_GROUPS = [
  // 가로·세로획 하나 차이. 작은 글자에서 가장 많이 헷갈린다.
  'ㅗㅛㅜㅠㅡ',
  'ㅏㅑㅓㅕㅣ',
  'ㅐㅒㅔㅖ',
  // 복합모음은 **첫 획이 같은 것끼리만** 묶는다. `ㅘ`와 `ㅟ`를 한 묶음에
  // 뒀더니 `뛰기`(정답 `뛰김`)가 `똬기`로 붙었다 — 받침 하나 빠진 것보다
  // 모음 통째로 바뀐 걸 더 싸게 쳐버린 탓이다. 실측 12장에서 복합모음이
  // 헷갈린 사례는 한 건도 없었다.
  'ㅘㅙㅚ',
  'ㅝㅞㅟ',
  // 닫힌 네모와 동그라미. 실측에서 가장 잦았다.
  'ㅁㅇㅎ',
  // 획 하나가 더 있거나 없는 짝.
  'ㄱㅋㄲ',
  'ㄷㅌㄸㄹ',
  'ㅈㅊㅉㅍ',
  'ㅂㅃㅁ',
  'ㅅㅆ',
]

/** 헷갈리는 짝을 치환할 때 매길 값. 1이면 예전과 같고, 0이면 같은 글자 취급이다. */
const CONFUSABLE_COST = 0.5

const CONFUSABLE_OF = new Map<string, number>()
CONFUSABLE_GROUPS.forEach((group, index) => {
  for (const jamo of group) {
    // 한 자모가 여러 묶음에 들 수 있다(`ㅁ`은 `ㅁㅇㅎ`과 `ㅂㅃㅁ` 양쪽).
    // 먼저 만난 묶음을 쓰되, 아래 `substitutionCost`가 양쪽을 다 본다.
    if (!CONFUSABLE_OF.has(jamo)) CONFUSABLE_OF.set(jamo, index)
  }
})

/** 두 글자가 같은 묶음에 있는가. */
function isConfusable(a: string, b: string): boolean {
  return CONFUSABLE_GROUPS.some((group) => group.includes(a) && group.includes(b))
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0
  return isConfusable(a, b) ? CONFUSABLE_COST : 1
}

/** 편집 거리. 문자열이 짧아서(이름은 6글자, 자모로도 18자 이내) 단순 DP로 충분하다.
 *
 * 헷갈리는 자모끼리의 치환은 **1이 아니라 0.5**로 센다. 그래서 결과가 정수가
 * 아닐 수 있다. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost(a[i - 1], b[j - 1]),
      )
    }
    previous = current
  }
  return previous[b.length]
}

/** 자모 단위 편집 거리. 비율이 아니라 **틀린 자모 개수**다. */
export function jamoDistance(a: string, b: string): number {
  return editDistance(toJamo(a), toJamo(b))
}

/** 0~1 유사도. 자모로 풀어서 잰다. */
export function jamoSimilarity(a: string, b: string): number {
  const left = toJamo(a)
  const right = toJamo(b)
  if (left === right) return 1
  const longest = Math.max(left.length, right.length)
  if (longest === 0) return 0
  return 1 - editDistance(left, right) / longest
}

/** 입력이 **잘려 들어온** 경우를 위해, 후보의 앞부분만 잘라서 비교한다.
 *
 * 화면은 닉네임을 6글자로 끊어 보여주므로 `산섀님유챔5`가 `산섀님유..`로
 * 올 수 있다. 후보 전체와 비교하면 뒤쪽 글자 수만큼 손해를 봐서 정답이
 * 밀린다. */
export function truncatedAwareSimilarity(input: string, candidate: string): number {
  const full = jamoSimilarity(input, candidate)
  if (input.length >= candidate.length) return full
  const prefix = jamoSimilarity(input, candidate.slice(0, input.length))
  // 앞부분이 잘 맞으면 그걸 쓰되, 짧은 입력이 아무 이름에나 붙는 걸 막으려고
  // 살짝 깎는다 — 두 글자짜리 입력이 긴 이름을 "정확히" 맞혔다고 하면 곤란하다.
  return Math.max(full, prefix * 0.98)
}
