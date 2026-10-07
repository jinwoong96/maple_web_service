/** OCR 단어 상자를 **표의 열**로 되돌린다.
 *
 * tesseract가 주는 줄 텍스트를 공백으로 쪼개면 두 가지로 망가진다.
 *
 * - 화면 왼쪽 사이드바 버튼(`< 길드캐슬`)이 표의 행과 같은 높이에 있어서
 *   행 맨 앞에 붙는다. 그러면 첫 토큰이 `<`가 되어 닉네임을 잃는다.
 * - 닉네임이 글자 단위 단어로 쪼개져(`구@372 구@396 꺼@420 리@444`)
 *   첫 토큰이 한 글자가 된다.
 *
 * 반면 **x 좌표는 흔들리지 않는다** — 실측에서 닉네임은 항상 x≈370,
 * 지하수로 점수는 x≈1065에서 시작했다. 그래서 좌표로 열을 잡는다.
 * 실측 12장 기준 이 방식이 줄 텍스트 파싱보다 자동 처리율을 65% → 71%로
 * 올렸고, 무엇보다 **행 개수가 실제와 정확히 맞는다**(38줄 → 38행).
 */

import { looksLikeJobColumn } from '@/lib/maple-jobs'

interface OcrWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

interface OcrLine {
  words: OcrWord[]
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/** 인식 결과에서 필요한 부분만. tesseract 타입 전체를 끌어오지 않는다. */
export interface OcrPage {
  blocks: { paragraphs: { lines: OcrLine[] }[] }[] | null
}

export interface OcrRow {
  /** 행의 세로 중심. 같은 이미지를 두 번 읽었을 때 행을 짝짓는 데 쓴다. */
  y: number
  /** 열 순서대로 정리한 칸. 첫 칸이 닉네임이다. */
  cells: string[]
}

/** 간격 임계값을 **글자 높이의 배수**로 잡는다.
 *
 * 절대 픽셀로 박아두면 스크린샷마다 깨진다. 게임 창 크기, 모니터 해상도,
 * 화면 배율(125%·150%)이 사람마다 다르고, 표본 12장이 비슷했던 건 한 사람이
 * 같은 환경에서 찍었기 때문이다.
 *
 * 글자 높이는 그 모든 배율을 한 번에 담고 있다 — 창이 1.5배면 글자도 1.5배고
 * 열 간격도 1.5배다. 그래서 **읽어낸 글자 높이로 나눠** 비율로 환산한다.
 * 배수는 실측으로 맞췄다. 표본 12장에서 잘 돌던 절대값이 36px·60px이었고,
 * 같은 이미지에서 잰 글자 높이 중앙값이 20px이라 1.8배·3.0배가 된다.
 * 짐작으로 1.5·2.5를 넣었더니 간격이 좁아 열이 과하게 쪼개졌고, 자동
 * 처리율이 85.5% → 77.5%로 떨어졌다.
 */
const CELL_GAP_RATIO = 1.8
const COLUMN_GAP_RATIO = 3

/** 글자 높이를 못 잴 때 쓸 값(전처리 2배를 거친 픽셀 기준). */
const FALLBACK_GLYPH_HEIGHT = 20

/** 같은 행의 조각으로 볼 세로 겹침 비율(둘 중 낮은 줄 높이 대비). */
const ROW_MERGE_RATIO = 0.5

/** 이만큼의 행에 나타나야 진짜 열로 본다. 사이드바 버튼을 걸러낸다. */
const MIN_ROW_RATIO = 0.3

/** 닉네임 열이려면 값이 이만큼은 서로 달라야 한다.
 *
 * **이게 제일 확실한 판별자다.** 한 화면에 같은 닉네임이 두 번 나올 수 없어
 * 고유값 비율이 1에 가깝다. 반면 직위(`은결`/`단원`)나 레벨(`295`/`296`)은
 * 여러 행이 같고, 직업도 꽤 겹친다(실측 15/19 = 0.79). 0.9로 두면 직업까지
 * 걸러진다.
 *
 * 잘못 읽힌 닉네임은 오히려 **더** 고유해지므로, 인식이 나빠도 이 값은
 * 떨어지지 않는다. */
const NAME_COLUMN_MIN_DISTINCT = 0.9

/** 고유값 비율이 뜻을 가지려면 이만큼의 행은 있어야 한다. */
const NAME_COLUMN_MIN_ROWS = 5

/** 닉네임 열이라면 이만큼의 행에는 값이 있어야 한다.
 *
 * 화면 왼쪽의 길드 메뉴는 표의 일부가 아니라 몇 줄에만 걸린다(실측 4/13 =
 * 0.31). 닉네임은 대체로 더 많지만 **안 읽히는 줄이 꽤 생긴다** — 실측에서
 * 11/19 = 0.58까지 떨어졌다. 그래서 이 값만으로 가르려 하면 안 된다. 여기서는
 * 메뉴만 걸러낼 만큼만 잡고, 실제 판별은 위의 고유값 비율이 한다. */
const NAME_COLUMN_MIN_PRESENCE = 0.4

/** 닉네임 열이라면 이만큼은 숫자가 아니어야 한다. */
const NAME_COLUMN_MIN_TEXT = 0.6

/** 칸 사이를 잇는 구분선 잡음. 그대로 두면 이름과 직업이 한 칸으로 섞인다. */
const CONNECTOR = /^[_ㆍ·|\-—]+$/

/** 한 줄의 단어들을 칸으로 묶는다.
 *
 * `boundaries`를 주면 **열 경계를 넘어서는 붙이지 않는다.** 구분선이 잡음으로
 * 읽히면 `반도제노메3마크메미지(불,독)295`처럼 세 열이 한 칸이 되어 닉네임
 * 칸이 비어 버린다. */
function toCells(
  words: readonly OcrWord[],
  gap: number,
  boundaries: readonly number[] | null,
): { text: string; x0: number; x1: number }[] {
  const cells: { text: string; x0: number; x1: number }[] = []
  for (const word of words) {
    const text = word.text.trim()
    if (!text || CONNECTOR.test(text)) continue
    const last = cells[cells.length - 1]
    const crosses =
      last !== undefined &&
      boundaries !== null &&
      boundaries.some((edge) => last.x1 <= edge && word.bbox.x0 >= edge)
    if (last !== undefined && !crosses && word.bbox.x0 - last.x1 <= gap) {
      last.text += text
      last.x1 = word.bbox.x1
    } else {
      cells.push({ text, x0: word.bbox.x0, x1: word.bbox.x1 })
    }
  }
  return cells
}

/** 정렬한 값들을 큰 틈에서 끊어 묶는다. */
function clusterBy(values: readonly number[], gap: number): { center: number; count: number }[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const groups: number[][] = []
  let current: number[] = [sorted[0]]
  for (const value of sorted.slice(1)) {
    if (value - current[current.length - 1] > gap) {
      groups.push(current)
      current = []
    }
    current.push(value)
  }
  groups.push(current)
  return groups.map((group) => ({
    center: group.reduce((sum, value) => sum + value, 0) / group.length,
    count: group.length,
  }))
}

/** 숫자만 있는 칸인가. 데이터 행을 골라내는 데 쓴다. */
function isNumeric(text: string): boolean {
  return /^[\d,.]+$/.test(text)
}

/** 이 화면의 글자 높이. 간격 임계값의 기준자가 된다.
 *
 * 중앙값을 쓴다 — 표 밖의 큰 제목이나 잡음으로 잡힌 한두 글자가 평균을
 * 끌고 가면 안 되기 때문이다. */
function medianGlyphHeight(words: readonly OcrWord[]): number {
  const heights = words
    .map((word) => word.bbox.y1 - word.bbox.y0)
    .filter((height) => height > 0)
    .sort((a, b) => a - b)
  if (heights.length === 0) return FALLBACK_GLYPH_HEIGHT
  return heights[Math.floor(heights.length / 2)]
}

/** 열 복원 과정을 들여다볼 수 있게 한 결과.
 *
 * 개발용 OCR 점검 페이지(`/dev/ocr`)가 이걸로 어느 글자가 어느 열로 갔는지를
 * 그려 보여 준다. 다른 사람의 스크린샷에서 틀어졌을 때 **어느 단계에서**
 * 틀어졌는지 보려면 이 중간값이 있어야 한다. */
export interface TableInspection {
  rows: OcrRow[]
  /** 첫 열이 닉네임 열로 보이는가.
   *
   * 닉네임이 너무 안 읽혀 그 열이 통째로 사라지면 **오른쪽 열들이 왼쪽으로
   * 밀려** 직위나 레벨이 이름 자리에 온다. 그대로 두면 `은결`(직위)이 명단의
   * `은별`(닉네임)로 보정돼 **엉뚱한 사람에게 점수가 붙는다** — 실측 12장에서
   * 15행이 그랬다. 이럴 땐 이름 칸을 비워 "못 맞춘 줄"로 내보낸다. 점수는
   * 살아 있으니 사람이 스크린샷을 보고 직접 짝지으면 된다. */
  nameColumnFound: boolean
  /** 이 화면의 글자 높이. 모든 간격 임계값의 기준자다. */
  glyphHeight: number
  cellGap: number
  columnGap: number
  /** 찾아낸 열의 중심 x 좌표와 등장 횟수. */
  columns: { center: number; count: number }[]
  /** 닉네임 열로 고른 자리(왼쪽 것을 버리기 전 기준). 못 고르면 `-1`.
   *
   * 화면 왼쪽 메뉴가 열로 잡혀 이름 열을 밀어내는 일이 있어서, 어디를
   * 골랐는지 볼 수 있어야 한다. */
  nameIndex: number
  /** 버리기 전의 열들. 무엇이 왜 빠졌는지 보려면 이게 있어야 한다. */
  columnsBefore: { center: number; count: number }[]
  /** 칸 하나하나가 어느 열로 갔는지. 오버레이용. */
  cellBoxes: {
    text: string
    x0: number
    x1: number
    y0: number
    y1: number
    /** 배정된 열. 어느 열에도 못 붙으면 `null`. */
    column: number | null
  }[]
}

/** 이만큼도 못 읽었으면 표를 복원했다고 보지 않는다.
 *
 * `findNameColumn`이 닉네임 열을 가려내는 데 필요한 최소 행 수와 같은 값이다.
 * 그보다 적으면 "닉네임 열을 못 찾았다"는 판정 자체가 안 선다. */
const MIN_PLAUSIBLE_ROWS = NAME_COLUMN_MIN_ROWS

/** 이 결과를 **제대로 못 읽은 것**으로 볼 것인가.
 *
 * 두 가지다 — 닉네임 열을 못 찾았거나, 행이 터무니없이 적거나.
 *
 * 뒤쪽이 실측에서 놓치던 경우다. 한 장(`길드A_닉네임순_1366/…205043.jpg`)에서
 * tesseract가 단어를 13개만 뱉어 행이 3개만 남았는데, 행이 5개도 안 되니
 * `findNameColumn`이 판정을 포기하고 0번 열을 그대로 돌려줬다. 그래서 "닉네임
 * 열을 찾았다"로 통과했고, 다시 읽어볼 기회도 없이 16행이 통째로 사라졌다.
 * **전처리한 그림은 사람 눈에 멀쩡했다** — 읽기를 실패한 것이지 그림이 나쁜
 * 게 아니다. */
export function looksUnderread(inspection: TableInspection): boolean {
  return !inspection.nameColumnFound || inspection.rows.length < MIN_PLAUSIBLE_ROWS
}

/** 인식 결과를 표의 행으로 바꾼다. */
export function toRows(page: OcrPage): OcrRow[] {
  return inspectTable(page).rows
}

/** `toRows`와 같은 일을 하면서 중간값까지 돌려준다. */
export function inspectTable(page: OcrPage): TableInspection {
  const raw: RawLine[] = []
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words.filter((word) => word.text.trim())
        if (words.length === 0) continue
        raw.push({ y0: line.bbox.y0, y1: line.bbox.y1, words })
      }
    }
  }
  raw.sort((a, b) => a.y0 - b.y0)

  const glyphHeight = medianGlyphHeight(raw.flatMap((line) => line.words))
  const metrics = {
    glyphHeight,
    cellGap: glyphHeight * CELL_GAP_RATIO,
    columnGap: glyphHeight * COLUMN_GAP_RATIO,
  }

  // 한 번만 묶는다. 이름 열 왼쪽 글자를 걷어내고 **다시 묶는** 것도 해봤는데
  // 오히려 나빠졌다(54~66% → 45~72%). 피해는 여기가 아니라 **tesseract의
  // 레이아웃 분석 안에서** 이미 일어나기 때문이다 — 글자를 나중에 빼봐야
  // 잘못 나뉜 줄은 그대로다. 그래서 잘라내기는 OCR 전에 한다
  // (`ocr-image.ts`의 메뉴 잘라내기).
  const built = buildTable(raw, metrics)
  const nameIndex = findNameColumn(built.rows, built.columns.length)
  return finish(built, metrics, nameIndex, built.columns)
}

