/** 개발용 OCR 점검 페이지 (`/dev/ocr`).
 *
 * 인식률이 왜 떨어지는지는 **숫자만 봐서는 알 수 없다.** 어디서 틀어졌는지
 * 보려면 단계를 하나씩 눈으로 따라가야 한다. 그래서 처리 과정을 네 단계로
 * 나눠 보여준다.
 *
 * 1. **원본**과 거기서 찾아낸 길드 창 영역
 * 2. **전처리 결과** — 잘라내고, 명암을 뒤집고, 두 배로 키운 그림
 * 3. **표 복원** — 어느 글자가 어느 열로 갔는지 색으로
 * 4. **행 하나하나** — 그 줄의 그림 조각, 읽은 글자, 정제한 글자, 명단 대조
 *
 * 4번이 핵심이다. `그림 → 읽은 글자 → 보정된 글자`를 한 줄에 나란히 놓으면
 * **"OCR이 못 읽은 것"과 "읽었는데 대조가 틀린 것"이 바로 갈린다.**
 *
 * **개발 빌드에서만 붙는다**(`App.tsx`에서 `import.meta.env.DEV`로 가른다).
 */

import { useCallback, useMemo, useRef, useState } from 'react'

import type { PSM as PageSegMode, Worker } from 'tesseract.js'

import {
  AttentionList,
  type AttentionKind,
  type AttentionRow,
} from '@/components/guild-admin/attention-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api-client'
import { matchToRoster, parseScore, type MatchConfidence } from '@/lib/guild-score'
import { claimName, takenRows } from '@/lib/name-claims'
import { detectPanel, preprocessForOcr, shouldCrop, type PanelRect } from '@/lib/ocr-image'
import { inspectTable, looksUnderread, type OcrPage, type TableInspection } from '@/lib/ocr-table'
import { cropImage, nameStripBox, type Strip } from '@/lib/ocr-strip'
import { guessColumns, type ColumnGuess, type ScoreContent } from '@/lib/score-columns'

/** 열마다 다른 색을 준다. 오버레이에서 열이 갈린 게 눈에 보여야 한다. */
const COLUMN_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
]

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  exact: '그대로 맞음',
  corrected: '보정함',
  ambiguous: '후보 여럿',
  none: '못 찾음',
}

const CONFIDENCE_CLASS: Record<MatchConfidence, string> = {
  exact: 'text-emerald-600',
  corrected: 'text-sky-600',
  ambiguous: 'text-amber-600',
  none: 'text-red-600',
}

const KIND_LABEL: Record<string, string> = {
  level: '레벨',
  'weekly-mission': '주간미션',
  underground: '지하수로',
  'flag-race': '플래그레이스',
  unknown: '?',
}

/** 오려낸 그림 한 조각. */
/** 점수 열 하나 — 그림과 읽은 글자를 짝지어 둔다.
 *
 * 닉네임만 그림과 맞춰 보면 **숫자가 틀린 경우를 못 잡는다.** 점수는 저장되는
 * 값이라 틀리면 바로 손해인데, 글자만 봐서는 `198,462`가 맞는지 알 수 없다. */
interface ScoreCell {
  label: string
  text: string
  strip: Strip | null
}

/** 한 행의 처리 과정. 그림부터 최종 판정까지 한 줄에 모은다. */
interface RowView {
  index: number
  /** 그 행의 닉네임 칸만 오려낸 그림. 없으면 칸을 못 찾은 것이다. */
  /** 그 줄의 닉네임 자리 그림. 칸을 못 잡으면 `null`. */
  strip: Strip | null
  /** `kor+eng` 패스가 읽은 글자. */
  mainText: string
  /** `kor` 전용 패스가 읽은 글자. 둘이 다르면 그 자체가 단서다. */
  altText: string
  /** 정제한 값 — 괄호 뒤를 버리고 잘림 표시를 뗀 것. */
  cleaned: string
  matched: string | null
  confidence: MatchConfidence
  suggestions: string[]
  /** 어느 패스의 결과를 골랐는지. */
  from: 'kor+eng' | 'kor'
  /** 주간미션·지하수로·플래그레이스. 값으로 가려낸 열만 담는다. */
  scores: ScoreCell[]
  /** 점수로 못 가린 나머지 칸(직업·레벨·직위 등). */
  rest: string[]
}

