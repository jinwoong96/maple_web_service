/** **수정 영역** — 손이 필요한 줄을 **맨 위에 모아** 놓고, **그 자리에서 다 고치게** 한다.
 *
 * 전체 목록은 스크린샷에 찍힌 순서라 눈으로 훑기 좋지만, 손볼 줄을 찾으려면
 * 200줄을 스크롤해야 한다. 실측에서 한 번에 206줄이 나왔고 그중 손이 필요한
 * 건 7줄이었다 — 그 7줄을 찾는 게 일이 된다.
 *
 * **못 믿을 순서로 세운다.** 아예 못 찾은 줄이 먼저, 그다음이 근거가 약한
 * 순으로 자동으로 고른 줄이다. 위에서부터 훑다가 믿을 만해지는 지점에서
 * 멈추면 된다.
 *
 * **칸마다 그림과 값을 위아래로 둔다**(2026-10-04). 위는 스크린샷에서 자른 그
 * 칸, 아래는 저장될 값이다. 사람이 둘을 견주며 바로 고친다.
 */

import { useEffect, useRef, useState } from 'react'

import { CellField, NameField, StripImage } from '@/components/guild-admin/row-editor'
import { describeProfile, type CharacterProfile } from '@/lib/candidate-profile'
import { sortAttentionRows, type AttentionKind } from '@/lib/attention-order'
import type { Strip } from '@/lib/ocr-strip'

export type { AttentionKind } from '@/lib/attention-order'

const LABEL: Record<AttentionKind, string> = {
  taken: '다른 줄이 가져감',
  duplicate: '중복 의심',
  'group-clash': '같은 사람이 두 줄',
  'score-order': '점수 확인',
  none: '못 찾음',
  ambiguous: '후보 여럿',
  'same-group': '같은 사람으로 확정',
  profile: '직업·레벨로 확정',
  eliminated: '후보 지워 확정',
  corrected: '자동 보정',
}

const TONE: Record<AttentionKind, string> = {
  taken: 'bg-destructive/15 text-destructive',
  duplicate: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  'group-clash': 'bg-destructive/15 text-destructive',
  'score-order': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  none: 'bg-destructive/15 text-destructive',
  ambiguous: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'same-group': 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  profile: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  eliminated: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  corrected: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
}

/** 저장할 칸 하나. 그림과 입력칸을 짝지어 둔다. */
export interface AttentionCell {
  /** 부모가 돌려받아 어느 칸인지 아는 열쇠. */
  key: string
  /** `지하수로`처럼 사람이 알아볼 이름. */
  label: string
  /** 지금 저장될 값. 고친 값이 있으면 그것이다. */
  value: string
  /** 사람이 고친 값인가. */
  edited: boolean
  numeric: boolean
  /** 짚을 칸인가. 점수 순서가 깨진 칸이 그렇다. */
  warn?: boolean
  strip: Strip | null
}

export interface AttentionRow {
  /** 부모의 줄 번호. 그대로 돌려줘야 부모가 어느 줄인지 안다. */
  index: number
  kind: AttentionKind
  /** 어느 스크린샷의 몇 번째 줄인지. 사람이 원본을 찾아볼 때 쓴다. */
  where?: string
  /** OCR이 읽은 값. 그림과 견주는 기준이다. */
  read: string
  /** 지금 정해진 이름. 못 찾았으면 `null`. */
  picked: string | null
  /** 사람이 쳤는데 **명단에 없는** 이름. 되돌리지 않고 빨갛게 남긴다. */
  typed?: string
  /** 눌러서 바꿀 수 있는 이름들. 이미 정해진 이름은 빠져 있다. */
  candidates: readonly string[]
  /** 닉네임 칸 그림. */
  strip: Strip | null
  /** 저장할 칸들(닉네임 밖). */
  cells: readonly AttentionCell[]
  /** 견줄 다른 줄 — 이름을 확정해 가져간 줄(`taken`)이나 겹쳐 보이는 앞줄
   * (`duplicate`). 그 줄의 그림을 나란히 놓아야 같은 줄이 두 번 들어온 중복인지,
   * 이쪽이 원래 다른 사람인지 갈린다. */
  compareWith?: {
    title: string
    name: string
    strip: Strip | null
    cells: readonly AttentionCell[]
  }
}

