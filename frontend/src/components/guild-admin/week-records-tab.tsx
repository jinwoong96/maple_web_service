/** **주차 기록** — 브라우저에 저장한 주간 점수를 관리하고 한 표로 본다.
 *
 * 2026-10-04 서버 저장을 없애면서 예전 "점수 모아보기"를 흡수했다.
 *
 * - 위: 저장된 주차 목록. CSV 내려받기 · 점수 입력에서 열기 · 삭제, 그리고
 *   CSV 여러 개 불러오기. CSV는 줄마다 월드·길드·주차가 있어 파일 이름과
 *   상관없이 알아서 나뉜다.
 * - 아래: 주차 하나를 골라 그 주차의 **모든 길드**를 한 표로. 길드 걸러내기에
 *   예전 모아보기의 열 정렬·닉네임(자판 오타 포함)·직업·숫자 범위 걸러내기.
 *
 * 다른 길드 데이터는 CSV로 불러오거나 그 길드 화면에서 입력해야 들어온다.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Folder, Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { GuildIdentity } from '@/hooks/use-guild-groups'
import { useScoreRecords } from '@/hooks/use-score-records'
import { currentNameResolver, GROUPING_SAVED_EVENT, listRenames } from '@/lib/grouping-store'
import { searchMatches } from '@/lib/hangul-keyboard'
import {
  canPickFolder,
  folderPermission,
  forgetFolder,
  loadFolder,
  pickFolder,
  saveCsvFile,
} from '@/lib/save-file'
import { recordFileName, recordsFromCsv, recordToCsv, type ScoreRecord } from '@/lib/score-records'
import { COLUMN_LABEL, NUMERIC_COLUMNS, numberOf, SCORE_COLUMNS, type ScoreColumn } from '@/lib/score-sheet'

interface WeekRecordsTabProps {
  guild: GuildIdentity
  /** 지금 불러온 길드의 기록을 점수 입력 탭에서 연다. */
  onOpen: (record: ScoreRecord) => void
}

type SortKey = 'guild' | 'name' | ScoreColumn

/** 숫자 열의 걸러내기. 빈 칸은 한계 없음이다. */
type Range = { min: string; max: string }

interface TableRow {
  key: string
  guild: string
  name: string
  /** 닉변을 반영한 지금 이름. 같으면 `name`과 같다. */
  current: string
  unresolved: boolean
  values: Partial<Record<ScoreColumn, string>>
}

/** 범위 칸에 친 글자를 숫자로. 쉼표를 넣어도 받는다. */
function bound(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

function FolderSetting() {
  const supported = canPickFolder()
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)

  const [permission, setPermission] = useState<PermissionState | null>(null)

  useEffect(() => {
    let alive = true
    void loadFolder().then(async (handle) => {
      if (!alive || !handle) return
      setFolder(handle)
      setPermission(await folderPermission(handle))
    })
    return () => {
      alive = false
    }
  }, [])

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        이 브라우저는 저장 폴더 지정을 지원하지 않아 CSV를 다운로드 폴더로 받습니다(크롬·엣지에서는 폴더를
        정할 수 있습니다).
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">CSV 기본 저장 폴더</span>
        {folder ? (
          <>
            <span className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-sm">
              <Folder className="size-4" />
              {folder.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                permission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {permission === 'granted' ? '이번 방문에 허용됨' : '저장할 때 허용을 묻습니다'}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">정하지 않음 — 다운로드 폴더로 받습니다</span>
        )}
        <div className="grow" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const handle = await pickFolder()
            if (!handle) return
            setFolder(handle)
            setPermission(await folderPermission(handle))
          }}
        >
          {folder ? '폴더 바꾸기' : '폴더 고르기'}
        </Button>
        {folder && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await forgetFolder()
              setFolder(null)
              setPermission(null)
            }}
          >
            지정 해제
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        이 페이지에서 내려받는 CSV만 이 폴더에 바로 저장됩니다. 다른 사이트와 브라우저의 다운로드 폴더 설정은
        바뀌지 않습니다. 브라우저를 다시 켠 뒤 처음 저장할 때 폴더 사용을 한 번 허용해 주세요.
      </p>
    </div>
  )
}

