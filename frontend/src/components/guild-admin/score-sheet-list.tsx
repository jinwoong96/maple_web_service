/** 점수 입력의 **전체 목록**. 스크린샷 단위로 묶고, 칸마다 그림과 값을 둔다.
 *
 * 중복은 자동으로 지우지 않는다(2026-10-04). 대신
 *
 * - 앞 장과 겹쳐 보이는 줄은 **진한 배경**, 그 짝(앞 장의 줄)은 **옅은 배경**으로
 *   칠한다.
 * - 줄마다 **`여기까지 위로 지우기`** — 그 장의 첫 줄부터 이 줄까지 지운다.
 *   겹친 부분은 언제나 다음 장 맨 위라 대개 한 번이면 끝난다.
 * - 줄마다 **`이 줄만 지우기`**(X) — 한 줄만 뺄 때.
 * - 체크박스 + **Shift+클릭으로 범위**를 잡아 `선택한 줄 지우기`.
 */

import { useRef, type FormEvent } from 'react'
import { X } from 'lucide-react'

import { CellField, NameField, StripImage } from '@/components/guild-admin/row-editor'
import { Button } from '@/components/ui/button'
import { COLUMN_LABEL, NUMERIC_COLUMNS, type ScoreColumn, type SheetRow } from '@/lib/score-sheet'

/** 칸 그림 배율. 원본 스크린샷 조각이라 조금 키워 본다. */
const ZOOM = 1.25

interface ScoreSheetListProps {
  rows: readonly SheetRow[]
  columns: readonly ScoreColumn[]
  /** 줄마다 지금 이름(정한 이름이나 친 글자). 못 정했으면 빈 값. */
  names: readonly string[]
  /** 줄마다 그룹 대표의 지금 이름. 매칭된 이름이 곧 대표거나 그룹이 없으면 `null`. */
  representatives: readonly (string | null)[]
  /** 그 대표가 확정된 것인가. 확정 전이면 "확인 필요"를 붙인다. */
  representativeConfirmed: readonly boolean[]
  /** 명단에 없는 이름을 친 줄. */
  unknownNames: ReadonlySet<number>
  /** 이름을 못 정한 줄. */
  unresolved: ReadonlySet<number>
  valueOf: (index: number, column: ScoreColumn) => string
  editedOf: (index: number, column: ScoreColumn) => boolean
  warnOf: (index: number, column: ScoreColumn) => boolean
  /** 중복 의심 줄 → 짝. */
  duplicates: ReadonlyMap<number, number>
  /** 중복 의심의 짝이 된 줄. */
  pairs: ReadonlySet<number>
  selected: ReadonlySet<string>
  onSelectedChange: (next: ReadonlySet<string>) => void
  listId: string
  onPick: (index: number, name: string) => void
  onCell: (index: number, column: ScoreColumn, value: string | null) => void
  onRemoveSelected: () => void
  onRemoveUpTo: (index: number) => void
  onRemoveOne: (index: number) => void
  /** 점수 순서 의심 줄인가("맞음"을 누른 줄은 아니다). 그 줄에 `맞음` 버튼을 단다. */
  suspectOf?: (index: number) => boolean
  onConfirmScore?: (index: number) => void
  /** 칸에서 엔터를 쳤다(값은 이미 반영). 다음 칸으로 이어 가게 부모가 옮긴다. */
  onCellEnter?: (index: number, column: ScoreColumn, changed: boolean) => void
  /** 줄을 직접 추가한다(OCR이 놓친 줄). 없으면 추가 칸을 안 그린다. */
  onAddRow?: (name: string) => void
  /** 지금 보는 경계(다음 장의 묶음 열쇠)와 그 순번. 그 장 머리를 짚는다. */
  activeBoundary?: { key: string; position: number; count: number } | null
}