interface AttentionListProps {
  rows: readonly AttentionRow[]
  /** 받아둔 직업·레벨. 후보 옆에 붙인다. */
  profiles: Readonly<Record<string, CharacterProfile | null>>
  /** 이름 칸이 물고 있을 길드 명단 `<datalist>`의 id. */
  listId: string
  /** 이름을 정한다. 확정 버튼도 지금 이름으로 이걸 부른다. 빈 값은 물리기. */
  onPick: (index: number, name: string) => void
  /** 칸 값을 고친다. `null`은 고친 값을 물리기. */
  onCell: (index: number, key: string, value: string | null) => void
  /** 그 줄을 지운다. 저장에서도, 목록에서도 사라진다. */
  onRemove: (index: number) => void
  /** 점수 확인 줄에서 "맞음"을 눌렀다. 없으면 버튼을 안 그린다. */
  onConfirmScore?: (index: number) => void
  /** 칸 그림 배율. 원본 조각은 1.25, 전처리(2배) 조각은 0.5. */
  stripZoom?: number
  /** 명단에 있는데 **최종 명단에 한 캐릭터도 없는 사람들**. 한 사람 = 캐릭터 이름 목록.
   *
   * `null`이면 사람 단위로 셀 수 없다(그룹화를 안 돌렸다) — 그렇다고 알린다.
   * 안 넘기면 이 칸 자체를 안 그린다(명단이 없는 `/dev/ocr`). */
  missing?: readonly (readonly string[])[] | null
  /** 그룹에 안 묶인 캐릭터 수. 이들은 빠졌는지 셀 수 없어 따로 알린다. */
  unclassifiedCount?: number
  /** 빠진 사람의 캐릭터를 눌렀다 — 그 이름으로 줄을 직접 추가한다. 없으면 이름만 보여준다. */
  onAddMissing?: (name: string) => void
  /** 맨 아래 줄 이름 칸에서 엔터를 쳤다. 있으면 맨 위로 돌아가지 않고 이걸 부른다(다음 단계로). */
  onLastEnter?: () => void
}

/** 한 줄에 먼저 놓을 후보 수. 나머지는 눌러서 편다. */
const CANDIDATE_LIMIT = 6

const NOTE: Partial<Record<AttentionKind, string>> = {
  duplicate: '앞 줄과 겹쳐 보입니다 — 아래 짝과 같으면 이 줄을 지우고, 다른 사람이면 이름을 고쳐 주세요',
  taken: '달고 있던 이름을 다른 줄에서 확정했습니다 — 아래 그 줄과 같으면 중복이니 지우고, 아니면 이름을 다시 정해 주세요',
  'score-order': '지하수로 점수순을 깨는 값입니다 — 그림과 견줘 고치거나, 맞으면 "맞음"을 누르세요',
}

