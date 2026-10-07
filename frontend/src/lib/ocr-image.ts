/** OCR에 넣기 전에 게임 스크린샷을 손봐 준다.
 *
 * 게임의 길드원 표는 **어두운 배경에 밝은 글자**이고 글자 높이가 12px 남짓이다.
 * tesseract는 그 반대(밝은 배경에 어두운 글자)를 가정하고, 작은 글자에 특히
 * 약하다. 실측 스크린샷 12장으로 잰 자동 처리율은 이 전처리 하나로
 * 50% → 71% 로 올라갔다.
 *
 * 직접 이진화는 **하지 않는다.** 12px 짜리 획을 임계값으로 자르면 글자가
 * 끊어져서 오히려 나빠졌다(같은 표본에서 55%). 명암만 뒤집고 확대해서
 * 넘기고, 이진화는 tesseract의 적응형 알고리즘에 맡긴다.
 */

/** 확대 배율. 2배가 가장 좋았다 — 3배·4배는 오히려 떨어졌다(56%/23%).
 *
 * 확대는 글자를 크게 만들어 주지만 없는 정보를 만들어 내지는 않는다.
 * 과하게 키우면 보간으로 뭉개진 획이 그대로 커져서 손해다. */
const SCALE = 2


/** 게임 UI 패널이 화면에서 이만큼보다 작으면 잘라낸다.
 *
 * 지금 받고 있는 스크린샷은 창에 딱 맞게 찍혀 있어 패널이 화면의 81~97%를
 * 차지한다. 잘라낼 것도 없고, 어설프게 자르면 표의 끝 열이 날아가 오히려
 * 나빠진다. 반면 **전체 화면을 캡처하면** 패널이 31~33%로 떨어지고, 그 상태로
 * 넣으면 tesseract가 표를 아예 못 읽는다(19행 → 0행). 두 경우가 멀찍이
 * 떨어져 있어서 이 값 하나로 안전하게 가른다. */
const CROP_WHEN_PANEL_BELOW = 0.6

/** 찾은 패널 좌우에 남길 여유(패널 너비 대비).
 *
 * 투영은 패널 가장자리에서 값이 떨어져 실제보다 좁게 잡힌다. 딱 맞게 자르면
 * 맨 오른쪽 점수 열이 잘려 맞춘 행이 15 → 2로 떨어졌다. 3%를 남기면 회복하고
 * (15 → 15), 6%까지 늘리면 배경이 섞여 다른 장이 나빠진다. 세로는 한두 행이
 * 잘릴 뿐이라 건드리지 않는다. */
const PANEL_MARGIN_X = 0.03

/** 글자로 볼 밝기. 반전 전 기준이라 글자가 배경보다 밝다. */
const MENU_INK_LUMA = 130

/** 이 정도보다 글자가 적으면 "빈 띠"로 본다(가장 많은 열 대비). */
const MENU_GAP_INK = 0.08

/** 빈 띠가 패널 너비의 이만큼은 돼야 메뉴 경계로 인정한다. */
const MENU_GAP_MIN_WIDTH = 0.04

export interface PanelRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 게임 UI 패널로 보이는 픽셀인가.
 *
 * 길드 창은 **어둡고 채도가 낮다**(실측 rgb 47,53,61 · 채도 0.21 · 명도 61).
 * 게임 화면은 밝고 따뜻하다(채도 0.4~0.8). 이 둘은 잘 갈린다. */
function isPanelPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max
  return max < 150 && saturation < 0.55
}

/** 임계 이상인 가장 긴 연속 구간. */
function longestRun(values: readonly number[], threshold: number): [number, number] {
  let best: [number, number] = [0, 0]
  let start = -1
  for (let i = 0; i <= values.length; i++) {
    const on = i < values.length && values[i] >= threshold
    if (on && start < 0) start = i
    if (!on && start >= 0) {
      if (i - start > best[1] - best[0]) best = [start, i]
      start = -1
    }
  }
  return best
}

/** 게임 UI 패널의 사각형을 찾는다.
 *
 * 가로·세로로 "UI 픽셀 비율"을 투영해 각각 가장 긴 구간을 고른다. 패널은
 * 직사각형이라 이걸로 충분하고 연결요소 분석보다 훨씬 싸다.
 *
 * **임계값을 절대값으로 두면 안 된다.** 패널이 화면의 일부면 투영의 최대치가
 * 패널이 차지하는 비율만큼 눌린다 — 1249px 화면 가운데 729px 패널이면 가로
 * 투영은 아무리 높아야 0.58이다. 0.6으로 자르면 아무것도 안 잡힌다(실제로
 * 그렇게 실패했다). 그래서 **최대치 대비**로 잰다. */
