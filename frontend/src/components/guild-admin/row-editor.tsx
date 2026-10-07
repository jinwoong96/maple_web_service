/** 결과를 **화면에서 바로 고치는** 입력칸.
 *
 * 예전에는 숫자 한 자리를 고치려고 CSV로 내려받아 고치고 다시 올려야 했다.
 * 읽은 결과를 눈으로 훑는 자리에서 그대로 고칠 수 있어야 한다.
 *
 * **타자를 칠 때마다 반영하지 않는다.** 한 글자마다 명단 대조와 후보 정리가
 * 다시 돌아서(206줄 × 1,024명) 입력이 끌린다. 칸을 벗어나거나 엔터를 칠 때
 * 한 번만 반영한다.
 */

import { useRef } from 'react'

import type { Strip } from '@/lib/ocr-strip'
import { formatCell } from '@/lib/score-sheet'

interface NameFieldProps {
  /** 지금 정해진 이름. 빈 값이면 아직 못 정한 줄이다. */
  value: string
  /** 길드원 이름 목록을 담은 `<datalist>`의 id. */
  listId: string
  /** 친 대로 넘긴다. 빈 문자열은 "직접 고른 값을 물린다"는 뜻. */
  onCommit: (name: string) => void
  /** 명단에 없는 이름인가.
   *
   * **되돌리지 않는다.** 되돌리면 무엇을 치다 말았는지 사라져서, 헷갈리는
   * 글자(`I`와 `l`, `ㅗ`와 `ㅛ`)를 더듬어 찾는 중에 손을 다시 처음부터 놀려야
   * 한다. 친 것은 그대로 두고 빨갛게 표시한 뒤, 닮은 이름을 옆에 내놓는다. */
  invalid?: boolean
  className?: string
  /** 엔터를 쳤다. 있으면 칸을 벗어나는 대신 이걸 부른다 — 값이 그대로여도 부른다(그대로 확정).
   * 수정 영역이 키보드만으로 다음 줄로 넘어가게 쓴다. */
  onEnter?: (name: string) => void
}

export function NameField({
  value,
  listId,
  onCommit,
  invalid = false,
  className = 'w-28',
  onEnter,
}: NameFieldProps) {
  const ref = useRef<HTMLInputElement>(null)
  /** 엔터로 이미 넘겼다. 곧 이어질 blur에서 또 넘기지 않게. */
  const enteredRef = useRef(false)

  const commit = () => {
    const input = ref.current
    if (!input) return
    if (enteredRef.current) {
      enteredRef.current = false
      return
    }
    const next = input.value.trim()
    if (next === value) return
    onCommit(next)
  }

  return (
    <input
      ref={ref}
      // 밖에서 값이 바뀌면(후보 버튼을 눌렀다든지) 칸도 따라가야 한다.
      key={value}
      defaultValue={value}
      list={listId}
      placeholder="이름"
      aria-label="닉네임"
      className={`${className} rounded border bg-transparent px-1 py-0.5 font-medium ${
        invalid ? 'border-destructive text-destructive' : ''
      }`}
      onBlur={commit}
      onInput={() => {
        enteredRef.current = false
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          if (onEnter) {
            event.preventDefault()
            enteredRef.current = true
            onEnter(event.currentTarget.value.trim())
          } else {
            event.currentTarget.blur()
          }
        }
        if (event.key === 'Escape') {
          event.currentTarget.value = value
          event.currentTarget.blur()
        }
      }}
    />
  )
}

interface CellFieldProps {
  /** 지금 저장될 값(글자). */
  value: string
  /** 비우면 `null` — 고친 값을 물리고 읽은 값으로 돌아간다. */
  onCommit: (value: string | null) => void
  /** 사람이 고친 값인가. 고쳤으면 눈에 띄게 한다. */
  edited: boolean
  /** 숫자 칸이면 쉼표를 넣어 보여주고 숫자만 받는다. */
  numeric: boolean
  /** 짚을 칸인가(점수 순서가 깨진 칸 등). */
  warn?: boolean
  label: string
  className?: string
  /** 엔터를 쳤다. 있으면 값을 반영한 뒤 칸을 벗어나는 대신 이걸 부른다(`changed`: 값이 바뀌었나).
   * 전체 목록이 점수 의심 칸·아래 칸으로 이어 가게 쓴다. */
  onEnter?: (changed: boolean) => void
}

/** 칸 하나를 고치는 입력칸. 숫자 칸·글자 칸 모두 쓴다. */
export function CellField({
  value,
  onCommit,
  edited,
  numeric,
  warn = false,
  label,
  className = 'w-24',
  onEnter,
}: CellFieldProps) {
  const ref = useRef<HTMLInputElement>(null)
  const shown = formatCell(value, numeric)

  /** 반영한다. 값이 바뀌었으면 `true`. */
  const commit = (): boolean => {
    const input = ref.current
    if (!input) return false
    const next = formatCell(input.value.trim(), numeric)
    if (next === shown) {
      // 쉼표를 지웠다 넣었다 한 경우. 보기 좋은 모양으로 되돌린다.
      input.value = shown
      return false
    }
    onCommit(next === '' ? null : next)
    return true
  }

  return (
    <input
      ref={ref}
      key={shown}
      defaultValue={shown}
      inputMode={numeric ? 'numeric' : undefined}
      aria-label={label}
      className={`${className} rounded border bg-transparent px-1 py-0.5 ${numeric ? 'text-right tabular-nums' : ''} ${
        edited
          ? 'border-sky-500 text-sky-700 dark:text-sky-300'
          : warn
            ? 'border-amber-500'
            : ''
      }`}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          if (onEnter) {
            event.preventDefault()
            onEnter(commit())
          } else {
            event.currentTarget.blur()
          }
        }
        if (event.key === 'Escape') {
          event.currentTarget.value = shown
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/** 칸 그림. `zoom`은 원본 대비 배율 — 원본 스크린샷 조각은 1보다 조금 크게,
 * 전처리(2배로 키운) 조각은 절반으로 본다. */
export function StripImage({ strip, zoom, className = '' }: { strip: Strip; zoom: number; className?: string }) {
  return (
    <img
      src={strip.url}
      alt=""
      width={Math.round(strip.width * zoom)}
      height={Math.round(strip.height * zoom)}
      className={`shrink-0 rounded border bg-black/80 object-contain ${className}`}
    />
  )
}
