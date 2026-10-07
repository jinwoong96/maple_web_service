/** 주간 점수 **표 한 장**을 다루는 순수 계산들.
 *
 * 2026-10-04 개편으로 점수는 서버가 아니라 브라우저와 CSV로 다룬다. 그러면서
 * 입력 화면이 바뀌었다.
 *
 * - 모든 열(닉네임·직업·레벨·직위·주간미션·지하수로·플래그레이스)을 읽고,
 *   **사용자가 고른 열만** 보여주고 저장한다.
 * - 중복을 **자동으로 지우지 않는다.** 올린 순서가 찍은 순서라고 보고, 앞
 *   장과 겹쳐 보이는 줄을 "중복 의심"으로 짚기만 한다.
 * - 지하수로 점수순으로 찍었는지 보고, 순서를 깨는 줄을 "점수 확인"으로 짚는다.
 *   점수순이 아니어도 다른 기능은 그대로 돈다.
 */

import { findJobToken } from '@/lib/candidate-profile'
import { snapToJob } from '@/lib/maple-jobs'
import { isScoreToken, parseScore } from '@/lib/guild-score'
import { guessColumns } from '@/lib/score-columns'
import type { Strip } from '@/lib/ocr-strip'

/** 닉네임 밖의 열. 순서가 곧 게임 표의 순서이자 CSV의 순서다. */
export const SCORE_COLUMNS = ['job', 'level', 'rank', 'weekly', 'underground', 'flag'] as const
export type ScoreColumn = (typeof SCORE_COLUMNS)[number]

export const COLUMN_LABEL: Record<ScoreColumn, string> = {
  job: '직업',
  level: '레벨',
  rank: '직위',
  weekly: '주간미션',
  underground: '지하수로',
  flag: '플래그레이스',
}

/** 숫자 열인가. 입력칸 모양과 정렬·걸러내기가 달라진다. */
export const NUMERIC_COLUMNS: ReadonlySet<ScoreColumn> = new Set(['level', 'weekly', 'underground', 'flag'])

/** 점수순을 볼 열. 촬영 안내가 이 열로 정렬하라고 한다. */
export const ORDER_COLUMN: ScoreColumn = 'underground'

/** 줄이 어디서 왔는지. 스크린샷이면 몇 번째 장인지, 아니면 붙여넣기·기록. */
export interface RowGroup {
  /** 같은 묶음끼리 같은 값. */
  key: string
  /** `2번째 스크린샷 · Maple_….jpg`처럼 사람이 볼 이름. */
  label: string
  /** 스크린샷이면 올린 순서(1부터). 중복 의심은 바로 앞 장과만 견준다. */
  shot: number | null
}

/** 사람이 직접 넣은 줄의 묶음. OCR이 놓친 줄(장 맨 아랫줄 등)을 채운다. 경계(장이 바뀌는 곳)로
 * 치지 않고, 점수 순서 검사도 이 묶음 안에서만 한다. */
export const MANUAL_GROUP: RowGroup = { key: 'manual', label: '직접 추가한 줄', shot: null }

/** 직접 넣은 줄을 **수로 점수순 자리로** 옮긴다(2026-10-04 사용자 요청).
 *
 * 스크린샷 줄(직접 추가 묶음 밖, 점수가 있는 줄) 중 이 줄보다 점수가 **처음으로 낮은** 줄 바로 앞에
 * 넣는다. 묶음은 바로 앞 줄의 것을 따른다 — 빠지는 줄은 대개 장 맨 아랫줄이라, 두 장 사이에 들어가면
 * 앞 장 끝에 붙는 게 맞다. 더 낮은 줄이 없으면 마지막 스크린샷 줄 뒤. 옮길 수 없으면(점수가 없거나
 * 스크린샷 줄이 없음) `null`. */
export function placeByScore(
  rows: readonly SheetRow[],
  movingId: string,
  scoreOf: (row: SheetRow) => number | null,
): SheetRow[] | null {
  const moving = rows.find((row) => row.id === movingId)
  const value = moving ? scoreOf(moving) : null
  if (!moving || value === null) return null
  const rest = rows.filter((row) => row.id !== movingId)
  const isShot = (row: SheetRow) => row.group.key !== MANUAL_GROUP.key
  let at = rest.findIndex((row) => {
    if (!isShot(row)) return false
    const score = scoreOf(row)
    return score !== null && score < value
  })
  let group: RowGroup
  if (at >= 0) {
    const before = rest[at - 1]
    group = before && isShot(before) ? before.group : rest[at].group
  } else {
    const last = rest.findLastIndex(isShot)
    if (last < 0) return null
    at = last + 1
    group = rest[last].group
  }
  return [...rest.slice(0, at), { ...moving, group, manual: true }, ...rest.slice(at)]
}

