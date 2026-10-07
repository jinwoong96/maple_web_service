import { useState } from 'react'

import { FilterSortBar, type SortOption } from '@/components/probability/filter-sort-bar'
import { OptionList } from '@/components/probability/history-rows'
import type { PotentialCubeCard, StarforceCard } from '@/hooks/use-probability-aggregate'
import { formatKoreanNumber } from '@/lib/korean-number'

function CardHeader({ itemIcon, itemName, character }: { itemIcon: string | null; itemName: string; character: string }) {
  return (
    <div className="flex items-center gap-2">
      {itemIcon ? (
        <img src={itemIcon} alt="" className="size-8 shrink-0 rounded bg-muted/60 object-contain" />
      ) : (
        <div className="size-8 shrink-0 rounded bg-muted/60" />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{itemName}</span>
        <span className="truncate text-xs text-muted-foreground">{character}</span>
      </div>
    </div>
  )
}

function formatEntryMap(entries: Map<string, number>): string {
  return Array.from(entries.entries())
    .map(([name, count]) => `${name} ×${count}`)
    .join(', ')
}

const CARD_SORT_OPTIONS: SortOption[] = [
  { value: 'cost', label: '사용금액순' },
  { value: 'item', label: '아이템 이름순' },
  { value: 'character', label: '캐릭터 이름순' },
  { value: 'level', label: '아이템 레벨순' },
]

function matchesFilter(value: string, filter: string): boolean {
  const trimmed = filter.trim()
  return trimmed === '' || value.includes(trimmed)
}

/** `null` levels/costs sort to the bottom regardless of direction. */
function compareByNumberDesc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function StarforceItemCard({ card }: { card: StarforceCard }) {
  const starRangeLabel = card.destroyed
    ? `${card.startStar ?? '?'}성 → 파괴`
    : `${card.startStar ?? '?'}성 → ${card.endStar ?? '?'}성`

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <CardHeader itemIcon={card.itemIcon} itemName={card.itemName} character={card.character} />
      <p className={`text-sm font-medium ${card.destroyed ? 'text-red-600' : ''}`}>{starRangeLabel}</p>
      <p className="text-xs text-muted-foreground">사용 금액: {formatKoreanNumber(card.totalCost)}</p>
      <div className="grid grid-cols-4 gap-2 rounded-md bg-muted/30 p-2 text-center text-xs">
        <div>
          <p className="text-muted-foreground">시도</p>
          <p className="font-medium">{card.attempts}</p>
        </div>
        <div>
          <p className="text-muted-foreground">성공</p>
          <p className="font-medium text-emerald-600">{card.success}</p>
        </div>
        <div>
          <p className="text-muted-foreground">실패</p>
          <p className="font-medium">{card.fail}</p>
        </div>
        <div>
          <p className="text-muted-foreground">파괴</p>
          <p className="font-medium text-red-600">{card.destroy}</p>
        </div>
      </div>
      {card.peakStar != null && (
        <p className="text-xs text-muted-foreground">
          최고 {card.peakStar}성 구간: 시도 {card.peakStarAttempts} · 성공 {card.peakStarSuccess} · 실패{' '}
          {card.peakStarFail} · 파괴 {card.peakStarDestroy}
        </p>
      )}
      {card.scrollUsage.size > 0 && (
        <p className="text-xs text-muted-foreground">주문서 사용: {formatEntryMap(card.scrollUsage)}</p>
      )}
    </div>
  )
}

export function StarforceCardGrid({ cards }: { cards: StarforceCard[] }) {
  const [characterFilter, setCharacterFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [sortValue, setSortValue] = useState('cost')

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 스타포스 이력이 없습니다.</p>
  }

  const filtered = cards.filter(
    (card) => matchesFilter(card.character, characterFilter) && matchesFilter(card.itemName, itemFilter),
  )
  const sorted = [...filtered].sort((a, b) => {
    switch (sortValue) {
      case 'item':
        return a.itemName.localeCompare(b.itemName, 'ko')
      case 'character':
        return a.character.localeCompare(b.character, 'ko')
      case 'level':
        return compareByNumberDesc(a.itemLevel, b.itemLevel)
      default:
        return compareByNumberDesc(a.totalCost, b.totalCost)
    }
  })

  return (
    <div className="flex flex-col gap-3">
      <FilterSortBar
        characterFilter={characterFilter}
        onCharacterFilterChange={setCharacterFilter}
        itemFilter={itemFilter}
        onItemFilterChange={setItemFilter}
        sortValue={sortValue}
        onSortChange={setSortValue}
        sortOptions={CARD_SORT_OPTIONS}
      />
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">필터 조건에 맞는 카드가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((card) => (
            <StarforceItemCard key={`${card.character}|${card.itemName}`} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

function PotentialCubeItemCard({ card }: { card: PotentialCubeCard }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <CardHeader itemIcon={card.itemIcon} itemName={card.itemName} character={card.character} />
      <p className="text-xs text-muted-foreground">재설정 비용: {formatKoreanNumber(card.resetCost)}</p>
      {card.appraisalCost > 0 && (
        <p className="text-xs text-muted-foreground">감정 비용: {formatKoreanNumber(card.appraisalCost)}</p>
      )}
      {card.cubeUsage.size > 0 && (
        <p className="text-xs text-muted-foreground">큐브 사용: {formatEntryMap(card.cubeUsage)}</p>
      )}
      {card.mainGradeAttempts.size > 0 && (
        <p className="text-xs text-muted-foreground">
          등급별 시도(메인):{' '}
          {Array.from(card.mainGradeAttempts.entries())
            .map(([grade, count]) => `${grade} ${count}회`)
            .join(', ')}
        </p>
      )}
      {card.additionalGradeAttempts.size > 0 && (
        <p className="text-xs text-muted-foreground">
          등급별 시도(에디셔널):{' '}
          {Array.from(card.additionalGradeAttempts.entries())
            .map(([grade, count]) => `${grade} ${count}회`)
            .join(', ')}
        </p>
      )}
      <div className="flex flex-col gap-1 border-t pt-2">
        <p className="text-xs font-medium text-muted-foreground">최종 잠재능력</p>
        <OptionList options={card.finalMainOptions} />
        {card.finalAdditionalOptions.length > 0 && (
          <>
            <p className="mt-1 text-xs font-medium text-muted-foreground">에디셔널</p>
            <OptionList options={card.finalAdditionalOptions} />
          </>
        )}
      </div>
    </div>
  )
}

export function PotentialCubeCardGrid({ cards }: { cards: PotentialCubeCard[] }) {
  const [characterFilter, setCharacterFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [sortValue, setSortValue] = useState('cost')

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 잠재능력/큐브 이력이 없습니다.</p>
  }

  const filtered = cards.filter(
    (card) => matchesFilter(card.character, characterFilter) && matchesFilter(card.itemName, itemFilter),
  )
  const sorted = [...filtered].sort((a, b) => {
    switch (sortValue) {
      case 'item':
        return a.itemName.localeCompare(b.itemName, 'ko')
      case 'character':
        return a.character.localeCompare(b.character, 'ko')
      case 'level':
        return compareByNumberDesc(a.itemLevel, b.itemLevel)
      default:
        return compareByNumberDesc(a.resetCost + a.appraisalCost, b.resetCost + b.appraisalCost)
    }
  })

  return (
    <div className="flex flex-col gap-3">
      <FilterSortBar
        characterFilter={characterFilter}
        onCharacterFilterChange={setCharacterFilter}
        itemFilter={itemFilter}
        onItemFilterChange={setItemFilter}
        sortValue={sortValue}
        onSortChange={setSortValue}
        sortOptions={CARD_SORT_OPTIONS}
      />
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">필터 조건에 맞는 카드가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((card) => (
            <PotentialCubeItemCard key={`${card.character}|${card.itemName}`} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}