export function detectPanel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  step = 2,
): PanelRect {
  // **가로를 먼저 정하고, 세로는 그 안에서만 잰다.**
  //
  // 세로를 화면 전체로 재면 **화면 아래 퀵슬롯 바처럼 가로로 긴 어두운 띠가
  // 패널을 이긴다.** 1366×768 캡처에서 실제로 그랬다 — 잘라낸 결과가 높이
  // 84px짜리 띠가 되어 표가 통째로 날아갔다. 가로 범위를 먼저 좁히면 그
  // 안에서는 패널이 가장 긴 세로 구간이 된다.
  const columnHits = new Float64Array(width)
  let sampledRows = 0
  for (let y = 0; y < height; y += step) {
    sampledRows += 1
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) << 2
      if (isPanelPixel(pixels[i], pixels[i + 1], pixels[i + 2])) columnHits[x] += 1
    }
  }
  const columnRatio = Array.from(columnHits, (hits) => hits / sampledRows)
  for (let i = 1; i < width; i++) if (i % step !== 0) columnRatio[i] = columnRatio[i - 1]
  const [rawX0, rawX1] = longestRun(columnRatio, Math.max(...columnRatio) * 0.5)

  const spanned = Math.max(1, Math.ceil((rawX1 - rawX0) / step))
  const rows = new Array<number>(height).fill(0)
  for (let y = 0; y < height; y += step) {
    let inRow = 0
    for (let x = rawX0; x < rawX1; x += step) {
      const i = (y * width + x) << 2
      if (isPanelPixel(pixels[i], pixels[i + 1], pixels[i + 2])) inRow += 1
    }
    rows[y] = inRow / spanned
  }
  for (let i = 1; i < height; i++) if (i % step !== 0) rows[i] = rows[i - 1]
  const [y0, y1] = longestRun(rows, Math.max(...rows) * 0.5)
  const margin = Math.round((rawX1 - rawX0) * PANEL_MARGIN_X)
  const x0 = Math.max(0, rawX0 - margin)
  const x1 = Math.min(width, rawX1 + margin)
  return { x0: trimSideMenu(pixels, width, { x0, y0, x1, y1 }), y0, x1, y1 }
}

/** 길드 창 **왼쪽 메뉴**를 잘라낼 x 좌표를 찾는다.
 *
 * 전체 화면 캡처에는 `길드 정보`·`길드원`·`길드 찾기` 같은 왼쪽 메뉴가 같이
 * 들어오는데, 이게 표를 두 가지로 망가뜨린다 — 하나의 열로 잡혀 닉네임 열을
 * 밀어내고, 두 행 사이에 걸쳐 줄 합치기의 다리가 된다.
 *
 * **OCR에 넣기 전에 픽셀로 잘라야 한다.** 읽고 나서 그 글자들을 빼는 것도
 * 해봤지만 오히려 나빠졌다 — 잘못 나뉜 줄은 이미 그렇게 나뉜 뒤다. 실측
 * 34장에서 잘라내기만으로 자동 처리율이 54~66% → 76~87%로 올랐다.
 *
 * 찾는 방법은 간단하다. 메뉴와 표 사이에는 **글자가 없는 세로 띠**가 있다.
 * 패널 왼쪽 절반에서 가장 넓은 빈 띠를 찾아 그 가운데서 자른다. 실측 네 장에서
 * 띠의 끝이 패널 너비의 0.237~0.246 지점으로 한결같았다. */
function trimSideMenu(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  rect: PanelRect,
): number {
  const width = rect.x1 - rect.x0
  if (width <= 0) return rect.x0

  const ink = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    let count = 0
    for (let y = rect.y0; y < rect.y1; y += 2) {
      const i = (y * imageWidth + (x + rect.x0)) << 2
      // 글자는 배경보다 밝다. 여기서는 아직 반전 전이다.
      if (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] > MENU_INK_LUMA) {
        count += 1
      }
    }
    ink[x] = count
  }

  // 글자 사이 빈틈에 속지 않게 평활화한다.
  const smooth = new Float64Array(width)
  const half = Math.max(1, Math.round(width * 0.015))
  for (let x = 0; x < width; x++) {
    let sum = 0
    let n = 0
    for (let k = Math.max(0, x - half); k < Math.min(width, x + half); k++) {
      sum += ink[k]
      n += 1
    }
    smooth[x] = sum / n
  }

  let max = 0
  for (const value of smooth) max = Math.max(max, value)
  if (max === 0) return rect.x0
  const cut = max * MENU_GAP_INK

  // **메뉴 다음의 첫 빈 띠**에서 자른다. "가장 넓은 띠"로 찾으면 포함된
  // 행이 조금만 달라져도 다른 띠가 뽑혀 결과가 흔들렸다(자른 폭이 555 →
  // 364로 튀어 표를 먹었다). 메뉴는 표 왼쪽의 첫 글자 덩어리이므로, 그
  // 덩어리를 지난 뒤 처음 나오는 빈 띠가 경계다.
  const limit = Math.floor(width * 0.5)
  const minGap = Math.max(4, Math.round(width * MENU_GAP_MIN_WIDTH))
  let x = 0
  while (x <= limit && smooth[x] < cut) x += 1 // 왼쪽 테두리 밖 여백
  while (x <= limit && smooth[x] >= cut) x += 1 // 메뉴 덩어리
  let start = -1
  let best: [number, number] = [0, 0]
  for (; x <= limit; x++) {
    const empty = smooth[x] < cut
    if (empty && start < 0) start = x
    if (!empty && start >= 0) {
      if (x - start >= minGap) {
        best = [start, x]
        break
      }
      start = -1
    }
  }
  if (best[1] === 0 && start >= 0 && limit - start >= minGap) best = [start, limit]

  // 띠가 너무 좁으면 메뉴가 없는 화면이다(창 모드 등). 건드리지 않는다.
  if (best[1] - best[0] < minGap) return rect.x0
  // 띠 가운데서 자른다. 끝에 바짝 붙이면 닉네임 첫 글자가 잘린다.
  return rect.x0 + Math.round((best[0] + best[1]) / 2)
}