export interface SheetRow {
  /** 화면이 바뀌어도 그대로인 열쇠. 고친 값·그림이 여기에 매달린다.
   *
   * 예전에는 **줄 글자**를 열쇠로 썼다. 겹친 줄을 자동으로 지우던 때는 같은
   * 글자의 줄이 둘일 일이 없었지만, 이제는 중복을 남겨 두므로 같은 글자의 줄이
   * 흔하다(앞 장 끝 `아로`와 다음 장 첫 `아로`). 글자로 매달면 한쪽을 고치면
   * 다른 쪽도 같이 바뀐다. */
  id: string
  group: RowGroup
  /** 닉네임 칸에서 읽은 글자 그대로. 명단 대조는 화면에서 한다. */
  read: string
  /** 사람이 직접 넣은 줄인가. 칸을 다 채워 스크린샷 묶음 안으로 옮긴 뒤에도 표시해 둔다. */
  manual?: boolean
  /** 열마다 읽은 값(글자). 못 읽었으면 빈 문자열. */
  values: Record<ScoreColumn, string>
  /** 칸마다 스크린샷에서 자른 그림. 붙여넣거나 기록에서 연 줄은 비어 있다. */
  strips: Partial<Record<'name' | ScoreColumn, Strip>>
}

export function emptyValues(): Record<ScoreColumn, string> {
  return { job: '', level: '', rank: '', weekly: '', underground: '', flag: '' }
}

let nextId = 0
export function newRowId(): string {
  nextId += 1
  return `row-${Date.now().toString(36)}-${nextId}`
}

/** 숫자 열 이름 → 값으로 가려낸 종류. `score-columns.ts`가 쓰는 이름과 잇는다. */
const KIND_TO_COLUMN: Record<string, ScoreColumn> = {
  level: 'level',
  'weekly-mission': 'weekly',
  underground: 'underground',
  'flag-race': 'flag',
}

function isNumericText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed !== '' && /^[\d,]+$/.test(trimmed)
}

/** OCR이 나눈 열이 각각 무엇인지 정한다. 0번은 닉네임이다.
 *
 * **숫자 열은 값으로 가린다**(`guessColumns`) — 레벨은 1~300, 주간미션은 0~10,
 * 지하수로는 자릿수가 크고, 플래그레이스는 0 아니면 1,000 단위다. **글자 열은
 * 자리로 가린다** — 게임 표는 `닉네임 · 직업 · 레벨 · 직위 · …`라서 레벨 열
 * 왼쪽 글자 열이 직업, 오른쪽이 직위다. 레벨 열을 못 찾으면 글자 열을 왼쪽부터
 * 직업·직위로 본다. */
export function classifyColumns(rows: readonly (readonly string[])[]): (ScoreColumn | null)[] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const mapping: (ScoreColumn | null)[] = Array.from({ length: width }, () => null)
  if (width <= 1) return mapping

  const numericColumns: number[] = []
  const textColumns: number[] = []
  for (let index = 1; index < width; index++) {
    const values = rows.map((row) => (row[index] ?? '').trim()).filter(Boolean)
    if (values.length === 0) continue
    const numeric = values.filter(isNumericText).length
    if (numeric / values.length >= 0.6) numericColumns.push(index)
    else textColumns.push(index)
  }

  // guessColumns는 숫자만 담은 표를 받는다. 열 번호를 맞추려고 숫자 열만 모은다.
  const guesses = guessColumns(
    rows.map((row) => ({ cells: numericColumns.map((index) => (row[index] ?? '').trim()) })),
  )
  for (const guess of guesses) {
    const column = KIND_TO_COLUMN[guess.kind]
    if (column) mapping[numericColumns[guess.index]] = column
  }

  const levelAt = mapping.indexOf('level')
  const left = textColumns.filter((index) => levelAt < 0 || index < levelAt)
  const right = textColumns.filter((index) => levelAt >= 0 && index > levelAt)
  if (levelAt >= 0) {
    if (left.length > 0) mapping[left[left.length - 1]] = 'job'
    if (right.length > 0) mapping[right[0]] = 'rank'
  } else {
    if (left[0] !== undefined) mapping[left[0]] = 'job'
    if (left[1] !== undefined) mapping[left[1]] = 'rank'
  }
  return mapping
}