function CellStack({
  cell,
  zoom,
  onCommit,
}: {
  cell: AttentionCell
  zoom: number
  onCommit?: (value: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{cell.label}</span>
      {cell.strip ? (
        <StripImage
          strip={cell.strip}
          zoom={zoom}
          className={cell.warn ? 'outline-2 outline-offset-1 outline-amber-500' : ''}
        />
      ) : (
        <span className="text-[11px] text-muted-foreground">(그림 없음)</span>
      )}
      {onCommit ? (
        <CellField
          value={cell.value}
          edited={cell.edited}
          numeric={cell.numeric}
          warn={cell.warn}
          label={cell.label}
          onCommit={onCommit}
        />
      ) : (
        <span className={`text-xs ${cell.numeric ? 'text-right tabular-nums' : ''}`}>{cell.value || '—'}</span>
      )}
    </div>
  )
}

export function AttentionList({
  rows,
  profiles,
  listId,
  onPick,
  onCell,
  onRemove,
  onConfirmScore,
  stripZoom = 1.25,
  missing,
  unclassifiedCount = 0,
  onLastEnter,
  onAddMissing,
}: AttentionListProps) {
  /** 후보를 다 펼쳐 둔 줄. */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const listRef = useRef<HTMLUListElement>(null)
  /** 이름 칸에서 엔터를 친 뒤 옮겨 갈 줄 후보(줄 번호, 앞선 것부터). 확정하면 그 줄이 목록에서
   * 빠지고 다른 줄도 따라 풀릴 수 있어서, 다시 그린 뒤에 **남아 있는 첫 줄**로 간다. */
  const [focusQueue, setFocusQueue] = useState<readonly number[] | null>(null)

  const sorted = sortAttentionRows(rows)

  useEffect(() => {
    if (!focusQueue) return
    const list = listRef.current
    for (const index of focusQueue) {
      const input = list?.querySelector<HTMLInputElement>(`[data-attention-name="${index}"] input`)
      if (input) {
        input.focus()
        input.select()
        break
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 한 번 옮기고 끝낸다.
    setFocusQueue(null)
  }, [focusQueue, rows])

  /** 엔터로 이름을 정하고 다음 줄 이름 칸으로 간다(2026-10-04 사용자 요청 — 키보드만으로 이어서
   * 고치게). 값이 그대로면 그 이름으로 확정, 비어 있으면 아무것도 안 하고 넘어간다. */
  function enterName(row: AttentionRow, name: string) {
    const current = row.typed ?? row.picked ?? ''
    if (name && (name !== current || row.typed === undefined)) onPick(row.index, name)
    else if (!name && current) onPick(row.index, '')
    const position = sorted.findIndex((other) => other.index === row.index)
    const after = sorted.slice(position + 1).map((other) => other.index)
    const before = sorted.slice(0, position).map((other) => other.index)
    if (after.length === 0 && onLastEnter) {
      onLastEnter()
      return
    }
    setFocusQueue([...after, ...before])
  }

  if (rows.length === 0 && !missing?.length) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-sm font-medium">수정 영역 {rows.length}줄</p>
        <p className="text-xs text-muted-foreground">
          의심되는 줄부터 세웠습니다. 칸마다 위는 스크린샷에서 자른 그림, 아래는 저장될 값입니다. 이름이
          그림과 맞으면 <strong>확정</strong>을 누르세요 — 확정한 이름은 다른 줄의 후보에서 빠집니다. 이름
          칸에서 <strong>엔터</strong>를 치면 그 이름으로 확정하고 다음 줄 이름 칸으로 넘어갑니다.
        </p>
      </div>

      <ul ref={listRef} className="max-h-[40rem] overflow-y-auto rounded-md border empty:hidden">
        {sorted.map((row) => {
          const open = expanded.has(row.index)
          const shown = open ? row.candidates : row.candidates.slice(0, CANDIDATE_LIMIT)
          return (
            <li key={row.index} className="flex flex-col gap-2 border-b px-3 py-2.5 text-xs last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${TONE[row.kind]}`}>
                  {LABEL[row.kind]}
                </span>
                {row.where && <span className="text-muted-foreground">{row.where}</span>}
                {NOTE[row.kind] && <span className="text-muted-foreground">{NOTE[row.kind]}</span>}
                <div className="grow" />
                {row.kind === 'score-order' && onConfirmScore && (
                  <button
                    type="button"
                    className="shrink-0 rounded border px-1.5 py-0.5 hover:bg-muted"
                    onClick={() => onConfirmScore(row.index)}
                  >
                    맞음
                  </button>
                )}
                <button
                  type="button"
                  className="shrink-0 rounded border px-1.5 py-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onRemove(row.index)}
                >
                  이 줄 지우기
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">닉네임</span>
                  {/* 그림이 결정적이다 — 글자가 뭉개져도 사람 눈에는 대개 보인다. */}
                  {row.strip ? (
                    <StripImage strip={row.strip} zoom={stripZoom} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">(그림 없음)</span>
                  )}
                  <div className="flex items-center gap-1" data-attention-name={row.index}>
                    <NameField
                      value={row.typed ?? row.picked ?? ''}
                      listId={listId}
                      invalid={row.typed !== undefined}
                      onCommit={(name) => onPick(row.index, name)}
                      onEnter={(name) => enterName(row, name)}
                    />
                    {row.picked !== null && row.typed === undefined && (
                      <button
                        type="button"
                        className="rounded border border-primary px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
                        onClick={() => onPick(row.index, row.picked!)}
                      >
                        확정
                      </button>
                    )}
                  </div>
                </div>
                {row.cells.map((cell) => (
                  <CellStack
                    key={cell.key}
                    cell={cell}
                    zoom={stripZoom}
                    onCommit={(value) => onCell(row.index, cell.key, value)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {row.typed !== undefined && (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">명단에 없는 이름</span>
                )}
                {/* 읽은 값을 같이 둔다. 이 목록만 보고 판단할 수 있어야 한다. */}
                {row.read !== row.picked && (
                  <span className="font-mono text-muted-foreground">읽은 값 "{row.read}"</span>
                )}
                {shown.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded border px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
                    onClick={() => onPick(row.index, name)}
                  >
                    {name}
                    {name in profiles && <span className="ml-1">{describeProfile(profiles[name])}</span>}
                  </button>
                ))}
                {row.candidates.length > CANDIDATE_LIMIT && (
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev)
                        if (open) next.delete(row.index)
                        else next.add(row.index)
                        return next
                      })
                    }
                  >
                    {open ? '접기' : `+${row.candidates.length - CANDIDATE_LIMIT}`}
                  </button>
                )}
              </div>

              {/* 이 줄의 칸 바로 아래에 둬야 칸끼리 위아래로 견줘진다. */}
              {row.compareWith && (
                <div className="flex flex-wrap items-end gap-3 rounded bg-orange-50 px-2 py-2 dark:bg-orange-950/40">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">{row.compareWith.title}</span>
                    {row.compareWith.strip && <StripImage strip={row.compareWith.strip} zoom={stripZoom} />}
                    <span className="text-xs font-medium">{row.compareWith.name}</span>
                  </div>
                  {row.compareWith.cells.map((cell) => (
                    <CellStack key={cell.key} cell={cell} zoom={stripZoom} />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* **빠진 사람도 여기서 본다.** 줄이 다 맞아도 스크린샷에서 한 사람이
          통째로 빠졌거나, 그 사람 줄이 남의 이름을 달고 있으면 저장 뒤에야
          안다. */}
      {missing === null ? (
        <p className="text-xs text-muted-foreground">
          그룹 탭에서 그룹화를 돌려 두면, 명단에 있는데 최종 명단에 없는 사람도 여기 보여 드립니다.
        </p>
      ) : (
        missing !== undefined &&
        missing.length > 0 && (
          <div className="flex flex-col gap-1 text-xs">
            <p>
              <span className="font-medium">최종 명단에 없는 사람 {missing.length}명</span>
              <span className="ml-2 text-muted-foreground">
                캐릭터가 하나도 안 잡힌 사람입니다. 스크린샷에서 빠졌거나, 그 사람 줄이 다른 이름을 달고
                있을 수 있습니다.{onAddMissing && ' 스크린샷에서 빠졌으면 캐릭터를 눌러 줄을 직접 추가하세요.'}
                {unclassifiedCount > 0 &&
                  ` 그룹에 안 묶인 ${unclassifiedCount}캐릭은 사람 단위로 못 세서 뺐습니다.`}
              </span>
            </p>
            <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {missing.map((members) => (
                <li key={members[0]} className="flex items-center gap-0.5 rounded border px-1 py-0.5">
                  {onAddMissing
                    ? members.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onAddMissing(name)}
                          title={`${name} 줄을 직접 추가`}
                          className="rounded px-1 hover:bg-primary/10 hover:text-primary"
                        >
                          + {name}
                        </button>
                      ))
                    : members.join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  )
}
