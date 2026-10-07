/** 카테고리마다 다른 세부 필터.
 *
 * 날짜와 월드는 여섯 카테고리가 같이 쓰므로 페이지 위쪽에 있고, 여기 있는
 * 것들은 한 카테고리에만 있는 필터다 — 종합에만 있는 월드 구분, 길드에만
 * 있는 랭킹 종류처럼. 그래서 탭 안쪽, 목록 바로 위에 둔다.
 */

import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CharacterRankFilterState } from '@/hooks/use-character-rank-filter'
import { RANKING_CLASS_GROUPS } from '@/lib/ranking-classes'
import type { NumericRankingOption } from '@/lib/ranking-options'

/** 필터들을 한 줄에 눕히는 자리. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 pb-4">{children}</div>
}

const SELECT_CLASS =
  'h-9 rounded-md border bg-transparent px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/** 숫자로 오는 파라미터(월드 구분, 랭킹 종류, 무릉도장 구간)를 고르는 자리. */
export function NumericFilter({
  label,
  options,
  value,
  onChange,
  allLabel,
  disabled,
  hint,
}: {
  label: string
  options: readonly NumericRankingOption[]
  value: number | undefined
  onChange: (value: number | undefined) => void
  /** 안 고른 상태를 허용할 때의 이름. 없으면 반드시 하나를 골라야 한다 —
   * 길드·무릉도장은 생략하면 넥슨이 400을 낸다. */
  allLabel?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <Field label={label}>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className={SELECT_CLASS}
        title={hint}
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** 직업 필터. 넥슨의 대분류를 `<optgroup>`으로 그대로 쓴다. */
export function ClassFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label="직업">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${SELECT_CLASS} max-w-44`}
      >
        <option value="">전체 직업</option>
        {RANKING_CLASS_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  )
}

/** 이름으로 한 줄만 찾는 필터(길드명). 넥슨이 이름을 그대로 받는 쪽이다. */
export function NameFilter({
  label,
  placeholder,
  value,
  onSubmit,
}: {
  label: string
  placeholder: string
  value: string
  onSubmit: (value: string) => void
}) {
  const [input, setInput] = useState(value)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(input.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Field label={label}>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          className="w-40"
        />
      </Field>
      <Button type="submit" variant="outline">
        찾기
      </Button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setInput('')
            onSubmit('')
          }}
        >
          지우기
        </Button>
      )}
    </form>
  )
}

export function CharacterRankFilter({
  filter,
  onChange,
}: {
  filter: CharacterRankFilterState
  onChange: (name: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <NameFilter
        label="캐릭터 순위 찾기"
        placeholder="닉네임"
        value={filter.name}
        onSubmit={onChange}
      />
      {filter.notFound && (
        <p className="text-xs text-destructive">{filter.name} 캐릭터를 찾을 수 없습니다.</p>
      )}
    </div>
  )
}