export function ScoreSheetList({
  rows,
  columns,
  names,
  representatives,
  representativeConfirmed,
  unknownNames,
  unresolved,
  valueOf,
  editedOf,
  warnOf,
  duplicates,
  pairs,
  selected,
  onSelectedChange,
  listId,
  onPick,
  onCell,
  onRemoveSelected,
  onRemoveUpTo,
  onRemoveOne,
  suspectOf,
  onConfirmScore,
  onCellEnter,
  activeBoundary = null,
  onAddRow,
}: ScoreSheetListProps) {
  /** Shift+클릭 범위의 시작점. 마지막으로 누른 체크박스다. */
  const anchorRef = useRef<number | null>(null)
  const addRef = useRef<HTMLInputElement>(null)

  function submitAdd(event: FormEvent) {
    event.preventDefault()
    const input = addRef.current
    const name = input?.value.trim()
    if (!input || !name || !onAddRow) return
    onAddRow(name)
    input.value = ''
  }

  function toggle(index: number, shift: boolean) {
    const next = new Set(selected)
    const id = rows[index].id
    const on = !selected.has(id)
    if (shift && anchorRef.current !== null) {
      const [from, to] = [anchorRef.current, index].sort((a, b) => a - b)
      for (let i = from; i <= to; i++) {
        if (on) next.add(rows[i].id)
        else next.delete(rows[i].id)
      }
    } else if (on) next.add(id)
    else next.delete(id)
    anchorRef.current = index
    onSelectedChange(next)
  }

  const groupCounts = new Map<string, number>()
  const duplicateCount = new Map<string, number>()
  rows.forEach((row, index) => {
    groupCounts.set(row.group.key, (groupCounts.get(row.group.key) ?? 0) + 1)
    if (duplicates.has(index)) duplicateCount.set(row.group.key, (duplicateCount.get(row.group.key) ?? 0) + 1)
  })

  /** 줄이 그 장의 몇 번째인지. */
  const positions: number[] = []
  rows.forEach((row, index) => {
    const first = index === 0 || rows[index - 1].group.key !== row.group.key
    positions.push(first ? 1 : positions[index - 1] + 1)
  })

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">전체 목록</h3>
        <span className="text-xs text-muted-foreground">
          {rows.length}줄
          {duplicates.size > 0 && (
            <>
              {' · '}중복 의심 <strong className="text-orange-700 dark:text-orange-300">{duplicates.size}줄</strong>
            </>
          )}{' '}
          · 자동으로 지우지 않습니다.
        </span>
        <div className="grow" />
        {onAddRow && (
          <form onSubmit={submitAdd} className="flex items-center gap-1">
            <input
              ref={addRef}
              list={listId}
              placeholder="빠진 캐릭터 닉네임"
              aria-label="직접 추가할 캐릭터 닉네임"
              className="h-8 w-40 rounded-md border bg-transparent px-2 text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              줄 추가
            </Button>
          </form>
        )}
        <span className="text-xs text-muted-foreground">{selected.size}줄 선택됨</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={selected.size === 0}
          onClick={onRemoveSelected}
          className="text-destructive"
        >
          선택한 줄 지우기
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-orange-200 dark:bg-orange-900" />
          중복 의심 (다음 장 윗부분)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40" />
          겹치는 짝 (앞 장 아랫부분)
        </span>
        <span>체크박스를 누른 뒤 Shift+클릭하면 범위가 잡힙니다.</span>
      </div>

      <div data-sheet-scroll className="max-h-[48rem] scroll-mt-20 overflow-auto rounded-lg border">
        {rows.map((row, index) => {
          const first = positions[index] === 1
          const position = positions[index]
          const duplicate = duplicates.has(index)
          const pair = !duplicate && pairs.has(index)
          const suspect = suspectOf?.(index) ?? false
          const boundaryHere = first && activeBoundary?.key === row.group.key
          const background = duplicate
            ? 'bg-orange-200/70 dark:bg-orange-900/50'
            : pair
              ? 'bg-orange-50 dark:bg-orange-950/30'
              : ''
          return (
            <div key={row.id}>
              {first && (
                <div
                  className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs font-semibold ${
                    boundaryHere ? 'bg-blue-100 ring-2 ring-blue-600 ring-inset dark:bg-blue-950' : 'bg-muted'
                  }`}
                >
                  <span>
                    {row.group.label} · {groupCounts.get(row.group.key)}줄
                    {(duplicateCount.get(row.group.key) ?? 0) > 0 &&
                      ` · 중복 의심 ${duplicateCount.get(row.group.key)}줄`}
                  </span>
                  {boundaryHere && activeBoundary && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 font-medium text-white">
                      지금 보는 경계 {activeBoundary.position} / {activeBoundary.count}
                    </span>
                  )}
                </div>
              )}
              <div
                data-shot-first={first ? row.group.key : undefined}
                className={`flex items-end gap-3 border-b px-3 py-2 text-xs last:border-b-0 ${background} ${
                  suspect && !duplicate && !pair ? 'bg-amber-50/70 dark:bg-amber-950/30' : ''
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`${row.group.label} ${position}번 줄 선택`}
                  checked={selected.has(row.id)}
                  onChange={() => undefined}
                  onClick={(event) => toggle(index, event.shiftKey)}
                  className="mb-1.5"
                />
                <span className="mb-1.5 w-6 shrink-0 text-muted-foreground">{position}</span>
                <div className="flex shrink-0 flex-col gap-1">
                  {row.strips.name ? (
                    <StripImage strip={row.strips.name} zoom={ZOOM} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{row.read || '(그림 없음)'}</span>
                  )}
                  <NameField
                    value={names[index]}
                    listId={listId}
                    invalid={unknownNames.has(index)}
                    onCommit={(name) => onPick(index, name)}
                    className={`w-32 ${unresolved.has(index) && !unknownNames.has(index) ? 'border-amber-500' : ''}`}
                  />
                  {row.manual && (
                    <span className="w-fit rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                      직접 추가
                    </span>
                  )}
                  {/* 저장은 대표 이름으로 된다. 무엇으로 바뀌는지 보여준다. */}
                  {representatives[index] && (
                    <span
                      className="max-w-40 truncate text-[11px] text-primary"
                      title={`그룹 대표로 저장: ${representatives[index]}`}
                    >
                      → 대표 {representatives[index]}
                      {!representativeConfirmed[index] && ' (확인 필요)'}
                    </span>
                  )}
                </div>
                {columns.map((column) => (
                  <div
                    key={column}
                    data-score-cell={row.id}
                    data-column={column}
                    className="flex shrink-0 flex-col gap-1"
                  >
                    {row.strips[column] ? (
                      <StripImage strip={row.strips[column]} zoom={ZOOM} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{COLUMN_LABEL[column]}</span>
                    )}
                    <CellField
                      value={valueOf(index, column)}
                      edited={editedOf(index, column)}
                      numeric={NUMERIC_COLUMNS.has(column)}
                      warn={warnOf(index, column)}
                      label={`${position}번 줄 ${COLUMN_LABEL[column]}`}
                      onCommit={(value) => onCell(index, column, value)}
                      onEnter={onCellEnter ? (changed) => onCellEnter(index, column, changed) : undefined}
                      className={NUMERIC_COLUMNS.has(column) ? 'w-24' : 'w-28'}
                    />
                  </div>
                ))}
                <div className="grow" />
                {suspect && onConfirmScore && (
                  <button
                    type="button"
                    onClick={() => onConfirmScore(index)}
                    title="점수가 그림과 맞으면 — 점수 확인에서 뺍니다"
                    className="mb-0.5 shrink-0 rounded border border-amber-500 bg-amber-50 px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"
                  >
                    맞음
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveUpTo(index)}
                  className={`mb-0.5 shrink-0 rounded border px-2 py-1 whitespace-nowrap ${
                    duplicate
                      ? 'border-primary bg-background text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  여기까지 위로 지우기
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveOne(index)}
                  aria-label={`${row.group.label} ${position}번 줄만 지우기`}
                  title="이 줄만 지우기"
                  className="mb-0.5 shrink-0 rounded border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
