import { useCallback, useEffect, useRef, useState } from 'react'
import type { PSM as PageSegMode, Worker } from 'tesseract.js'

import { matchToRoster, type MatchConfidence } from '@/lib/guild-score'
import { readJob } from '@/lib/maple-jobs'
import { preprocessWithFrame } from '@/lib/ocr-image'
import { cropImage, rowCellBoxes } from '@/lib/ocr-strip'
import { inspectTable, looksUnderread, type OcrPage, type OcrRow, type TableInspection } from '@/lib/ocr-table'
import {
  classifyColumns,
  emptyValues,
  newRowId,
  type RowGroup,
  type ScoreColumn,
  type SheetRow,
} from '@/lib/score-sheet'

/** 같은 이미지를 두 번 읽는다.
 *
 * 실측에서 남은 오류가 거의 전부 **한글 이름을 영문으로 읽은 것**이었다
 * (`박하늘`→`BEY`, `슝슝`→`ue`, `앵두`→`UF`). 영문을 빼고 한 번 더 읽으면
 * 그 줄들이 한글로 돌아온다. 대신 `SKYWALK` 같은 진짜 영문 이름은 한글
 * 전용 패스가 망치므로, **명단에 더 잘 맞는 쪽**을 골라 쓴다.
 *
 * 12장 표본에서 이 두 번째 패스가 자동 처리율을 71% → 79%로 올렸다. */
const LANGUAGE_PASSES = ['kor+eng', 'kor'] as const

/** OCR이 "제대로 읽었다"고 볼 순서. 높을수록 믿을 만하다. */
const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  exact: 3,
  corrected: 2,
  ambiguous: 1,
  none: 0,
}

/** 두 패스의 행을 같은 행으로 볼 세로 거리(전처리 후 픽셀). */
const ROW_PAIRING_TOLERANCE = 20

/** 칸 그림을 딸 때 둘레에 붙일 여백(원본 픽셀). 글자 상자는 획에 딱 붙게 잡혀서
 * 그대로 자르면 받침 아래가 잘려 보인다. */
const CELL_PAD = 3

export type OcrStatus = 'idle' | 'loading' | 'recognizing' | 'done' | 'error'

/** 한 행을 `SheetRow`로 만든다. 열마다 값과 **원본 스크린샷에서 자른 칸 그림**을 단다. */
function toSheetRow(
  original: ImageBitmap,
  inspection: TableInspection,
  frame: { x0: number; y0: number; scale: number },
  mapping: readonly (ScoreColumn | null)[],
  row: OcrRow,
  name: string,
  group: RowGroup,
): SheetRow {
  const values = emptyValues()
  const strips: SheetRow['strips'] = {}
  mapping.forEach((column, index) => {
    if (column) values[column] = (row.cells[index] ?? '').trim()
  })
  rowCellBoxes(inspection, row, frame).forEach((box, index) => {
    const key = index === 0 ? 'name' : mapping[index]
    if (!key) return
    const strip = cropImage(original, box, CELL_PAD)
    if (strip) strips[key] = strip
  })
  return { id: newRowId(), group, read: name.trim(), values, strips }
}

export interface OcrProgress {
  /** 지금 몇 번째 이미지인지. */
  current: number
  total: number
  /** 0~1. tesseract가 알려주는 그 이미지의 진행률. 본 판독만 센다. */
  ratio: number
  /** 지금 하는 일. 본 판독이 100%가 된 뒤에도 한글 판독·숫자 확인이 남아서,
   * 그걸 안 알리면 100%에서 멈춘 것처럼 보인다. */
  phase: 'reading' | 'checking'
}

/** 점수판 스크린샷에서 표를 읽어 줄로 만든다.
 *
 * **이미지는 서버로 가지 않는다.** 브라우저에서 인식하고, 결과도 브라우저에만
 * 남긴다. 손으로 붙여넣은 줄과 같은 `SheetRow`가 되어 같은 검증(닉네임 정제 →
 * 명단 대조 → 확인)을 탄다.
 */
