/** 인식한 줄을 **스크린샷 조각으로 다시 보여주기** 위한 잘라내기.
 *
 * OCR이 못 읽은 줄은 결국 사람이 판단해야 하는데, 지금까지는 점수 숫자를
 * 열쇠로 스크린샷에서 그 줄을 눈으로 찾아야 했다. 그 줄의 그림을 바로 옆에
 * 붙여 주면 찾는 일이 사라진다.
 *
 * **가로는 글자가 아니라 열 경계로 자른다.** 글자 영역을 실제보다 좁게
 * 잡는 일이 있어서다 — 실측에서 `왕만두`의 `곽`이 칸 밖으로 밀려 잘려
 * 나갔고, 그림만 보면 왜 틀렸는지 알 수 없었다. 열은 표 전체에서 잡은
 * 것이라 한 줄의 실수에 흔들리지 않는다.
 */

import type { OcrRow, TableInspection } from '@/lib/ocr-table'

export interface Strip {
  url: string
  width: number
  height: number
}

export interface StripBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 글자가 칸에 딱 붙어 있으면 보기 힘들다. 조금 넓게 딴다. */
const PAD = 6

/** 닉네임 열이 차지하는 가로 범위.
 *
 * **열 경계까지가 아니라 옆 열 글자 직전까지** 잡는다. 경계는 두 열 중심의
 * 한가운데라, 긴 이름은 그걸 넘어간다 — 실측에서 `박하늘(박하늘)`이 `박하늘(강효`
 * 에서 잘렸다. 옆 열에서 가장 왼쪽 글자 바로 앞까지 넓히면 이름이 온전히
 * 들어오면서 옆 열 숫자는 안 들어온다.
 *
 * 왼쪽 끝도 같은 식으로 표 전체에서 가장 왼쪽에 잡힌 글자에 맞춘다 — 한 줄만
 * 좁게 잡혀도 다른 줄들이 진짜 왼쪽 끝을 알려 준다. */
export function nameColumnRange(inspection: TableInspection): { x0: number; x1: number } | null {
  const [name, next] = inspection.columns
  if (!name) return null

  const boxes = inspection.cellBoxes.filter((box) => box.column === 0)
  const border = next
    ? (name.center + next.center) / 2
    : boxes.reduce((max, box) => Math.max(max, box.x1), -Infinity)
  if (!Number.isFinite(border)) return null
  // 옆 열 글자가 시작하는 자리. 넉넉히 2px 앞에서 끊는다.
  const neighbour = inspection.cellBoxes
    .filter((box) => box.column !== null && box.column > 0)
    .reduce((min, box) => Math.min(min, box.x0), Infinity)
  const right = Number.isFinite(neighbour) ? Math.max(border, neighbour - 2) : border

  // 닉네임 열을 못 찾았으면 0번 열은 닉네임이 아니다(직위나 직업일 수 있다).
  // 닉네임은 **그 왼쪽 어딘가**에 읽히지 않은 채로 있으니, 왼쪽 끝까지 다
  // 보여 준다. 넓어도 답이 그 안에 있는 편이 낫다.
  const left = inspection.nameColumnFound
    ? boxes.reduce((min, box) => Math.min(min, box.x0), Infinity)
    : 0
  const x0 = Number.isFinite(left) ? left : 0
  if (right <= x0) return null
  return { x0, x1: right }
}

/** 그 행의 닉네임 자리.
 *
 * 세로는 **이름 칸에 맞춘다** — 그 줄에 걸린 칸을 다 합치면 다른 열의 키 큰
 * 칸까지 끌어온다. 그래도 한 줄 높이(전처리 후 32px)보다 큰 조각이 나오는데,
 * 표를 복원할 때 두 줄이 한 행으로 묶이면 그 행의 세로 범위가 실제로 두 줄에
 * 걸치기 때문이다(실측 32~71px). 잘라서 줄이면 글자가 반만 남을 수 있어
 * **넓은 쪽으로 둔다** — 위아래가 조금 더 보이는 건 읽는 데 방해가 안 된다. */
export function nameStripBox(inspection: TableInspection, row: OcrRow): StripBox | null {
  const range = nameColumnRange(inspection)
  if (!range) return null
  const onRow = inspection.cellBoxes.filter((box) => box.y0 <= row.y && box.y1 >= row.y)
  const named = onRow.filter((box) => box.column === 0)
  const source = named.length > 0 ? named : onRow
  if (source.length === 0) return null
  return {
    ...range,
    y0: source.reduce((min, box) => Math.min(min, box.y0), Infinity),
    y1: source.reduce((max, box) => Math.max(max, box.y1), -Infinity),
  }
}