interface Result {
  name: string
  /** 원본 그림. 검출한 영역을 위에 겹쳐 보여준다. */
  originalUrl: string
  originalWidth: number
  originalHeight: number
  panel: PanelRect | null
  /** 전처리를 거친 그림. 오버레이의 바탕이 된다. */
  imageUrl: string
  width: number
  height: number
  inspection: TableInspection
  guesses: ColumnGuess[]
  rows: RowView[]
  retried: boolean
  ms: number
}

export function DevOcrPage() {
  const [roster, setRoster] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [guildName, setGuildName] = useState('')
  const [worldName, setWorldName] = useState('')
  const [rosterNote, setRosterNote] = useState<string | null>(null)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  /** 직전 실행이 만든 그림 주소들. 다음 실행을 시작할 때 놓아준다.
   *
   * **컴포넌트가 사라질 때 놓아주면 안 된다.** 개발 모드의 `StrictMode`가
   * effect를 두 번 돌리면서 cleanup이 먼저 실행돼, 화면에 붙어 있는 그림의
   * 주소까지 지워 버린다(실제로 원본이 깨져 나왔다). */
  const urlsRef = useRef<string[]>([])

  const rosterNames = roster
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean)

  /** 길드명·월드명으로 명단을 불러와 아래 칸을 채운다.
   *
   * 손으로 1,000명을 붙여넣을 수는 없다. 조회는 **인증이 필요 없는** 공개
   * 엔드포인트라 키 없이 된다. 채워 넣은 뒤에도 고칠 수 있게 그대로 입력칸에
   * 넣는다 — 명단 일부만 떼어 시험하고 싶을 때가 있다. */
  const loadRoster = useCallback(async () => {
    const guild = guildName.trim()
    const world = worldName.trim()
    if (!guild || !world) return
    setLoadingRoster(true)
    setRosterNote(null)
    try {
      const { data: id, error: idError } = await apiClient.GET('/api/v1/guilds/oguild-id', {
        params: { query: { guild_name: guild, world_name: world } },
      })
      if (idError || !id) {
        setRosterNote('그런 길드를 찾지 못했습니다. 길드명과 월드명을 확인해주세요.')
        return
      }
      const { data: basic, error: basicError } = await apiClient.GET(
        '/api/v1/guilds/{oguild_id}/basic',
        { params: { path: { oguild_id: id.oguild_id } } },
      )
      if (basicError || !basic) {
        setRosterNote('명단을 불러오지 못했습니다.')
        return
      }
      const members = basic.guild_member ?? []
      setRoster(members.join('\n'))
      setRosterNote(`${basic.guild_name} (${basic.world_name}) · ${members.length}명 불러왔습니다.`)
    } catch (caught) {
      // 응답이 아예 안 돌아오는 경우도 있다(서버가 꺼져 있거나, 오류 응답에
      // CORS 헤더가 없거나). 그때도 사용자는 뭔가를 봐야 한다.
      setRosterNote(
        `명단을 불러오지 못했습니다 — ${caught instanceof Error ? caught.message : String(caught)}`,
      )
    } finally {
      setLoadingRoster(false)
    }
  }, [guildName, worldName])

  const run = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setBusy(true)
      setError(null)
      setResults([])
      for (const url of urlsRef.current) URL.revokeObjectURL(url)
      urlsRef.current = []
      try {
        const { createWorker, PSM } = await import('tesseract.js')
        setNote('한글 인식 데이터를 준비하는 중입니다…')
        const workers: Worker[] = []
        for (const langs of ['kor+eng', 'kor']) workers.push(await createWorker(langs, 1))

        const next: Result[] = []
        for (const [index, file] of files.entries()) {
          setNote(`${index + 1}/${files.length} 인식 중 — ${file.name}`)
          const started = performance.now()

          // ① 원본에서 길드 창을 찾는다. 화면에 그려 보여주려고 따로 부른다.
          const original = await createImageBitmap(file)
          const panel = await findPanel(original)

          // ② 전처리.
          const image = await preprocessForOcr(file)
          const bitmap = await createImageBitmap(image)

          // ③ 점수 탭과 **같은 규칙**으로 읽는다. 여기서 본 결과가 거기서도
          //    나와야 진단에 쓸모가 있다.
          const read = async (worker: Worker, psm: PageSegMode) => {
            await worker.setParameters({
              tessedit_pageseg_mode: psm,
              user_defined_dpi: '300',
            })
            const { data } = await worker.recognize(image, {}, { blocks: true })
            return inspectTable(data as OcrPage)
          }
          let mode: PageSegMode = PSM.AUTO
          let inspection = await read(workers[0], mode)
          let retried = false
          if (looksUnderread(inspection)) {
            const again = await read(workers[0], PSM.SINGLE_COLUMN)
            const better = inspection.nameColumnFound
              ? again.rows.length > inspection.rows.length
              : again.nameColumnFound
            if (again.nameColumnFound && better) {
              inspection = again
              mode = PSM.SINGLE_COLUMN
              retried = true
            }
          }
          const alternate = await read(workers[1], mode)

          // ④ 행마다 그림 조각과 두 패스의 글자를 모은다.
          const guesses = guessColumns(inspection.rows)
          const rows = await buildRowViews(bitmap, inspection, alternate, rosterNames, guesses)

          const originalUrl = URL.createObjectURL(file)
          const imageUrl = URL.createObjectURL(image)
          urlsRef.current.push(originalUrl, imageUrl)

          next.push({
            name: file.name,
            originalUrl,
            originalWidth: original.width,
            originalHeight: original.height,
            panel,
            imageUrl,
            width: bitmap.width,
            height: bitmap.height,
            inspection,
            guesses,
            rows,
            retried,
            ms: Math.round(performance.now() - started),
          })
          original.close()
          bitmap.close()
          setResults([...next])
        }
        for (const worker of workers) await worker.terminate()
        setNote(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
        setNote(null)
      } finally {
        setBusy(false)
      }
    },
    [rosterNames],
  )

  const totals = results.reduce(
    (sum, result) => {
      for (const row of result.rows) sum[row.confidence] += 1
      return sum
    },
    { exact: 0, corrected: 0, ambiguous: 0, none: 0 } as Record<MatchConfidence, number>,
  )
  const totalRows = Object.values(totals).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">OCR 점검 (개발용)</h1>
        <p className="text-sm text-muted-foreground">
          스크린샷을 올리면 처리 과정을 네 단계로 보여줍니다 —{' '}
          <strong>원본에서 찾은 영역 → 전처리 → 표 복원 → 행별 비교</strong>. 마지막 단계에서 그
          줄의 그림, 읽은 글자, 보정된 글자를 나란히 놓고 볼 수 있습니다. 개발 빌드에서만 뜹니다.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <label className="text-sm font-medium" htmlFor="dev-ocr-roster">
          길드 명단 (선택)
        </label>
        <p className="text-xs text-muted-foreground">
          길드명·월드명을 넣고 불러오면 자동으로 채워집니다. 넣으면 명단 대조 결과까지 같이
          보여줍니다. 비워 두면 인식 결과만 봅니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={guildName}
            onChange={(event) => setGuildName(event.target.value)}
            placeholder="길드명"
            className="max-w-40"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadRoster()
            }}
          />
          <Input
            value={worldName}
            onChange={(event) => setWorldName(event.target.value)}
            placeholder="월드명 (예: 스카니아)"
            className="max-w-40"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadRoster()
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={loadingRoster || !guildName.trim() || !worldName.trim()}
            onClick={() => void loadRoster()}
          >
            {loadingRoster ? '불러오는 중…' : '명단 불러오기'}
          </Button>
          {rosterNote && <span className="text-xs text-muted-foreground">{rosterNote}</span>}
        </div>
        <textarea
          id="dev-ocr-roster"
          value={roster}
          onChange={(event) => setRoster(event.target.value)}
          rows={4}
          className="w-full rounded-md border bg-transparent p-2 font-mono text-xs"
          placeholder={'고구마라떼\n다섯별\n눈사람이'}
        />
        <span className="text-xs text-muted-foreground">{rosterNames.length}명</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            void run(files)
          }}
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          스크린샷 고르기
        </Button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {totalRows > 0 && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">
            전체 {totalRows}행 · 자동 처리율{' '}
            {(((totals.exact + totals.corrected) / totalRows) * 100).toFixed(1)}%
          </p>
          <p className="text-muted-foreground">
            그대로 맞음 {totals.exact} · 보정함 {totals.corrected} · 후보 여럿 {totals.ambiguous} ·
            못 찾음 {totals.none}
            {rosterNames.length === 0 && ' (명단을 안 넣어서 전부 못 찾음으로 잡힙니다)'}
          </p>
        </div>
      )}

      {results.map((result) => (
        <ResultView key={result.name} result={result} roster={rosterNames} />
      ))}
    </div>
  )
}

