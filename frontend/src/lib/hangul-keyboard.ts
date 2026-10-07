/** 자판을 잘못 두고 쳐도 찾아낸다.
 *
 * 한글 닉네임을 찾으려다 영문 상태로 `tkstotla`를 치는 일은 흔하다. 반대로
 * 영문 닉네임을 찾으려다 한글 상태로 `ㅊ441ㅈ...`을 치기도 한다. 둘 다 그냥
 * 안 걸리면 사용자는 자기가 잘못 친 줄 모르고 "없나 보다" 한다.
 *
 * 두벌식 자판은 글쇠 하나가 자모 하나라 표만 있으면 된다. 음절로 **조합할
 * 필요도 없다** — 대조는 어차피 자모로 푼 문자열끼리 하기 때문이다
 * (`hangul-similarity.ts`의 `toJamo`).
 *
 * 비용은 검색어 하나당 글자 수만큼의 표 조회뿐이다. 이름마다 도는 게 아니라
 * 검색어에 한 번만 돌면 된다.
 */

import { toInitials, toJamo } from '@/lib/hangul-similarity'

/** 두벌식 자판. 글쇠 → 자모. */
const KEY_TO_JAMO: Record<string, string> = {
  q: 'ㅂ',
  w: 'ㅈ',
  e: 'ㄷ',
  r: 'ㄱ',
  t: 'ㅅ',
  y: 'ㅛ',
  u: 'ㅕ',
  i: 'ㅑ',
  o: 'ㅐ',
  p: 'ㅔ',
  a: 'ㅁ',
  s: 'ㄴ',
  d: 'ㅇ',
  f: 'ㄹ',
  g: 'ㅎ',
  h: 'ㅗ',
  j: 'ㅓ',
  k: 'ㅏ',
  l: 'ㅣ',
  z: 'ㅋ',
  x: 'ㅌ',
  c: 'ㅊ',
  v: 'ㅍ',
  b: 'ㅠ',
  n: 'ㅜ',
  m: 'ㅡ',
  Q: 'ㅃ',
  W: 'ㅉ',
  E: 'ㄸ',
  R: 'ㄲ',
  T: 'ㅆ',
  O: 'ㅒ',
  P: 'ㅖ',
}

const JAMO_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_JAMO).map(([key, jamo]) => [jamo, key.toLowerCase()]),
)

/** 영문 글쇠를 두벌식 자모로. 표에 없는 글자는 그대로 둔다. */
export function keysToJamo(value: string): string {
  let out = ''
  for (const char of value) out += KEY_TO_JAMO[char] ?? char
  return out
}

/** 자모를 두벌식 글쇠로. 표에 없는 글자는 그대로 둔다. */
export function jamoToKeys(value: string): string {
  let out = ''
  for (const char of value) out += JAMO_TO_KEY[char] ?? char
  return out
}

/** 이 이름이 검색어에 걸리는가.
 *
 * 네 갈래로 본다. 앞에서 걸리면 뒤는 보지 않는다.
 *
 * 1. 글자 그대로 (`라묘` ← `투`, `Kaslnel` ← `kas`)
 * 2. 자모로 풀어서 (`겹줄` ← `겨`)
 * 3. 초성만 (`겹줄` ← `ㄱㅈ`)
 * 4. 영문 상태로 친 한글 (`산섀님` ← `tkstOsla`, `겹줄` ← `rw`)
 * 5. 한글 상태로 친 영문 (`THAR` ← `ㅅㅗ`)
 */
export function searchMatches(name: string, query: string): boolean {
  const raw = query.trim()
  if (!raw) return true
  const needle = raw.toLowerCase()

  const plain = name.toLowerCase()
  if (plain.includes(needle)) return true

  const nameJamo = toJamo(name)
  const needleJamo = toJamo(needle)
  if (nameJamo.includes(needleJamo)) return true
  if (matchesInitials(name, needleJamo)) return true

  // **자판을 되돌리는 건 두 글자부터.** 한 글자로는 거의 다 걸린다 —
  // `ㄱ` 하나가 글쇠로는 `r`이라 `THAR`까지 딸려 온다.
  if (raw.length < MIN_CROSS_LENGTH) return false

  // 대소문자를 **여기서는 지키지 않으면 안 된다.** `ㅒ`는 `O`(shift+o)라,
  // 미리 소문자로 만들면 `ㅐ`가 되어 `산섀님`을 못 찾는다.
  if (!hasHangul(raw)) {
    const converted = keysToJamo(raw)
    return nameJamo.includes(converted) || matchesInitials(name, converted)
  }
  return plain.includes(jamoToKeys(toJamo(raw)))
}

/** 자판을 되돌려 볼 최소 길이. */
const MIN_CROSS_LENGTH = 2

function hasHangul(value: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(value)
}

/** 자음만 친 것으로 보이면 초성으로 견준다. */
function matchesInitials(name: string, jamo: string): boolean {
  return CONSONANTS_ONLY.test(jamo) && toInitials(name).includes(jamo)
}

const CONSONANTS_ONLY = /^[ㄱ-ㅎ]+$/
