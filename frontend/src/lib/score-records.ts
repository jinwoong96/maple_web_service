/** 브라우저에 남기는 **주차 기록**과 그 CSV.
 *
 * 서버 저장을 없애면서(2026-10-04) 기록은 `(월드, 길드, 주차)` 단위로
 * IndexedDB에 둔다. CSV는 백업이자 다른 컴퓨터·다른 사람에게 넘기는 수단이다.
 *
 * **CSV는 스스로를 설명한다.** 줄마다 월드·길드·주차가 들어 있어서, 불러올 때
 * 파일 이름을 보지 않는다. 이름을 바꾼 파일도, 여러 주차가 섞인 파일도 그대로
 * 들어간다 — 나중에 "여러 주차를 한 파일로" 내보내기를 붙여도 불러오기는 손댈
 * 필요가 없다.
 */

import { parseCsv, safeFileName, toCsv } from '@/lib/csv'
import { weekStartOf } from '@/lib/guild-score'
import { idbDelete, idbGetAll, idbPut, STORES } from '@/lib/idb'
import { COLUMN_LABEL, SCORE_COLUMNS, type ScoreColumn } from '@/lib/score-sheet'

export interface RecordRow {
  name: string
  /** 명단과 맞추지 못해 **읽은 이름 그대로** 저장한 줄. */
  unresolved: boolean
  values: Partial<Record<ScoreColumn, string>>
}

export interface ScoreRecord {
  key: string
  world: string
  guild: string
  /** 그 주 목요일(`2026-10-01`). */
  week: string
  /** 저장할 때 고른 열. 닉네임은 늘 있으므로 넣지 않는다. */
  columns: ScoreColumn[]
  rows: RecordRow[]
  savedAt: string
}

export function recordKey(world: string, guild: string, week: string): string {
  return `${world}|${guild}|${week}`
}

export function listRecords(): Promise<ScoreRecord[]> {
  return idbGetAll<ScoreRecord>(STORES.scoreRecords)
}

export function putRecord(record: ScoreRecord): Promise<void> {
  return idbPut(STORES.scoreRecords, record.key, record)
}

export function deleteRecord(key: string): Promise<void> {
  return idbDelete(STORES.scoreRecords, key)
}

const META_HEADER = ['월드', '길드', '주차', '닉네임'] as const

export function recordFileName(record: ScoreRecord): string {
  return `${safeFileName(`${record.guild}_${record.week}`)}.csv`
}

/** 닉변을 반영한 **지금 닉네임** 열. 기록의 닉네임은 그 주에 저장한 그대로 두고, 이
 * 열에 지금 이름을 같이 넣는다(2026-10-04). 불러올 때는 무시한다. */
const CURRENT_NAME_HEADER = '현재 닉네임'

export function recordToCsv(record: ScoreRecord, currentName: (name: string) => string = (name) => name): string {
  return toCsv(
    [...META_HEADER, CURRENT_NAME_HEADER, ...record.columns.map((column) => COLUMN_LABEL[column])],
    record.rows.map((row) => [
      record.world,
      record.guild,
      record.week,
      row.name,
      currentName(row.name),
      ...record.columns.map((column) => row.values[column] ?? ''),
    ]),
  )
}

/** 엑셀이 날짜 칸을 제멋대로 바꿔 저장해도(`2026/10/1`, `2026.10.01`) 받는다.
 * 목요일이 아닌 날짜가 오면 그 주 목요일로 맞춘다. */
function parseWeek(text: string): string | null {
  const match = text.trim().match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : weekStartOf(date)
}

const LABEL_TO_COLUMN = new Map(SCORE_COLUMNS.map((column) => [COLUMN_LABEL[column], column]))

export interface CsvImport {
  records: Omit<ScoreRecord, 'savedAt'>[]
  /** 월드·길드·주차·닉네임을 못 읽어 버린 줄 수. */
  skipped: number
}

/** CSV 한 개를 `(월드, 길드, 주차)`별 기록으로 나눈다. 머리글이 우리 형식이
 * 아니면 오류를 던진다. 모르는 열은 무시한다. */
export function recordsFromCsv(text: string): CsvImport {
  const [header, ...body] = parseCsv(text)
  if (!header) throw new Error('빈 파일입니다.')
  const at = (label: string) => header.findIndex((cell) => cell.trim() === label)
  const meta = META_HEADER.map(at)
  if (meta.some((index) => index < 0)) {
    throw new Error('월드·길드·주차·닉네임 열이 없습니다. 주차 기록에서 내려받은 CSV인지 확인해주세요.')
  }
  const [worldAt, guildAt, weekAt, nameAt] = meta
  const columns: { column: ScoreColumn; index: number }[] = []
  header.forEach((cell, index) => {
    const column = LABEL_TO_COLUMN.get(cell.trim())
    if (column) columns.push({ column, index })
  })

  const byKey = new Map<string, Omit<ScoreRecord, 'savedAt'>>()
  let skipped = 0
  for (const cells of body) {
    const world = (cells[worldAt] ?? '').trim()
    const guild = (cells[guildAt] ?? '').trim()
    const week = parseWeek(cells[weekAt] ?? '')
    const name = (cells[nameAt] ?? '').trim()
    if (!world || !guild || !week || !name) {
      skipped += 1
      continue
    }
    const key = recordKey(world, guild, week)
    let record = byKey.get(key)
    if (!record) {
      record = { key, world, guild, week, columns: columns.map((entry) => entry.column), rows: [] }
      byKey.set(key, record)
    }
    const values: Partial<Record<ScoreColumn, string>> = {}
    for (const { column, index } of columns) values[column] = (cells[index] ?? '').trim()
    record.rows.push({ name, unresolved: false, values })
  }
  return { records: [...byKey.values()], skipped }
}