/** 원본에서 길드 창을 찾는다. 잘라낼 만하지 않으면 `null`. */
async function findPanel(original: ImageBitmap): Promise<PanelRect | null> {
  const canvas = new OffscreenCanvas(original.width, original.height)
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(original, 0, 0)
  const { data } = context.getImageData(0, 0, original.width, original.height)
  const rect = detectPanel(data, original.width, original.height)
  return shouldCrop(rect, original.width, original.height) ? rect : null
}

/** 행마다 닉네임 칸 그림과 두 패스의 글자를 모은다. */
async function buildRowViews(
  bitmap: ImageBitmap,
  inspection: TableInspection,
  alternate: TableInspection,
  roster: readonly string[],
  guesses: readonly ColumnGuess[],
): Promise<RowView[]> {
  // 값으로 가려낸 점수 열만 그림과 함께 보여준다. 순서는 화면과 같게 둔다.
  const scoreColumns = (['weekly-mission', 'underground', 'flag-race'] as const)
    .map((kind) => ({ kind, guess: guesses.find((guess) => guess.kind === kind) }))
    .filter((entry): entry is { kind: ScoreContent; guess: ColumnGuess } => Boolean(entry.guess))
  const scoreIndexes = new Set(scoreColumns.map((entry) => entry.guess.index))

  const rank: Record<MatchConfidence, number> = {
    exact: 3,
    corrected: 2,
    ambiguous: 1,
    none: 0,
  }
  const views: RowView[] = []
  for (const [index, row] of inspection.rows.entries()) {
    // 같은 y에 있는 다른 패스의 줄을 짝짓는다. 점수 탭과 같은 규칙이다.
    const twin = alternate.rows.find((other) => Math.abs(other.y - row.y) <= 20)
    const mainText = row.cells[0] ?? ''
    const altText = twin?.cells[0] ?? ''
    const main = matchToRoster(mainText, roster)
    const alt = matchToRoster(altText, roster)
    const useAlt = rank[alt.confidence] > rank[main.confidence]
    const best = useAlt ? alt : main

    const boxAt = (column: number) =>
      inspection.cellBoxes.find(
        (candidate) =>
          candidate.column === column && candidate.y0 <= row.y && candidate.y1 >= row.y,
      )

    // **칸이 아니라 열 폭으로** 딴다. 글자 영역을 좁게 잡아 첫 글자가 잘려
    // 나가는 일이 있었다(실측 `왕만두` → `만두`).
    const nameBox = nameStripBox(inspection, row)
    const strip = nameBox ? cropImage(bitmap, nameBox) : null

    const scores: ScoreCell[] = []
    for (const entry of scoreColumns) {
      const cellBox = boxAt(entry.guess.index)
      scores.push({
        label: KIND_LABEL[entry.kind],
        text: row.cells[entry.guess.index] ?? '',
        strip: cellBox ? cropImage(bitmap, cellBox) : null,
      })
    }

    views.push({
      index,
      strip,
      mainText,
      altText,
      cleaned: best.cleaned,
      matched: best.matched,
      confidence: best.confidence,
      suggestions: best.suggestions,
      from: useAlt ? 'kor' : 'kor+eng',
      scores,
      rest: row.cells.filter((_, index) => index !== 0 && !scoreIndexes.has(index)),
    })
  }
  return views
}

