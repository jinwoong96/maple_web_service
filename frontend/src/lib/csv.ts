/** 표를 CSV로 내보낸다.
 *
 * **엑셀 대신 CSV를 쓴다.** `.xlsx`는 ZIP 컨테이너 안에 XML 여러 개를 넣는
 * 형식이라 라이브러리(SheetJS 등, 수백 KB)가 필요하다. 지금 필요한 건
 * "숫자 표 한 장을 엑셀에서 열어 손보는 것"이고, 그건 CSV로 충분하다.
 * 시트 여러 장이나 서식이 필요해지면 그때 라이브러리를 들이면 된다.
 */

/** 엑셀이 한글을 깨뜨리지 않게 앞에 붙이는 BOM.
 *
 * 이게 없으면 엑셀은 CSV를 시스템 기본 인코딩(한국어 윈도우에서는 CP949)으로
 * 읽어서 UTF-8 한글이 전부 깨진다. 메모장이나 구글 시트는 멀쩡한데 엑셀만
 * 깨지기 때문에 놓치기 쉽다. */
const UTF8_BOM = '﻿'

/** 엑셀이 **수식으로 오해하는** 시작 글자.
 *
 * `=`, `+`, `-`, `@`로 시작하는 칸을 엑셀은 수식으로 읽는다. 남의 얘기가
 * 아니라 실제로 겪는다 — OCR이 닉네임을 못 읽으면 `=`나 `-` 한 글자를
 * 뱉고, 그게 그대로 "원본 줄" 칸에 들어간다. 열어 보면 `#NAME?`가 되거나,
 * 나쁘면 파일을 여는 것만으로 수식이 돈다.
 *
 * 앞에 작은따옴표를 붙이면 엑셀·구글 시트 모두 "그냥 글자"로 취급한다.
 * 숫자 칸에는 적용하지 않는다(음수를 망가뜨린다). */
const FORMULA_START = /^[=+\-@\t\r]/

/** CSV 한 칸을 안전하게 감싼다.
 *
 * 닉네임에 쉼표나 따옴표가 들어갈 수 있고(`문킹(문킹)`, `a,b`), 그대로 두면
 * 열이 밀린다. 따옴표는 두 번 겹쳐 쓰는 게 CSV 규칙이다. */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  if (!/["\n\r,]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/** 머리글 + 행들을 CSV 문자열로. */
export function toCsv(header: readonly string[], rows: readonly (string | number | null)[][]): string {
  const lines = [header.map(escapeCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCell).join(','))
  // 엑셀은 CRLF를 기대한다. LF만 쓰면 일부 버전에서 한 줄로 붙는다.
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}

/** 파일 이름에 못 쓰는 글자를 지운다. 길드명·닉네임이 그대로 들어가서 필요하다. */
export function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').trim() || 'export'
}

/** 브라우저에서 파일로 내려받게 한다. */
export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 바로 지우면 사파리에서 내려받기가 취소되는 일이 있어 한 틱 미룬다.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** CSV 글을 행 배열로 읽는다. 머리글도 그냥 첫 행으로 돌려준다.
 *
 * 따옴표로 감싼 칸(쉼표·줄바꿈·`""` 포함)을 처리하고, 앞의 BOM을 뗀다. 내보낼
 * 때 수식으로 오해받지 않게 붙인 작은따옴표(`'=…`)도 되돌린다 — 엑셀에서 열고
 * 다시 저장하면 따옴표가 그대로 글자로 남는 일이 있어서다. 빈 줄은 버린다. */
export function parseCsv(text: string): string[][] {
  const body = text.startsWith(UTF8_BOM) ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quoted) {
      if (char === '"' && body[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
    .map((cells) => cells.map((value) => (/^'[=+\-@]/.test(value) ? value.slice(1) : value)))
    .filter((cells) => cells.some((value) => value.trim() !== ''))
}