/** 붙여넣은 표를 줄로 만든다.
 *
 * 탭으로 나뉜 줄(엑셀·OCR 결과)은 **첫 칸을 비어 있어도 닉네임 자리로 지킨다.**
 * 앞 탭까지 지우면 레벨이 이름 자리로 올라가 숫자가 한 칸씩 밀린다. 탭이 없으면
 * 공백으로 나누고, 숫자는 값으로, 직업은 직업 명단으로, 남은 글자를 직위로 본다. */
export function rowsFromPaste(text: string, group: RowGroup): SheetRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const tokenized = lines.map((line) => {
    if (line.includes('\t')) {
      const [name, ...rest] = line.split('\t')
      return [name.trim(), ...rest.flatMap((cell) => cell.split(/\s+/)).filter(Boolean)]
    }
    return line.trim().split(/\s+/).filter(Boolean)
  })

  // 숫자만 모아 값으로 가린다. 줄마다 숫자 개수가 같다는 보장이 없어 순번으로 맞춘다.
  const numbers = tokenized.map((tokens) => tokens.slice(1).filter(isScoreToken))
  const guesses = guessColumns(numbers.map((cells) => ({ cells })))

  return tokenized.map((tokens, index) => {
    const values = emptyValues()
    const rest = tokens.slice(1)
    const jobToken = findJobToken(rest)
    // 직업은 명단의 이름으로 되돌린다(`윈드브래미커` → `윈드브레이커`).
    values.job = snapToJob(jobToken) ?? jobToken
    for (const guess of guesses) {
      const column = KIND_TO_COLUMN[guess.kind]
      if (column) values[column] = numbers[index][guess.index] ?? ''
    }
    values.rank = rest.find((token) => !isScoreToken(token) && token !== jobToken) ?? ''
    return { id: newRowId(), group, read: tokens[0] ?? '', values, strips: {} }
  })
}