export function WeekRecordsTab({ guild, onOpen }: WeekRecordsTabProps) {
  const { records, error, save, remove } = useScoreRecords()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)

  /** 그룹화 때 감지한 닉변 내역. 기록은 저장한 이름 그대로 두고, 보여줄 때 지금 이름을 찾는다. */
  const client = useQueryClient()
  const renames = useQuery({ queryKey: ['guild-admin', 'renames'], queryFn: listRenames, staleTime: Infinity })
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: ['guild-admin', 'renames'] })
    window.addEventListener(GROUPING_SAVED_EVENT, refresh)
    return () => window.removeEventListener(GROUPING_SAVED_EVENT, refresh)
  }, [client])
  const currentName = useMemo(() => currentNameResolver(renames.data ?? []), [renames.data])

  // 저장 폴더는 내려받기 직전에 다시 읽는다 — 설정 칸에서 바꿨을 수 있다.
  async function download(record: ScoreRecord) {
    const handle = await loadFolder()
    setFolder(handle)
    const where = await saveCsvFile(handle, recordFileName(record), recordToCsv(record, currentName))
    setMessage({
      tone: 'ok',
      text:
        where === 'folder'
          ? `${recordFileName(record)}을(를) "${handle?.name ?? ''}" 폴더에 저장했습니다.`
          : `${recordFileName(record)}을(를) 내려받았습니다.`,
    })
  }

  async function importFiles(files: File[]) {
    setMessage(null)
    const collected: ScoreRecord[] = []
    const problems: string[] = []
    let skipped = 0
    for (const file of files) {
      try {
        const result = recordsFromCsv(await file.text())
        skipped += result.skipped
        const savedAt = new Date().toISOString()
        collected.push(...result.records.map((record) => ({ ...record, savedAt })))
      } catch (caught) {
        problems.push(`${file.name}: ${caught instanceof Error ? caught.message : String(caught)}`)
      }
    }
    if (collected.length > 0) await save(collected)
    const replaced = collected.filter((record) => records.some((existing) => existing.key === record.key)).length
    const parts = [
      collected.length > 0 ? `기록 ${collected.length}개를 불러왔습니다` : '불러온 기록이 없습니다',
      replaced > 0 ? `${replaced}개는 같은 길드·주차를 대체했습니다` : null,
      skipped > 0 ? `월드·길드·주차·닉네임이 빈 ${skipped}줄은 건너뛰었습니다` : null,
    ].filter(Boolean)
    setMessage({
      tone: problems.length > 0 ? 'error' : 'ok',
      text: [parts.join(' · ') + '.', ...problems].join(' '),
    })
  }

  const listed = useMemo(
    () =>
      [...records].sort((a, b) =>
        a.week === b.week ? a.guild.localeCompare(b.guild, 'ko') : b.week.localeCompare(a.week),
      ),
    [records],
  )
  const guildCount = new Set(records.map((record) => `${record.world}|${record.guild}`)).size

  // --- 표 ----------------------------------------------------------------

  const weeks = useMemo(() => [...new Set(records.map((record) => record.week))].sort().reverse(), [records])
  const [pickedWeek, setPickedWeek] = useState<string | null>(null)
  const week = pickedWeek && weeks.includes(pickedWeek) ? pickedWeek : (weeks[0] ?? null)
  const weekRecords = useMemo(() => records.filter((record) => record.week === week), [records, week])

  /** 끈 길드. 켠 것이 아니라 끈 것을 기억한다 — 새 길드는 기본이 "켬"이다. */
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set())
  const columns = SCORE_COLUMNS.filter((column) => weekRecords.some((record) => record.columns.includes(column)))

  const rows: TableRow[] = useMemo(
    () =>
      weekRecords
        .filter((record) => !dropped.has(record.key))
        .flatMap((record) =>
          record.rows.map((row, index) => ({
            key: `${record.key}|${index}`,
            guild: record.guild,
            name: row.name,
            current: currentName(row.name),
            unresolved: row.unresolved,
            // 그 기록에 없는 열은 비워 둔다 — 화면에서 `—`로 보인다.
            values: Object.fromEntries(
              record.columns.map((column) => [column, row.values[column] ?? '']),
            ) as Partial<Record<ScoreColumn, string>>,
          })),
        ),
    [weekRecords, dropped, currentName],
  )

  const [nameFilter, setNameFilter] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [ranges, setRanges] = useState<Partial<Record<ScoreColumn, Range>>>({})
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'underground', desc: true })

  const jobChoices = useMemo(
    () => [...new Set(rows.map((row) => row.values.job).filter((job): job is string => Boolean(job)))].sort(),
    [rows],
  )

  const filtered = rows.filter((row) => {
    // 초성으로도, 자판을 잘못 두고 쳐도 걸린다(`hangul-keyboard.ts`).
    if (!searchMatches(row.current, nameFilter) && !searchMatches(row.name, nameFilter)) return false
    if (jobFilter && row.values.job !== jobFilter) return false
    for (const column of columns) {
      if (!NUMERIC_COLUMNS.has(column)) continue
      const low = bound(ranges[column]?.min ?? '')
      const high = bound(ranges[column]?.max ?? '')
      if (low === null && high === null) continue
      const value = numberOf(row.values[column] ?? '')
      if (value === null) return false
      if (low !== null && value < low) return false
      if (high !== null && value > high) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const value = (row: TableRow): string | number | null => {
      if (sort.key === 'guild') return row.guild
      if (sort.key === 'name') return row.current
      const text = row.values[sort.key] ?? ''
      return NUMERIC_COLUMNS.has(sort.key) ? numberOf(text) : text
    }
    const left = value(a)
    const right = value(b)
    // 값이 없는 줄은 언제나 맨 뒤로.
    if (left === null || left === '') return right === null || right === '' ? 0 : 1
    if (right === null || right === '') return -1
    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'ko')
    return sort.desc ? -compared : compared
  })

  const headers: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: 'guild', label: '길드', numeric: false },
    { key: 'name', label: '닉네임', numeric: false },
    ...columns.map((column) => ({ key: column, label: COLUMN_LABEL[column], numeric: NUMERIC_COLUMNS.has(column) })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 다른 컴퓨터로 옮기면 사라지니, 주차마다
          CSV로 내려받아 두세요.
        </span>
      </div>

      <FolderSetting key={folder?.name ?? 'none'} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold">저장된 주차</h3>
          <span className="text-xs text-muted-foreground">
            길드 {guildCount}개 · 기록 {records.length}개
          </span>
          <div className="grow" />
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-muted">
            CSV 불러오기 (여러 개)
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ''
                void importFiles(files)
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          파일 안의 월드·길드·주차로 나눠 넣습니다. 파일 이름을 바꿔도, 한 파일에 여러 주차가 섞여 있어도 됩니다.
          같은 길드·주차는 새 파일로 바뀝니다.
          내려받는 CSV에는 닉변을 반영한 <strong>현재 닉네임</strong> 열이 함께 들어갑니다.
        </p>

        {message && (
          <Alert variant={message.tone === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {listed.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            아직 저장된 기록이 없습니다. 점수 입력 탭에서 "이 주차로 저장"을 누르거나, 내려받아 둔 CSV를 불러오세요.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">월드</th>
                  <th className="px-3 py-2 text-left font-medium">길드</th>
                  <th className="px-3 py-2 text-left font-medium">주차</th>
                  <th className="px-3 py-2 text-right font-medium">인원</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listed.map((record) => {
                  const current = record.world === guild.worldName && record.guild === guild.guildName
                  return (
                    <tr key={record.key} className="border-t">
                      <td className="px-3 py-1.5">{record.world}</td>
                      <td className="px-3 py-1.5 font-medium">
                        {record.guild}
                        {current && (
                          <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 py-0.5 text-[11px] font-normal text-primary">
                            지금 길드
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{record.week}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{record.rows.length}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-end gap-1.5">
                          <Button type="button" size="sm" variant="outline" onClick={() => void download(record)}>
                            CSV 내려받기
                          </Button>
                          {/* 명단 대조에 그 길드의 명단이 필요해서, 지금 불러온 길드의
                              기록만 연다. */}
                          <span title={current ? undefined : '지금 불러온 길드의 기록만 점수 입력에서 열 수 있습니다'}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!current}
                              onClick={() => onOpen(record)}
                            >
                              점수 입력에서 열기
                            </Button>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={confirmDelete === record.key ? 'destructive' : 'outline'}
                            onBlur={() => setConfirmDelete(null)}
                            onClick={() => {
                              if (confirmDelete !== record.key) {
                                setConfirmDelete(record.key)
                                return
                              }
                              setConfirmDelete(null)
                              void remove(record.key)
                            }}
                          >
                            {confirmDelete === record.key ? '한 번 더 누르면 삭제' : '삭제'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {week && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-2 text-base font-semibold">주차별 보기</h3>
            <label htmlFor="records-week" className="text-xs text-muted-foreground">
              주차
            </label>
            <select
              id="records-week"
              value={week}
              onChange={(event) => setPickedWeek(event.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
            >
              {weeks.map((value, index) => (
                <option key={value} value={value}>
                  {value}
                  {index === 0 ? ' (최근)' : ''}
                </option>
              ))}
            </select>
            <span className="ml-2 text-xs text-muted-foreground">길드</span>
            {weekRecords.map((record) => {
              const on = !dropped.has(record.key)
              return (
                <button
                  key={record.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDropped((prev) => {
                      const next = new Set(prev)
                      if (next.has(record.key)) next.delete(record.key)
                      else next.add(record.key)
                      return next
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {record.guild} {record.rows.length}
                </button>
              )
            })}
            <div className="grow" />
            <span className="text-xs text-muted-foreground">{sorted.length}줄 · 기록에 없는 열은 —</span>
          </div>

          <div className="max-h-[48rem] overflow-auto rounded-lg border">
            <table className="w-full min-w-[48rem] text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">순위</th>
                  {headers.map((header) => (
                    <th key={header.key} className={header.numeric ? 'px-2 py-1.5 text-right' : 'px-2 py-1.5 text-left'}>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() =>
                          setSort((prev) =>
                            prev.key === header.key
                              ? { key: header.key, desc: !prev.desc }
                              : // 숫자는 큰 값이, 글자는 앞 글자가 먼저 오는 게 자연스럽다.
                                { key: header.key, desc: header.numeric },
                          )
                        }
                      >
                        {header.label}
                        {sort.key === header.key && (sort.desc ? ' ▼' : ' ▲')}
                      </button>
                    </th>
                  ))}
                </tr>
                {/* 걸러내기는 열 바로 아래에 둔다. 어느 열을 거르는지 눈으로 이어져야 한다. */}
                <tr className="border-t">
                  <th />
                  <th />
                  <th className="px-2 py-1">
                    <input
                      value={nameFilter}
                      onChange={(event) => setNameFilter(event.target.value)}
                      placeholder="닉네임 (자판 오타도 찾음)"
                      aria-label="닉네임으로 거르기"
                      className="w-40 rounded border bg-transparent px-1 py-0.5 font-normal"
                    />
                  </th>
                  {columns.map((column) => (
                    <th key={column} className="px-2 py-1">
                      {column === 'job' ? (
                        <select
                          value={jobFilter}
                          onChange={(event) => setJobFilter(event.target.value)}
                          aria-label="직업으로 거르기"
                          disabled={jobChoices.length === 0}
                          className="w-24 rounded border bg-transparent px-1 py-0.5 font-normal"
                        >
                          <option value="">전체</option>
                          {jobChoices.map((job) => (
                            <option key={job} value={job}>
                              {job}
                            </option>
                          ))}
                        </select>
                      ) : NUMERIC_COLUMNS.has(column) ? (
                        <div className="flex items-center justify-end gap-1">
                          {(['min', 'max'] as const).map((side) => (
                            <input
                              key={side}
                              value={ranges[column]?.[side] ?? ''}
                              onChange={(event) =>
                                setRanges((prev) => ({
                                  ...prev,
                                  [column]: { min: '', max: '', ...prev[column], [side]: event.target.value },
                                }))
                              }
                              placeholder={side === 'min' ? '최소' : '최대'}
                              aria-label={`${COLUMN_LABEL[column]} ${side === 'min' ? '최소' : '최대'}`}
                              inputMode="numeric"
                              className="w-16 rounded border bg-transparent px-1 py-0.5 text-right font-normal"
                            />
                          ))}
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, index) => (
                  <tr key={row.key} className="border-t">
                    <td className="px-2 py-1 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-1 text-muted-foreground">{row.guild}</td>
                    <td className="px-2 py-1 font-medium">
                      {row.current}
                      {row.current !== row.name && (
                        <span className="block text-[11px] font-normal text-muted-foreground">예전: {row.name}</span>
                      )}
                      {row.unresolved && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          이름 미확정
                        </span>
                      )}
                    </td>
                    {columns.map((column) => {
                      const value = row.values[column]
                      return (
                        <td
                          key={column}
                          className={`px-2 py-1 ${NUMERIC_COLUMNS.has(column) ? 'text-right tabular-nums' : ''} ${
                            value === undefined ? 'text-muted-foreground' : ''
                          }`}
                        >
                          {value === undefined ? '—' : value}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
