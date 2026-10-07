import { Input } from '@/components/ui/input'

export interface SortOption {
  value: string
  label: string
}

interface FilterSortBarProps {
  characterFilter: string
  onCharacterFilterChange: (value: string) => void
  itemFilter: string
  onItemFilterChange: (value: string) => void
  sortValue: string
  onSortChange: (value: string) => void
  sortOptions: SortOption[]
}

/** Shared filter/sort toolbar for 스타포스/잠재능력/큐브 개별 이력 탭과
 * 모아보기 카드 그리드 — 캐릭터명/아이템명 부분 문자열 필터와, 각 화면이
 * 정의하는 정렬 기준(이름순/사용금액순/레벨순 등) 드롭다운. 필터/정렬은
 * "지금까지 불러온 데이터"에만 적용된다 — 더 보기로 추가 페이지를 불러오는
 * 기존 방식은 그대로 두고, 그 위에 클라이언트 사이드로만 걸러낸다(사용자
 * 요청, 2026-09-22). */
export function FilterSortBar({
  characterFilter,
  onCharacterFilterChange,
  itemFilter,
  onItemFilterChange,
  sortValue,
  onSortChange,
  sortOptions,
}: FilterSortBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">캐릭터명</label>
        <Input
          value={characterFilter}
          onChange={(event) => onCharacterFilterChange(event.target.value)}
          placeholder="캐릭터명 검색"
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">아이템명</label>
        <Input
          value={itemFilter}
          onChange={(event) => onItemFilterChange(event.target.value)}
          placeholder="아이템명 검색"
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">정렬</label>
        <select
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