/** 이 사각형으로 잘라낼 만한가. */
export function shouldCrop(rect: PanelRect, width: number, height: number): boolean {
  const area = ((rect.x1 - rect.x0) * (rect.y1 - rect.y0)) / (width * height)
  return area > 0 && area < CROP_WHEN_PANEL_BELOW
}

/** 전처리한 그림이 원본의 어디를 몇 배로 키운 것인지.
 *
 * OCR 좌표는 전처리한 그림 기준이다. 칸 그림을 **원본 스크린샷에서** 자르려면
 * (흑백 반전한 그림이 아니라 사람이 보던 색 그대로) 좌표를 되돌려야 한다:
 * `원본 x = x0 + 전처리 x / scale`. */
export interface OcrFrame {
  x0: number
  y0: number
  scale: number
}

/** 이미지를 반전·확대해 OCR이 읽기 좋은 형태로 만든다. */
export async function preprocessForOcr(file: Blob): Promise<Blob> {
  return (await preprocessWithFrame(file)).image
}

/** `preprocessForOcr`와 같고, 원본으로 되돌릴 좌표 정보를 같이 준다. */
export async function preprocessWithFrame(file: Blob): Promise<{ image: Blob; frame: OcrFrame }> {
  const bitmap = await createImageBitmap(file)

  // 전체 화면을 캡처한 경우 게임 UI만 잘라낸다. 창에 맞춰 찍은 스크린샷은
  // `shouldCrop`이 걸러내므로 손대지 않는다.
  let crop = { x0: 0, y0: 0, x1: bitmap.width, y1: bitmap.height }
  const probe = new OffscreenCanvas(bitmap.width, bitmap.height)
  const probeContext = probe.getContext('2d')
  if (probeContext) {
    probeContext.drawImage(bitmap, 0, 0)
    const { data } = probeContext.getImageData(0, 0, bitmap.width, bitmap.height)
    const rect = detectPanel(data, bitmap.width, bitmap.height)
    if (shouldCrop(rect, bitmap.width, bitmap.height)) crop = rect
  }

  const sourceWidth = crop.x1 - crop.x0
  const sourceHeight = crop.y1 - crop.y0
  const width = sourceWidth * SCALE
  const height = sourceHeight * SCALE
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    // 캔버스를 못 쓰면 전처리 없이 원본으로 간다 — 인식률은 떨어지지만 동작은 한다.
    return { image: file, frame: { x0: 0, y0: 0, scale: 1 } }
  }

  // 보간은 켜되 **약하게**. 스크린샷 12장으로 재어 보면 차이가 크다.
  //
  // | 품질 | 자동 처리율 |
  // | --- | --- |
  // | `'low'` | **85.5%** |
  // | `'medium'` | 79.1% |
  // | 보간 끕 | 66.5% |
  //
  // `'high'`는 더 나쁘다 — Chrome의 'high'는 단순 쌍선형이 아니라 더 강한
  // 재샘플링을 하고, 12px짜리 얇은 한글 획이 그 과정에서 뭉개진다. 한 장 기준
  // 닉네임을 읽은 행이 19개 중 15개로 떨어졌다.
  //
  // 그렇다고 보간을 끄면 계단식으로 커져서 획이 각진다 — 양쪽 끝이 다 나쁘고
  // 중간이 좋다.
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'low'
  context.drawImage(bitmap, crop.x0, crop.y0, sourceWidth, sourceHeight, 0, 0, width, height)
  bitmap.close()

  const image = context.getImageData(0, 0, width, height)
  const pixels = image.data
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    const inverted = 255 - luma
    pixels[i] = pixels[i + 1] = pixels[i + 2] = inverted
    pixels[i + 3] = 255
  }
  context.putImageData(image, 0, 0)

  return {
    image: await canvas.convertToBlob({ type: 'image/png' }),
    frame: { x0: crop.x0, y0: crop.y0, scale: SCALE },
  }
}