/** 숫자 칸 값을 게임 표처럼 쉼표 넣은 모양으로. 숫자 칸이 아니면 그대로. */
export function formatCell(value: string, numeric: boolean): string {
  if (!numeric) return value
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

/** 숫자 칸 값을 숫자로. 빈 칸·이상한 값은 `null`. */
export function numberOf(text: string): number | null {
  return text.trim() === '' ? null : parseScore(text)
}

/** **점수순으로 찍었는지** 보고, 순서를 깨는 줄을 찾는다.
 *
 * 장마다 따로 본다 — 다음 장은 앞 장 끝보다 조금 앞에서 시작해서, 장 경계에서는
 * 순서가 언제나 한 번 뒤로 돈다. 앞뒤 값이 있는 이웃 쌍의 8할 이상이 내림차순
 * (동점 포함)이면 점수순으로 본다. 점수순이 아니면 아무것도 짚지 않는다 — 다른
 * 기능은 그대로 돈다.
 *
 * 순서가 깨진 쌍(앞 < 뒤)마다 **어느 쪽이 틀렸는지** 고른다.
 *
 * - 사람이 "맞음"으로 확인한 칸(`confirmed`)은 믿는다. 한쪽이 확인됐으면 **다른 쪽**이 틀린 것이다.
 *   예전엔 이걸 안 봐서, 짚은 칸이 사실 맞는 값이라 "맞음"을 누르면 깨진 쌍이 남았는데도 "의심 칸
 *   없음"으로 끝났다(2026-10-04 사용자 발견 — 진짜 틀린 칸은 그 이웃이었다).
 * - 둘 다 확인 전이면, **그 칸 하나만 빼면 순서가 맞는지**로 가른다. 앞을 빼면 앞앞 ≥ 뒤가 되는가,
 *   뒤를 빼면 앞 ≥ 뒤뒤가 되는가. 한쪽만 되면 그쪽, 둘 다 되거나 둘 다 안 되면 **둘 다** 짚는다 —
 *   `290 → 295 → 280`처럼 어느 쪽인지 숫자만으로는 모를 때 한쪽만 짚으면 맞는 칸을 짚을 수 있다.
 *   장 첫 줄(앞앞이 없음)은 빼면 늘 맞으니 앞쪽이 후보가 된다.
 * - 둘 다 확인된 쌍은 `conflicts`로 따로 돌려준다(칸 값이 아니라 줄 순서가 이상한 것). */
export function scoreOrderCheck(
  rows: readonly { groupKey: string; value: number | null }[],
  confirmed: ReadonlySet<number> = new Set(),
): { sorted: boolean; checked: number; suspects: Set<number>; conflicts: [number, number][] } {
  const byGroup = new Map<string, number[]>()
  rows.forEach((row, index) => {
    if (row.value === null) return
    const list = byGroup.get(row.groupKey)
    if (list) list.push(index)
    else byGroup.set(row.groupKey, [index])
  })

  let pairs = 0
  let ordered = 0
  for (const indexes of byGroup.values()) {
    for (let i = 1; i < indexes.length; i++) {
      pairs += 1
      if (rows[indexes[i - 1]].value! >= rows[indexes[i]].value!) ordered += 1
    }
  }
  const sorted = pairs >= 5 && ordered / pairs >= 0.8
  const suspects = new Set<number>()
  const conflicts: [number, number][] = []
  if (!sorted) return { sorted, checked: pairs, suspects, conflicts }

  for (const indexes of byGroup.values()) {
    const valueAt = (i: number) => (i >= 0 && i < indexes.length ? rows[indexes[i]].value! : null)
    for (let i = 1; i < indexes.length; i++) {
      const before = valueAt(i - 1)!
      const after = valueAt(i)!
      if (before >= after) continue
      const front = indexes[i - 1]
      const back = indexes[i]
      const frontOk = confirmed.has(front)
      const backOk = confirmed.has(back)
      if (frontOk && backOk) {
        conflicts.push([front, back])
        continue
      }
      if (frontOk) {
        suspects.add(back)
        continue
      }
      if (backOk) {
        suspects.add(front)
        continue
      }
      const earlier = valueAt(i - 2)
      const later = valueAt(i + 1)
      const dropFront = earlier === null || earlier >= after
      const dropBack = later === null || before >= later
      if (dropFront && !dropBack) suspects.add(front)
      else if (dropBack && !dropFront) suspects.add(back)
      else {
        suspects.add(front)
        suspects.add(back)
      }
    }
  }
  return { sorted, checked: pairs, suspects, conflicts }
}

/** 겹쳐 찍혀 **두 번 들어온 것 같은** 줄을 찾는다. 줄 번호 → 짝(먼저 나온 줄).
 *
 * 지우지 않고 짚기만 한다. 두 가지를 본다.
 *
 * - **같은 이름이 앞에 있다.** 한 표에 같은 캐릭터는 한 번만 나온다. 겹쳐 찍은
 *   중복이거나, 둘 중 하나가 남의 이름을 달고 있다 — 어느 쪽이든 사람이 봐야 한다.
 * - **바로 앞 장에 읽은 글자와 숫자가 똑같은 줄이 있다.** 이름을 못 정한 줄도
 *   여기서 걸린다. 앞 장과만 견준다 — 동점이 흔해서(한 화면에 304,130점이 4명)
 *   멀리 떨어진 줄끼리 숫자로 짝지으면 헛짚는다. */
export function duplicateSuspects(
  rows: readonly { group: RowGroup; name: string | null; read: string; numbers: string }[],
): Map<number, number> {
  const result = new Map<number, number>()
  const firstByName = new Map<string, number>()
  rows.forEach((row, index) => {
    if (row.name !== null) {
      const first = firstByName.get(row.name)
      if (first !== undefined) {
        result.set(index, first)
        return
      }
      firstByName.set(row.name, index)
    }
    if (row.group.shot === null || row.group.shot <= 1 || !row.numbers) return
    // 장 끝에 반쯤 걸려 이름을 못 읽은 줄도 있어서, 한쪽 이름이 비었으면 숫자만 본다.
    const read = row.read.trim()
    const previous = rows.findIndex(
      (other) =>
        other.group.shot === row.group.shot! - 1 &&
        other.numbers === row.numbers &&
        (!read || !other.read.trim() || other.read.trim() === read),
    )
    if (previous >= 0) result.set(index, previous)
  })
  return result
}

/** 중복 의심에 쓸 숫자 지문. 숫자 칸을 다 붙인다. 숫자가 하나도 없으면 빈 값. */
export function numberSignature(values: Record<ScoreColumn, string>): string {
  const numbers = SCORE_COLUMNS.filter((column) => NUMERIC_COLUMNS.has(column)).map((column) =>
    values[column].replace(/[^\d]/g, ''),
  )
  return numbers.every((value) => !value) ? '' : numbers.join('|')
}