/** 그 행의 **열마다** 칸 영역. 열 번호 → 원본 스크린샷 좌표의 상자.
 *
 * 점수 입력에서 칸마다 그림과 값을 나란히 두기 위해 쓴다. 글자 상자가 아니라
 * **열 경계**로 자른다 — 그 칸을 못 읽었어도 그림은 나온다(사람이 그림을 보고
 * 채우면 된다). 가로 경계는 이웃 열 중심의 한가운데, 닉네임 열은
 * `nameColumnRange`를 쓴다. 세로는 그 행에 걸린 글자 상자의 범위, 없으면 글자
 * 높이로 잡는다.
 *
 * 좌표는 `frame`으로 원본 스크린샷 기준으로 되돌린다 — 흑백 반전한 전처리
 * 그림이 아니라 사람이 게임에서 보던 색 그대로 보여주려고. */
export function rowCellBoxes(
  inspection: TableInspection,
  row: OcrRow,
  frame: { x0: number; y0: number; scale: number },
): StripBox[] {
  const centers = inspection.columns.map((column) => column.center)
  if (centers.length === 0) return []
  const onRow = inspection.cellBoxes.filter((box) => box.y0 <= row.y && box.y1 >= row.y)
  const half = inspection.glyphHeight * 0.9
  const y0 = onRow.length > 0 ? Math.min(...onRow.map((box) => box.y0)) : row.y - half
  const y1 = onRow.length > 0 ? Math.max(...onRow.map((box) => box.y1)) : row.y + half
  const name = nameColumnRange(inspection)

  const toOriginal = (box: StripBox): StripBox => ({
    x0: frame.x0 + box.x0 / frame.scale,
    x1: frame.x0 + box.x1 / frame.scale,
    y0: frame.y0 + box.y0 / frame.scale,
    y1: frame.y0 + box.y1 / frame.scale,
  })

  return centers.map((center, index) => {
    const left = index === 0 ? (name?.x0 ?? center - ((centers[1] ?? center + inspection.columnGap) - center) / 2) : (centers[index - 1] + center) / 2
    const right =
      index === 0 && name
        ? name.x1
        : index < centers.length - 1
          ? (center + centers[index + 1]) / 2
          : center + (center - left)
    return toOriginal({ x0: left, x1: right, y0, y1 })
  })
}

/** 조각을 그릴 캔버스. 조각마다 새로 만들지 않고 크기만 바꿔 다시 쓴다. */
let scratch: HTMLCanvasElement | null = null

/** 한 조각을 잘라 **데이터 URL**로 만든다. 그림으로 보여줄 것도, 다시 읽힐
 * 것도 여기서 나온다.
 *
 * **`convertToBlob`/`toBlob`을 쓰지 않는다.** 둘 다 비동기라, 탭이 화면에
 * 안 보이면(다른 창에 가려졌거나 다른 탭을 보는 중) 크롬이 한 번에 **약 1초**로
 * 묶어 버린다(실측 88×34 조각 하나에 1,004ms). 줄마다 이름·숫자 칸을 따면 한
 * 장에 100번 가까이 부르므로, 인식을 기다리며 다른 창을 보면 진행률 100% 뒤에
 * 장당 1~2분이 멈춘 것처럼 걸렸다. `toDataURL`은 동기라 그런 일이 없다(0ms).
 *
 * 데이터 URL은 `URL.revokeObjectURL`로 돌려줄 필요도 없다 — 문자열이라 안 쓰면
 * 그냥 사라진다. 조각이 작아(수 KB) 수백 개를 들고 있어도 괜찮다. */
export function cropImage(
  bitmap: ImageBitmap,
  box: StripBox,
  pad = PAD,
): Strip | null {
  const x = Math.max(0, Math.floor(box.x0 - pad))
  const y = Math.max(0, Math.floor(box.y0 - pad))
  const width = Math.min(bitmap.width - x, Math.ceil(box.x1 - box.x0 + pad * 2))
  const height = Math.min(bitmap.height - y, Math.ceil(box.y1 - box.y0 + pad * 2))
  if (width <= 0 || height <= 0) return null
  scratch ??= document.createElement('canvas')
  scratch.width = width
  scratch.height = height
  const context = scratch.getContext('2d')
  if (!context) return null
  context.drawImage(bitmap, x, y, width, height, 0, 0, width, height)
  return { url: scratch.toDataURL('image/png'), width, height }
}

/** 한 줄에서 딴 그림 조각들.
 *
 * 손이 필요한 줄에서는 이름뿐 아니라 **저장할 점수 칸도** 그림과 견줘 고칠 수
 * 있어야 한다. 점수는 사람이 눈으로 검산하지 않는 값이라, 이름만 맞춰 두면
 * 한 자리 틀린 숫자가 그대로 저장된다. */
export interface RowStrips {
  /** 닉네임 자리. 칸을 못 잡으면 `null`. */
  name: Strip | null
  /** 숫자 순번 → 그 칸의 그림.
   *
   * **열 번호가 아니라 그 줄에서 몇 번째 숫자인지로** 매단다. 붙여넣기 쪽
   * (`parseLine`)이 숫자를 그 순서로 모으고, 점수 열도 그 순번으로 고르기
   * 때문이다. */
  numbers: Record<number, Strip>
}
