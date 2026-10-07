/** 점수 입력을 **4단계 순서로** 이끈다(2026-10-04 사용자 요청).
 *
 * 써 보니 가장 편한 순서가 ① 업로드 → ② 전체 목록에서 장 경계의 중복 지우기 → ③ 수정 영역에서
 * 닉네임 확정 → ④ 전체 목록에서 점수 고치기였다. ②를 먼저 하는 건 중복 줄이 남아 있으면 이름 판정이
 * 가짜 경고("다른 줄이 가져감" 등)를 만들어 ③이 지저분해지기 때문이다.
 *
 * 할 곳을 한 줄로 세운다 — 경계들 → 수정 영역 줄들 → 점수 의심 칸들 → 저장 칸 — 그리고
 * `Ctrl+↓`/`Ctrl+↑`(또는 버튼)로 커서를 옮긴다. 줄이 확정되거나 지워지면 목록이 바뀌므로 커서는
 * 열쇠(줄 id)와 자리 번호를 같이 들고, 열쇠가 사라졌으면 그 자리에서 이어 간다. 이름·점수 칸에
 * 포커스가 가면(엔터로 넘어갔든 클릭했든) 커서도 거기로 따라온다.
 *
 * 스크롤·포커스는 화면의 `data-` 표지로 찾는다: `data-shot-first`(장의 첫 줄),
 * `data-sheet-scroll`(전체 목록 상자), `data-attention-name`(수정 영역 이름 칸),
 * `data-score-cell` + `data-column`(전체 목록 칸), `data-score-save`(저장 버튼). */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { MANUAL_GROUP, type ScoreColumn, type SheetRow } from '@/lib/score-sheet'

export type ScoreStepKey = 'upload' | 'boundary' | 'names' | 'scores'

export interface ScoreStep {
  key: ScoreStepKey
  label: string
  /** 남은 일·현황 한 줄. */
  detail: string
  done: boolean
}

/** 한자 키(오른쪽 Ctrl)를 누른 뒤 방향키를 Ctrl+방향키로 받아 줄 시간. 떼는 신호가 안 오는 경우의
 * 안전장치다 — 누른 채 방향키를 연달아 누르면 누를 때마다 다시 잰다. */
const HANJA_HOLD_MS = 1500

type Pending =
  | { kind: 'first-boundary' }
  | { kind: 'suspect-after'; rowId: string }
  | { kind: 'cell-below'; rowId: string; column: ScoreColumn }

interface Options {
  rootRef: RefObject<HTMLElement | null>
  rows: readonly SheetRow[]
  /** 수정 영역 줄(줄 번호), 화면에 세운 순서대로. */
  attentionOrder: readonly number[]
  /** 점수 의심 줄(줄 번호), 위에서부터. "맞음"을 누른 줄은 빠져 있다. */
  suspects: readonly number[]
  duplicateCount: number
  /** "맞음"으로 확인한 칸끼리도 순서가 어긋난 곳 수. 칸으로는 못 짚어서 ④를 끝내지 않고 알리기만 한다. */
  orderConflicts: number
  /** 점수 순서를 보는 열(지하수로). 의심 칸으로 갈 때 이 칸에 포커스한다. */
  orderColumn: ScoreColumn
}

function targetKind(key: string): 'boundary' | 'names' | 'scores' | 'save' {
  if (key.startsWith('b:')) return 'boundary'
  if (key.startsWith('n:')) return 'names'
  if (key.startsWith('s:')) return 'scores'
  return 'save'
}