interface RawLine {
  y0: number
  y1: number
  words: OcrWord[]
}

interface TableMetrics {
  glyphHeight: number
  cellGap: number
  columnGap: number
}

interface BuiltTable {
  rows: OcrRow[]
  columns: { center: number; count: number }[]
  cellBoxes: TableInspection['cellBoxes']
}

/** 줄 합치기 → 칸 나누기 → 열 묶기 → 행 만들기. */
function buildTable(raw: readonly RawLine[], metrics: TableMetrics): BuiltTable {
  const { cellGap, columnGap } = metrics

  // 같은 행의 조각인지는 **세로로 겹치는지**로 본다. tesseract가 한 행을
  // 여러 줄로 쪼개 놓는 일이 있어서다.
  //
  // 다만 **기준 범위를 넓히지 않는다.** 합칠 때마다 범위를 키우면 연쇄가
  // 생긴다 — 표 밖의 글자가 두 행 사이에 걸쳐 있으면 그걸 다리 삼아 위아래
  // 행이 통째로 한 줄이 된다. 실제로 `계피사탕조아`이 옆 줄과 섞여
  // `계ATED피사탕조아`이 됐다. 처음 줄의 범위를 그대로 두면 건너가지 못한다.
  const merged: (RawLine & { anchorY0: number; anchorY1: number })[] = []
  for (const line of raw) {
    const last = merged[merged.length - 1]
    const overlap = last ? Math.min(last.anchorY1, line.y1) - Math.max(last.anchorY0, line.y0) : 0
    const height = last ? Math.min(line.y1 - line.y0, last.anchorY1 - last.anchorY0) : 0
    if (last && overlap > height * ROW_MERGE_RATIO) {
      last.words = [...last.words, ...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0)
      last.y0 = Math.min(last.y0, line.y0)
      last.y1 = Math.max(last.y1, line.y1)
    } else {
      merged.push({ ...line, anchorY0: line.y0, anchorY1: line.y1 })
    }
  }

  const linesOf = (boundaries: readonly number[] | null) =>
    merged
      .map((line) => ({ cells: toCells(line.words, cellGap, boundaries), line }))
      // 숫자 칸이 둘 이상인 줄만 데이터 행으로 본다 — 머리글과 잡음을 걸러낸다.
      .filter(({ cells }) => cells.filter((cell) => isNumeric(cell.text)).length >= 2)

  const first = linesOf(null)
  if (first.length === 0) return { rows: [], columns: [], cellBoxes: [] }

  const columns = clusterBy(
    first.flatMap(({ cells }) => cells.map((cell) => (cell.x0 + cell.x1) / 2)),
    columnGap,
  ).filter((column) => column.count >= first.length * MIN_ROW_RATIO)
  if (columns.length === 0) return { rows: [], columns: [], cellBoxes: [] }

  // 열을 알았으니 칸을 다시 나눈다. 첫 패스는 경계를 몰라서 붙여 버린다.
  const boundaries = columns
    .slice(1)
    .map((column, index) => (columns[index].center + column.center) / 2)

  const cellBoxes: TableInspection['cellBoxes'] = []
  const rows = linesOf(boundaries).map(({ cells, line }) => {
    const row = Array.from({ length: columns.length }, () => '')
    for (const cell of cells) {
      const center = (cell.x0 + cell.x1) / 2
      let best = -1
      let bestDistance = Infinity
      columns.forEach((column, index) => {
        const distance = Math.abs(center - column.center)
        if (distance < bestDistance) {
          bestDistance = distance
          best = index
        }
      })
      // 어느 열에도 가깝지 않으면 표 밖의 글자다.
      const assigned = best >= 0 && bestDistance <= columnGap * 1.5 ? best : null
      if (assigned !== null) row[assigned] += cell.text
      cellBoxes.push({
        text: cell.text,
        x0: cell.x0,
        x1: cell.x1,
        y0: line.y0,
        y1: line.y1,
        column: assigned,
      })
    }
    return { y: (line.y0 + line.y1) / 2, cells: row }
  })

  return { rows, columns, cellBoxes }
}