export function useScoreOcr() {
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workersRef = useRef<Worker[] | null>(null)
  /** 화면에 붙어 있는가. 워커를 만드는 사이 떠났으면 다 만든 워커를 바로 끈다. */
  const aliveRef = useRef(false)
  /** 진행률을 화면에 올릴 때인가. **본 판독 중에만** 올린다.
   *
   * 한글 전용 판독도 같은 진행률을 보내서, 그대로 두면 100%까지 찬 막대가 0으로
   * 돌아갔다가 다시 찬다. 본 판독이 끝나면 `checking` 단계로 넘겨 "다시 확인
   * 중"이라고 알린다 — 100%에서 멈춘 것처럼 보이지 않게. */
  const reportingRef = useRef(false)
  /** 마지막으로 올린 진행률(퍼센트). 같은 퍼센트면 다시 그리지 않는다. */
  const lastPercentRef = useRef(-1)

  // **떠날 때 워커를 끈다.** 웹워커라 안 끄면 학습 데이터(수십 MB)를 문 채로
  // 탭이 닫힐 때까지 남는다. 끈 뒤에 다시 인식하면 `getWorkers`가 새로 만든다.
  // StrictMode가 mount→cleanup→mount로 두 번 부르지만, 그 시점엔 아직 워커가
  // 없어서 끌 것이 없다. (그림 조각은 데이터 URL이라 돌려줄 게 없다.)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      const workers = workersRef.current
      workersRef.current = null
      for (const worker of workers ?? []) void worker.terminate()
    }
  }, [])

  const getWorkers = useCallback(async () => {
    if (workersRef.current) return workersRef.current
    setStatus('loading')
    // **동적으로 불러온다.** tesseract.js 는 초기 번들을 23KB 늘리는데,
    // 길드 관리 화면의 점수 입력에서만 쓴다. 다른 페이지 방문자까지 받을 이유가 없다.
    const { createWorker } = await import('tesseract.js')
    // 학습 데이터(수십 MB)를 처음 한 번 내려받는다. 워커를 재사용해서
    // 이미지를 여러 장 돌릴 때 매번 다시 받지 않게 한다.
    const workers: Worker[] = []
    for (const langs of LANGUAGE_PASSES) {
      const worker = await createWorker(langs, 1, {
        logger: (message) => {
          if (message.status !== 'recognizing text' || !reportingRef.current) return
          const percent = Math.floor(message.progress * 100)
          if (percent === lastPercentRef.current) return
          lastPercentRef.current = percent
          setProgress((prev) => (prev ? { ...prev, ratio: message.progress } : prev))
        },
      })
      workers.push(worker)
    }
    if (!aliveRef.current) {
      for (const worker of workers) await worker.terminate()
      throw new Error('점수 입력 화면을 떠나 인식을 멈췄습니다.')
    }
    workersRef.current = workers
    return workers
  }, [])

  /** 스크린샷 여러 장을 읽어 **장마다** 줄로 만든다.
   *
   * 길드원이 199명이라 한 화면에 안 들어와서 스크롤하며 여러 장을 찍게 된다
   * (실측 12장). 장 사이에 겹치는 행이 생기지만 **여기서 지우지 않는다**
   * (2026-10-04) — 사람이 보고 고르는 편이 낫다고 정했다. 화면이 장 단위로
   * 묶어 보여주고 겹친 줄을 짚는다.
   *
   * `roster`는 길드원 명단이다. 어느 패스의 인식이 나은지 고르는 데만 쓰고,
   * 최종 대조는 화면에서 다시 한다. `firstShot`은 이번 묶음의 첫 장 번호다 —
   * 나눠서 올려도 장 번호가 이어지게. */
  const recognize = useCallback(
    async (files: File[], roster: readonly string[], firstShot = 1): Promise<SheetRow[]> => {
      if (files.length === 0) return []
      setError(null)
      try {
        const { PSM } = await import('tesseract.js')
        const workers = await getWorkers()
        setStatus('recognizing')

        const collected: SheetRow[] = []
        for (let index = 0; index < files.length; index++) {
          setProgress({ current: index + 1, total: files.length, ratio: 0, phase: 'reading' })
          lastPercentRef.current = -1
          const { image, frame } = await preprocessWithFrame(files[index])
          // 칸 그림은 **원본**에서 딴다. 전처리한 그림은 흑백 반전이라 게임에서
          // 보던 것과 달라 견주기 어렵다.
          const original = await createImageBitmap(files[index])

          // tesseract가 화면 구조를 읽는 방식(PSM)을 바꿔가며 본다.
          //
          // 기본값 `AUTO`가 대체로 가장 좋지만, 표를 **행이 아니라 세로 블록**
          // 으로 쪼개 버릴 때가 있다. 그러면 닉네임 열이 통째로 빠진다 —
          // 실측 12장 중 2장이 그랬고, 그 36행이 몽땅 못 맞춘 줄이 됐다.
          //
          // `SINGLE_COLUMN`은 화면을 한 덩이로 보고 읽어서 그 두 장을 살려낸다
          // (맞춘 행 0 → 15, 0 → 14). 다만 **항상 더 나은 건 아니다** — 다른
          // 장에서는 16개 맞추던 것이 0이 되기도 했다. 그래서 놓쳤을 때만
          // 다시 읽는다.
          const read = async (worker: Worker, mode: PageSegMode) => {
            await worker.setParameters({
              tessedit_pageseg_mode: mode,
              // DPI를 못 재면 tesseract가 추정하는데, 게임 화면에서는 그 추정이
              // 들쑥날쑥해 결과가 흔들렸다. 고정해 둔다.
              user_defined_dpi: '300',
            })
            const { data } = await worker.recognize(image, {}, { blocks: true })
            return inspectTable(data as OcrPage)
          }

          let mode: PageSegMode = PSM.AUTO
          reportingRef.current = true
          let main: TableInspection
          try {
            main = await read(workers[0], mode)
          } finally {
            reportingRef.current = false
          }
          setProgress((prev) => (prev ? { ...prev, ratio: 1, phase: 'checking' } : prev))
          if (looksUnderread(main)) {
            const retry = await read(workers[0], PSM.SINGLE_COLUMN)
            // 무엇이 아쉬웠는지에 따라 **받아들이는 기준이 다르다.** 닉네임
            // 열이 없었다면 그걸 찾은 쪽이 낫고, 행이 모자랐다면 더 많이
            // 읽은 쪽이 낫다. 둘 다 아니면 원래 것을 둔다.
            const better = main.nameColumnFound
              ? retry.rows.length > main.rows.length
              : retry.nameColumnFound
            if (retry.nameColumnFound && better) {
              main = retry
              mode = PSM.SINGLE_COLUMN
            }
          }
          // 한글 전용 패스는 **같은 방식으로** 읽어야 y가 맞아 행을 짝지을 수 있다.
          const alternate = (await read(workers[1], mode)).rows

          /** 이 이름이 명단에 얼마나 잘 맞는지. 클수록 낫다. */
          const rank = (value: string) => CONFIDENCE_RANK[matchToRoster(value, roster).confidence]
          const mapping = classifyColumns(main.rows.map((row) => row.cells))
          const shot = firstShot + index
          const group: RowGroup = {
            key: `shot-${shot}-${files[index].name}`,
            label: `${shot}번째 스크린샷 · ${files[index].name}`,
            shot,
          }

          const jobIndex = mapping.indexOf('job')
          for (const row of main.rows) {
            let name = row.cells[0] ?? ''
            let best = rank(name)
            /** 한글 전용 패스에서 이 행과 가장 가까운 줄. 직업을 거기서 읽는다. */
            let paired: OcrRow | null = null
            // 같은 이미지라 y가 일치한다. 가장 가까운 줄을 같은 행으로 본다.
            // 이름은 명단에 더 잘 맞는 쪽을, 숫자는 영문을 포함한 패스(더 안정적)를 쓴다.
            for (const other of alternate) {
              const distance = Math.abs(other.y - row.y)
              if (distance > ROW_PAIRING_TOLERANCE) continue
              if (!paired || distance < Math.abs(paired.y - row.y)) paired = other
              const score = rank(other.cells[0] ?? '')
              if (score > best) {
                name = other.cells[0] ?? ''
                best = score
              }
            }
            const sheetRow = toSheetRow(original, main, frame, mapping, row, name, group)
            // **직업은 한글로 읽고 명단의 이름으로 되돌린다**(2026-10-04 사용자 요청). 직업은 언제나
            // 한글이라 한글 전용 패스가 낫다. 두 패스의 칸 수가 다를 수 있어 그 줄의 칸(이름 칸 빼고)을
            // 다 후보로 보고, 마지막에 본 패스의 직업 칸을 본다. 닮은 게 없으면 읽은 값 그대로.
            // 직업 칸은 레벨(첫 숫자 칸)보다 왼쪽이다. 오른쪽의 직위(`부마스터`)는 직업(`보우마스터`)과
            // 닮아서 후보에서 뺀다.
            const pairedCells = paired?.cells.slice(1) ?? []
            const firstNumber = pairedCells.findIndex((cell) => /^\d[\d,]*$/.test(cell.trim()))
            const job = readJob([
              ...(firstNumber >= 0 ? pairedCells.slice(0, firstNumber) : pairedCells),
              ...(jobIndex >= 0 ? [row.cells[jobIndex] ?? ''] : []),
            ])
            if (job) sheetRow.values.job = job
            collected.push(sheetRow)
          }
          original.close()
        }

        setStatus('done')
        setProgress(null)
        return collected
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
        setProgress(null)
        return []
      }
    },
    [getWorkers],
  )

  /** 워커는 웹워커라 안 끄면 탭이 살아 있는 동안 메모리를 물고 있다. */
  const dispose = useCallback(async () => {
    if (workersRef.current) {
      for (const worker of workersRef.current) await worker.terminate()
      workersRef.current = null
    }
    setStatus('idle')
  }, [])

  return { status, progress, error, recognize, dispose }
}