export function useScoreSteps({
  rootRef,
  rows,
  attentionOrder,
  suspects,
  duplicateCount,
  orderConflicts,
  orderColumn,
}: Options) {
  /** 지나간 경계(다음 장의 묶음 열쇠). */
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set())
  /** 지금 보는 경계. 다른 곳으로 가면 지운다. */
  const [activeBoundary, setActiveBoundary] = useState<string | null>(null)
  const cursorRef = useRef<{ key: string; pos: number } | null>(null)
  /** 화면(다음 버튼 글자)용 사본. 이동 계산은 ref로 한다 — 같은 틱에 여러 번 옮겨도 최신을 본다. */
  const [cursorShown, setCursorShown] = useState<{ key: string; pos: number } | null>(null)
  const setCursor = useCallback((next: { key: string; pos: number } | null) => {
    cursorRef.current = next
    setCursorShown(next)
  }, [])
  const [pending, setPending] = useState<Pending | null>(null)
  /** 한자 키(오른쪽 Ctrl)가 눌려 있는가, 언제 눌렀나/썼나. */
  const hanjaRef = useRef({ held: false, at: 0 })

  /** 장이 바뀌는 곳 — 다음 장의 묶음 열쇠. */
  const boundaries = useMemo(() => {
    const keys: string[] = []
    rows.forEach((row, index) => {
      if (index === 0 || rows[index - 1].group.key === row.group.key) return
      // 직접 추가한 줄은 스크린샷이 아니라 경계가 아니다.
      if (row.group.key === MANUAL_GROUP.key || rows[index - 1].group.key === MANUAL_GROUP.key) return
      keys.push(row.group.key)
    })
    return keys
  }, [rows])

  const targets = useMemo(
    () => [
      ...boundaries.map((key) => `b:${key}`),
      ...attentionOrder.flatMap((index) => (rows[index] ? [`n:${rows[index].id}`] : [])),
      ...suspects.flatMap((index) => (rows[index] ? [`s:${rows[index].id}`] : [])),
      'save',
    ],
    [boundaries, attentionOrder, suspects, rows],
  )

  const go = useCallback(
    (key: string, list: readonly string[]) => {
      const root = rootRef.current
      if (!root) return
      setCursor({ key, pos: list.indexOf(key) })
      const kind = targetKind(key)
      setActiveBoundary(kind === 'boundary' ? key.slice(2) : null)

      if (kind === 'boundary') {
        const groupKey = key.slice(2)
        setVisited((prev) => (prev.has(groupKey) ? prev : new Set(prev).add(groupKey)))
        const first = root.querySelector<HTMLElement>(`[data-shot-first="${CSS.escape(groupKey)}"]`)
        const box = first?.closest<HTMLElement>('[data-sheet-scroll]')
        if (!first || !box) return
        if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
          document.activeElement.blur()
        }
        box.scrollIntoView({ block: 'start' })
        // 다음 장 첫 줄을 상자 위쪽 1/3쯤에 — 위에 앞 장 마지막 몇 줄이 보이게.
        const offset = first.getBoundingClientRect().top - box.getBoundingClientRect().top
        box.scrollTop += offset - box.clientHeight / 3
        return
      }

      let input: HTMLElement | null = null
      if (kind === 'names') {
        const index = rows.findIndex((row) => row.id === key.slice(2))
        input = root.querySelector(`[data-attention-name="${index}"] input`)
      } else if (kind === 'scores') {
        input = root.querySelector(
          `[data-score-cell="${CSS.escape(key.slice(2))}"][data-column="${orderColumn}"] input`,
        )
      } else {
        input = root.querySelector('[data-score-save]')
      }
      if (!input) return
      input.focus({ preventScroll: true })
      input.scrollIntoView({ block: 'center' })
      if (input instanceof HTMLInputElement) input.select()
    },
    [rootRef, rows, orderColumn, setCursor],
  )

  /** 다음(+1)·이전(−1) 할 곳으로. */
  const move = useCallback(
    (step: 1 | -1) => {
      if (targets.length === 0) return
      const cursor = cursorRef.current
      let next: number
      if (!cursor) next = 0
      else {
        const at = targets.indexOf(cursor.key)
        // 열쇠가 사라졌으면(확정돼 수정 영역에서 빠짐 등) 뒤 것이 그 자리로 당겨져 있다.
        next = at >= 0 ? at + step : step > 0 ? cursor.pos : cursor.pos - 1
      }
      next = Math.min(Math.max(next, 0), targets.length - 1)
      go(targets[next], targets)
    },
    [targets, go],
  )

  /** 그 단계의 첫 할 곳으로. 할 것이 없으면 그 단계의 첫 자리(경계면 첫 경계). */
  const goToStep = useCallback(
    (step: ScoreStepKey) => {
      const prefix = step === 'boundary' ? 'b:' : step === 'names' ? 'n:' : step === 'scores' ? 's:' : null
      if (!prefix) return
      const key =
        step === 'boundary'
          ? (targets.find((target) => target.startsWith('b:') && !visited.has(target.slice(2))) ??
            targets.find((target) => target.startsWith('b:')))
          : targets.find((target) => target.startsWith(prefix))
      // 점수 의심 칸이 없으면 저장 칸으로 — 수정 영역 마지막 줄에서 엔터를 쳤을 때 갈 곳.
      if (key) go(key, targets)
      else if (step === 'scores') go('save', targets)
    },
    [targets, visited, go],
  )

  // 이름·점수 칸에 포커스가 가면 커서도 따라간다.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      const name = target.closest('[data-attention-name]')
      const cell = target.closest('[data-score-cell]')
      let key: string | null = null
      if (name) {
        const row = rows[Number(name.getAttribute('data-attention-name'))]
        if (row) key = `n:${row.id}`
      } else if (cell) {
        key = `s:${cell.getAttribute('data-score-cell')}`
      }
      if (key && targets.includes(key)) {
        setCursor({ key, pos: targets.indexOf(key) })
        setActiveBoundary(null)
      }
    }
    root.addEventListener('focusin', onFocus)
    return () => root.removeEventListener('focusin', onFocus)
  }, [rootRef, rows, targets, setCursor])

  // Ctrl+↓ / Ctrl+↑ — 입력칸 안에서도. 탭이 보일 때만.
  //
  // **오른쪽 Ctrl도 받는다**(2026-10-04 사용자 발견). 한국어 키보드에서 오른쪽 Ctrl은 대개 **한자 키**로
  // 잡혀서 브라우저가 `ctrlKey`로 보지 않는다 — 그대로 두면 방향키만 눌린 것이라 천천히 스크롤된다.
  // 한자 키가 눌린 동안(뗄 때까지)도 Ctrl로 친다. 한자 키는 IME가 먹어 떼는 신호가 안 올 수도 있어서,
  // 마지막으로 눌렀거나 써먹은 뒤 `HANJA_HOLD_MS`가 지나면 풀린 것으로 본다.
  useEffect(() => {
    // ref에 둔다 — 화면이 다시 그려지면 이 effect가 다시 걸리는데, 그때 눌림 상태가 풀리면 안 된다.
    const hanja = hanjaRef.current
    const isHanja = (event: KeyboardEvent) =>
      event.key === 'HanjaMode' || event.key === 'Hanja' || event.code === 'Lang2'
    const onKeyDown = (event: KeyboardEvent) => {
      if (isHanja(event)) {
        hanja.held = true
        hanja.at = Date.now()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (event.altKey || event.metaKey) return
      const viaHanja = hanja.held && Date.now() - hanja.at < HANJA_HOLD_MS
      if (!event.ctrlKey && !viaHanja) return
      const root = rootRef.current
      if (!root || root.offsetParent === null || rows.length === 0) return
      event.preventDefault()
      if (viaHanja) hanja.at = Date.now()
      move(event.key === 'ArrowDown' ? 1 : -1)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (isHanja(event)) hanja.held = false
    }
    const release = () => {
      hanja.held = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [rootRef, rows.length, move])

  // 다시 그린 뒤에 해야 하는 이동(새 줄이 생긴 직후, 칸을 고친 직후).
  useEffect(() => {
    if (!pending) return
    const root = rootRef.current
    if (pending.kind === 'first-boundary') {
      const first = targets.find((target) => target.startsWith('b:'))
      // 다시 그려진 화면에서 칸을 찾아 옮기는 일이라 effect에서 한다(커서·경계 표시도 같이 바뀐다).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (first) go(first, targets)
    } else if (pending.kind === 'suspect-after') {
      const from = rows.findIndex((row) => row.id === pending.rowId)
      const after = suspects.find((index) => index > from && rows[index].id !== pending.rowId)
      const any = suspects.find((index) => rows[index].id !== pending.rowId)
      const index = after ?? any
      go(index === undefined ? 'save' : `s:${rows[index].id}`, targets)
    } else if (root) {
      const from = rows.findIndex((row) => row.id === pending.rowId)
      const below = rows[from + 1]
      const input = below
        ? root.querySelector<HTMLInputElement>(
            `[data-score-cell="${CSS.escape(below.id)}"][data-column="${pending.column}"] input`,
          )
        : null
      if (input) {
        input.focus({ preventScroll: true })
        input.scrollIntoView({ block: 'nearest' })
        input.select()
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 한 번 옮기고 끝낸다.
    setPending(null)
  }, [pending, rootRef, rows, suspects, targets, go])

  /** 목록을 비우거나 기록을 열었을 때. */
  const reset = useCallback(() => {
    setVisited(new Set())
    setActiveBoundary(null)
    setCursor(null)
  }, [setCursor])

  const shotCount = useMemo(
    () => new Set(rows.flatMap((row) => (row.group.key === MANUAL_GROUP.key ? [] : [row.group.key]))).size,
    [rows],
  )
  const visitedCount = boundaries.filter((key) => visited.has(key)).length
  const steps: ScoreStep[] = [
    { key: 'upload', label: '업로드', detail: `${shotCount}장 · ${rows.length}줄`, done: rows.length > 0 },
    {
      key: 'boundary',
      label: '경계 중복',
      detail:
        boundaries.length === 0
          ? '경계 없음'
          : `경계 ${visitedCount}/${boundaries.length} 확인${duplicateCount > 0 ? ` · 중복 의심 ${duplicateCount}줄` : ''}`,
      done: visitedCount === boundaries.length && duplicateCount === 0,
    },
    {
      key: 'names',
      label: '닉네임',
      detail: attentionOrder.length > 0 ? `${attentionOrder.length}줄 남음` : '모두 확정',
      done: attentionOrder.length === 0,
    },
    {
      key: 'scores',
      label: '점수',
      detail:
        suspects.length > 0
          ? `${suspects.length}칸 남음`
          : orderConflicts > 0
            ? `순서 어긋남 ${orderConflicts}곳`
            : '의심 칸 없음',
      done: suspects.length === 0 && orderConflicts === 0,
    },
  ]
  const current = steps.find((step) => !step.done)?.key ?? null

  /** 다음 버튼 글자 — 다음에 갈 곳의 종류. */
  const cursor = cursorShown
  const nextKey = (() => {
    if (!cursor) return targets[0]
    const at = targets.indexOf(cursor.key)
    return targets[Math.min(at >= 0 ? at + 1 : cursor.pos, targets.length - 1)]
  })()
  const nextLabel = nextKey
    ? { boundary: '다음 경계', names: '다음 줄', scores: '다음 의심 칸', save: '저장 칸' }[targetKind(nextKey)]
    : '다음'

  return {
    steps,
    current,
    nextLabel,
    activeBoundary,
    boundaryPosition: activeBoundary ? boundaries.indexOf(activeBoundary) + 1 : 0,
    boundaryCount: boundaries.length,
    next: () => move(1),
    prev: () => move(-1),
    goToStep,
    reset,
    /** 새 줄을 받은 직후 — 첫 경계로. */
    showFirstBoundary: () => setPending({ kind: 'first-boundary' }),
    /** 점수 의심 칸에서 엔터 친 뒤 — 다음 의심 칸으로(없으면 저장 칸). */
    afterSuspectEnter: (rowId: string) => setPending({ kind: 'suspect-after', rowId }),
    /** 의심 칸을 다 본 뒤 칸에서 엔터 — 같은 열 아래 칸으로. */
    afterCellEnter: (rowId: string, column: ScoreColumn) => setPending({ kind: 'cell-below', rowId, column }),
  }
}