/** 고른 이름 열을 0번으로 맞추고 결과를 담는다. */
function finish(
  built: BuiltTable,
  metrics: TableMetrics,
  nameIndex: number,
  columnsBefore: { center: number; count: number }[],
): TableInspection {
  const rows = built.rows
  const columns = built.columns.map((column) => ({ ...column }))
  const cellBoxes = built.cellBoxes
  if (nameIndex > 0) {
    for (const row of rows) row.cells = row.cells.slice(nameIndex)
    columns.splice(0, nameIndex)
    for (const box of cellBoxes) {
      box.column = box.column === null ? null : box.column - nameIndex
      if (box.column !== null && box.column < 0) box.column = null
    }
  }
  const nameColumnFound = nameIndex >= 0
  if (!nameColumnFound) {
    for (const row of rows) row.cells[0] = ''
  }
  return {
    rows,
    nameColumnFound,
    nameIndex,
    columnsBefore: columnsBefore.map((column) => ({ ...column })),
    glyphHeight: metrics.glyphHeight,
    cellGap: metrics.cellGap,
    columnGap: metrics.columnGap,
    columns,
    cellBoxes,
  }
}

/** 어느 열이 닉네임 열인가. 못 고르면 `-1`.
 *
 * 세 가지를 같이 본다. 하나만으로는 갈리지 않는다.
 *
 * - **거의 모든 행에 값이 있다.** 길드 메뉴는 표의 일부가 아니라서 몇 줄에만
 *   걸린다(실측 4/13). 닉네임은 거의 모든 행에 있다(11/13).
 * - **값이 서로 다르다.** 한 화면에 같은 닉네임이 두 번 나올 수 없다. 반면
 *   직위(`은결`·`대장`)는 여러 행이 같은 값이다.
 * - **숫자가 아니다.** 레벨·점수 열을 이름으로 잘못 고르지 않게.
 *
 * 조건을 만족하는 것 중 **가장 왼쪽**을 고른다. 직업 열도 셋을 통과하지만
 * 닉네임 열이 언제나 그 왼쪽이기 때문이다. 다만 닉네임을 통째로 못 읽으면
 * 직업 열이 가장 왼쪽이 되어 **직업 이름이 닉네임 자리로 들어온다**(실측
 * 1장). 그래서 직업 명단(`maple-jobs.ts`)과 대보고 직업 열이면 건너뛴다 —
 * OCR이 직업 이름도 틀리게 읽으므로 글자가 같은지가 아니라 닮았는지로 본다.
 *
 * 등장 비율만 올려서 해결하려다 말았다 — 플래그레이스 열도 5/13처럼 드물게
 * 잡히는 때가 있어서, 문턱을 올리면 **진짜 점수 열이 같이 죽는다.** */
function findNameColumn(rows: readonly OcrRow[], width: number): number {
  if (rows.length < NAME_COLUMN_MIN_ROWS) return 0
  for (let index = 0; index < width; index++) {
    const values = rows.map((row) => row.cells[index] ?? '').filter(Boolean)
    if (values.length / rows.length < NAME_COLUMN_MIN_PRESENCE) continue
    if (new Set(values).size / values.length < NAME_COLUMN_MIN_DISTINCT) continue
    const numeric = values.filter((value) => isNumeric(value)).length
    if (numeric / values.length > 1 - NAME_COLUMN_MIN_TEXT) continue
    // 직업 열이면 닉네임 열이 아니다. 여기까지 왔다는 건 왼쪽에 닉네임 열이
    // 없었다는 뜻이라, 건너뛰면 결국 "닉네임 열 없음"으로 끝난다 — 그 편이
    // 엉뚱한 사람에게 점수를 붙이는 것보다 낫다.
    if (looksLikeJobColumn(values)) continue
    // 여기까지 통과한 것 중 **가장 왼쪽**이 닉네임 열이다. 직업 열도 글자이고
    // 값도 제법 다르지만, 닉네임은 언제나 그 왼쪽에 있다.
    return index
  }
  return -1
}