/** 오버레이를 몇 배로 볼지. 전처리가 2배로 키워 놓아서 원본 크기로 두면
 * 가로로 넘친다 — 기본은 절반(=원본 스크린샷 크기)으로 본다. */
const ZOOMS = [0.5, 0.75, 1]

/** 수정 영역의 이름 칸이 물고 있을 `<datalist>`의 id. */
const DEV_ROSTER_LIST_ID = 'dev-ocr-roster-names'

const STEPS = ['① 원본', '② 전처리', '③ 표 복원', '④ 행별 비교']

function ResultView({ result, roster }: { result: Result; roster: readonly string[] }) {
  const { inspection } = result
  const [zoom, setZoom] = useState(ZOOMS[0])
  const [step, setStep] = useState(4)
  /** 수정 영역을 여기서도 써 본다. 점수 탭은 넥슨 키 인증 뒤에
   * 있어서, 확정·직접 입력·점수 고치기가 제대로 도는지 인증 없이 확인할 곳이
   * 여기뿐이다. 규칙은 점수 탭과 같다(`lib/name-claims.ts`).
   *
   * 줄 번호를 문자열로 바꿔 열쇠로 쓴다 — 여기서는 입력창이 없어 줄이 밀릴
   * 일이 없다. */
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  /** 이름을 빼앗긴 줄 → 빼앗긴 이름. 가져간 줄을 찾아 나란히 보여주려고. */
  const [robbed, setRobbed] = useState<Readonly<Record<number, string>>>({})
  /** 중복으로 뺀 줄. 여기서는 입력창이 없어 표시만 해 둔다. */
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set())
  /** 고친 점수. `줄|점수 칸 순번` → 값. */
  const [scoreEdits, setScoreEdits] = useState<Record<string, string>>({})
  const memberSet = useMemo(() => new Set(roster), [roster])

  const overrides = useMemo(() => {
    const map: Record<number, string> = {}
    for (const [key, name] of Object.entries(nameOverrides)) {
      if (memberSet.has(name)) map[Number(key)] = name
    }
    return map
  }, [nameOverrides, memberSet])
  const typedUnknown = (index: number): string | undefined => {
    const name = nameOverrides[String(index)]
    return name !== undefined && !memberSet.has(name) ? name : undefined
  }
  const taken = useMemo(
    () =>
      takenRows(
        result.rows.map((row) =>
          nameOverrides[String(row.index)] !== undefined || removed.has(row.index)
            ? null
            : row.matched,
        ),
        overrides,
      ),
    [result.rows, nameOverrides, overrides, removed],
  )

  const resolved = result.rows.map((row) =>
    typedUnknown(row.index) !== undefined || removed.has(row.index)
      ? null
      : (overrides[row.index] ?? (taken.has(row.index) ? null : row.matched)),
  )

  const pickName = (index: number, name: string) => {
    const { next, robbed: lost } = claimName(nameOverrides, String(index), name)
    setNameOverrides(next)
    setRobbed((prev) => {
      const updated = { ...prev }
      for (const key of lost) updated[Number(key)] = name
      if (name) delete updated[index]
      return updated
    })
  }

  /** 중복으로 뺀다. 그 줄이 확정해 둔 이름도 풀어 준다. */
  const removeRow = (index: number) => {
    setRemoved((prev) => new Set(prev).add(index))
    setNameOverrides((prev) => {
      const next = { ...prev }
      delete next[String(index)]
      return next
    })
  }

  /** 점수 칸들. 수정 영역의 줄과 견줄 줄이 같은 모양으로 쓴다. */
  const scoresOf = (row: RowView) =>
    row.scores.map((cell, position) => {
      const key = `${row.index}|${position}`
      return {
        key: String(position),
        label: cell.label,
        value: scoreEdits[key] ?? (parseScore(cell.text)?.toLocaleString('ko-KR') ?? ''),
        edited: scoreEdits[key] !== undefined,
        numeric: true,
        strip: cell.strip,
      }
    })

  /** 이미 어느 줄이 달고 있는 이름. 후보에서 뺀다. */
  const claimed = new Set(resolved.filter((name): name is string => name !== null))
  /** 이름 → 먼저 가진 줄. 확정한 줄이 먼저다(점수 탭과 같은 규칙). 뒤에 같은
   * 이름을 단 줄은 "앞줄과 중복"으로 수정 영역에 올린다. */
  const holderOf = new Map<string, RowView>()
  for (const row of result.rows) {
    if (overrides[row.index] !== undefined) holderOf.set(overrides[row.index], row)
  }
  const duplicateOf = new Set<number>()
  for (const row of result.rows) {
    const name = resolved[row.index]
    if (name === null || overrides[row.index] !== undefined) continue
    if (holderOf.has(name)) duplicateOf.add(row.index)
    else holderOf.set(name, row)
  }
  const attention: AttentionRow[] = result.rows.flatMap((row) => {
    if (overrides[row.index] !== undefined || removed.has(row.index)) return []
    const picked = resolved[row.index]
    const typed = typedUnknown(row.index)
    const lostName = taken.has(row.index) ? (row.matched ?? undefined) : robbed[row.index]
    const taker =
      lostName === undefined
        ? undefined
        : result.rows.find((other) => overrides[other.index] === lostName)
    let kind: AttentionKind | null = null
    if (lostName !== undefined) kind = 'taken'
    else if (duplicateOf.has(row.index)) kind = 'duplicate'
    else if (picked === null) kind = row.suggestions.length > 0 ? 'ambiguous' : 'none'
    else if (row.confidence !== 'exact') kind = 'corrected'
    if (kind === null) return []
    return [
      {
        index: row.index,
        kind,
        read: row.cleaned || row.mainText,
        picked,
        typed,
        candidates: row.suggestions.filter((name) => !claimed.has(name)),
        strip: row.strip,
        cells: scoresOf(row),
        compareWith: (() => {
          if (taker && lostName !== undefined) {
            return { title: '가져간 줄', name: lostName, strip: taker.strip, cells: scoresOf(taker) }
          }
          const holder = picked === null ? undefined : holderOf.get(picked)
          if (duplicateOf.has(row.index) && holder && picked !== null) {
            return { title: '앞줄', name: picked, strip: holder.strip, cells: scoresOf(holder) }
          }
          return undefined
        })(),
      },
    ]
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{result.name}</span>
        <span className="text-muted-foreground">
          {result.originalWidth}×{result.originalHeight} · {result.ms}ms ·{' '}
          {inspection.rows.length}행
        </span>
        <span className="text-muted-foreground">
          글자 높이 {Math.round(inspection.glyphHeight)}px → 칸 간격{' '}
          {Math.round(inspection.cellGap)} / 열 간격 {Math.round(inspection.columnGap)}
        </span>
        {result.panel && (
          <span className="text-emerald-600">
            게임 UI만 잘라냈습니다 ({result.panel.x1 - result.panel.x0}×
            {result.panel.y1 - result.panel.y0})
          </span>
        )}
        {result.retried && (
          <span className="text-amber-600">
            제대로 못 읽어 SINGLE_COLUMN으로 다시 읽었습니다
          </span>
        )}
        {!inspection.nameColumnFound && (
          <span className="text-red-600">닉네임 열을 못 찾았습니다</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {STEPS.map((label, index) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={step === index + 1 ? 'default' : 'outline'}
            onClick={() => setStep(index + 1)}
          >
            {label}
          </Button>
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            원본 위에 <strong>찾아낸 길드 창 영역</strong>을 그렸습니다. 이 사각형이 표를 벗어나면
            아래 단계는 전부 어긋납니다.
          </p>
          <div className="max-h-[70vh] overflow-auto rounded border">
            <div
              className="relative"
              style={{ width: result.originalWidth, height: result.originalHeight }}
            >
              <img
                src={result.originalUrl}
                alt=""
                width={result.originalWidth}
                height={result.originalHeight}
              />
              {result.panel && (
                <span
                  className="absolute"
                  style={{
                    left: result.panel.x0,
                    top: result.panel.y0,
                    width: result.panel.x1 - result.panel.x0,
                    height: result.panel.y1 - result.panel.y0,
                    outline: '3px solid #10b981',
                    background: 'rgba(16,185,129,0.08)',
                  }}
                />
              )}
            </div>
          </div>
          {!result.panel && (
            <p className="text-xs text-muted-foreground">
              길드 창이 화면의 대부분을 차지해 <strong>잘라내지 않았습니다.</strong> 창 모드로 길드
              창만 찍은 경우가 여기에 해당합니다.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            잘라내고, 명암을 뒤집고, 두 배로 키운 그림입니다.{' '}
            <strong>tesseract가 실제로 보는 것</strong>이 이겁니다 — 사람이 읽기 어려우면 기계도
            어렵습니다.
          </p>
          <div className="max-h-[70vh] overflow-auto rounded border">
            <img src={result.imageUrl} alt="" width={result.width} height={result.height} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {inspection.columns.map((column, index) => {
              const guess = result.guesses[index]
              return (
                <span
                  key={index}
                  className="rounded border px-2 py-1"
                  style={{ borderColor: COLUMN_COLORS[index % COLUMN_COLORS.length] }}
                >
                  열 {index} · x≈{Math.round(column.center)} · {column.count}회
                  {guess && guess.kind !== 'unknown' && (
                    <strong className="ml-1">
                      {KIND_LABEL[guess.kind]} {(guess.confidence * 100).toFixed(0)}%
                    </strong>
                  )}
                </span>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">배율</span>
            {ZOOMS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={zoom === value ? 'default' : 'outline'}
                onClick={() => setZoom(value)}
              >
                {value * 100}%
              </Button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-auto rounded border">
            <div style={{ width: result.width * zoom, height: result.height * zoom }}>
              <div
                className="relative"
                style={{
                  width: result.width,
                  height: result.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <img src={result.imageUrl} alt="" width={result.width} height={result.height} />
                {inspection.cellBoxes.map((box, index) => (
                  <span
                    key={index}
                    title={box.text}
                    className="absolute"
                    style={{
                      left: box.x0,
                      top: box.y0,
                      width: Math.max(1, box.x1 - box.x0),
                      height: Math.max(1, box.y1 - box.y0),
                      outline: `2px solid ${
                        box.column === null
                          ? '#94a3b8'
                          : COLUMN_COLORS[box.column % COLUMN_COLORS.length]
                      }`,
                      background:
                        box.column === null ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.05)',
                    }}
                  />
                ))}
                {inspection.columns.map((column, index) => (
                  <span
                    key={`line-${index}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: column.center,
                      width: 1,
                      background: COLUMN_COLORS[index % COLUMN_COLORS.length],
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            왼쪽부터 <strong>그 줄의 그림 → 읽은 글자 → 정제 → 명단 대조</strong> 순이고, 그
            뒤로 <strong>점수 열도 그림과 글자를 나란히</strong> 놓았습니다. 그림은 읽히는데
            글자가 틀렸으면 OCR 문제, 글자는 맞는데 대조가 틀렸으면 보정 문제입니다. 점수는
            저장되는 값이라 <strong>숫자도 그림과 맞춰 보는 게 좋습니다.</strong>
          </p>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-1">그림</th>
                  <th className="p-1">읽은 글자</th>
                  <th className="p-1">정제</th>
                  <th className="p-1">명단 대조</th>
                  {(result.rows[0]?.scores ?? []).map((cell) => (
                    <th key={cell.label} className="p-1">
                      {cell.label}
                    </th>
                  ))}
                  <th className="p-1">나머지 열</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const picked = resolved[row.index]
                  return (
                    <tr key={row.index} className="border-b align-top">
                      <td className="p-1">
                        {row.strip ? (
                          <img
                            src={row.strip.url}
                            alt=""
                            width={row.strip.width}
                            height={row.strip.height}
                            className="max-w-none"
                          />
                        ) : (
                          <span className="text-muted-foreground">칸 없음</span>
                        )}
                      </td>
                      <td className="p-1 font-mono">
                        <div>{row.mainText || '—'}</div>
                        {row.altText !== row.mainText && (
                          <div className="text-muted-foreground">
                            kor: {row.altText || '—'}
                            {row.from === 'kor' && (
                              <strong className="ml-1 text-sky-600">채택</strong>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-1 font-mono">{row.cleaned || '—'}</td>
                      <td className="p-1">
                        {overrides[row.index] !== undefined ? (
                          <span className="text-violet-600">
                            {overrides[row.index]} (직접 고름)
                          </span>
                        ) : (
                          <span className={CONFIDENCE_CLASS[row.confidence]}>
                            {picked ?? '—'} ({CONFIDENCE_LABEL[row.confidence]})
                          </span>
                        )}
                        {picked === null && row.suggestions.length > 0 && (
                          <div className="text-muted-foreground">
                            후보: {row.suggestions.slice(0, 3).join(' / ')}
                          </div>
                        )}
                      </td>
                      {row.scores.map((cell) => (
                        <td key={cell.label} className="p-1">
                          {cell.strip ? (
                            <img
                              src={cell.strip.url}
                              alt=""
                              width={cell.strip.width}
                              height={cell.strip.height}
                              className="max-w-none"
                            />
                          ) : (
                            <span className="text-muted-foreground">칸 없음</span>
                          )}
                          <div className="font-mono tabular-nums">{cell.text || '—'}</div>
                        </td>
                      ))}
                      <td className="p-1 font-mono">{row.rest.join(' | ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 이름 칸이 물 명단. 줄마다 만들면 1,000개짜리 목록이 수백 벌 생긴다. */}
          <datalist id={DEV_ROSTER_LIST_ID}>
            {roster.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <AttentionList
            rows={attention}
            profiles={{}}
            listId={DEV_ROSTER_LIST_ID}
            onPick={pickName}
            onRemove={removeRow}
            stripZoom={0.5}
            onCell={(index, key, value) =>
              setScoreEdits((prev) => {
                const next = { ...prev }
                if (value === null) delete next[`${index}|${key}`]
                else next[`${index}|${key}`] = value
                return next
              })
            }
          />
        </div>
      )}
    </div>
  )
}
