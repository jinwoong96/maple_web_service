import { type FormEvent, useEffect, useState } from 'react'
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'

import { AggregateTab } from '@/components/probability/aggregate-tab'
import { FilterSortBar, type SortOption } from '@/components/probability/filter-sort-bar'
import { PotentialCubeHistoryRow, StarforceHistoryRow } from '@/components/probability/history-rows'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiKeyRemember } from '@/components/api-key-remember'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useItemLevels } from '@/hooks/use-item-levels'
import { useProbabilityAggregate } from '@/hooks/use-probability-aggregate'
import { useProbabilityApiKey } from '@/hooks/use-probability-api-key'
import { useCubeHistory, usePotentialHistory, useStarforceHistory } from '@/hooks/use-probability'
import { getTodayKstDateString, getTwoYearsAgoKstDateString } from '@/lib/kst-date'
import { NexonDirectApiError } from '@/lib/nexon-direct-client'
import type { DateFetchFailure } from '@/lib/nexon-history-range'
import type { CubeHistory, PotentialHistory, StarforceHistory } from '@/lib/nexon-probability-types'
import {
  estimateCubeAppraisalCost,
  estimatePotentialEntryCost,
  getStarforceEntryCost,
} from '@/lib/probability-cost-reference'

const CATEGORIES = [
  { value: 'starforce', label: '스타포스' },
  { value: 'potential', label: '잠재능력' },
  { value: 'cube', label: '큐브' },
  { value: 'aggregate', label: '모아보기' },
] as const

interface DateRangeArgs {
  apiKey: string
  startDate: string
  endDate: string
}

interface ApiKeyFormProps {
  apiKey: string
  onSubmit: (value: string) => void
  onClear: () => void
  remembered: boolean
  onRemember: () => void
  onForget: () => void
}

/** 넥슨 API 키는 기본적으로 이 브라우저 세션에만 남고 넥슨 API로만
 * 전송된다 — 이 서비스 서버로는 전송되지 않는다. 사용자가 직접 고르면 이
 * 컴퓨터에 저장할 수도 있다(`ApiKeyRemember`). `enabled: Boolean(apiKey)`
 * 인 하위 쿼리들이 매 키 입력마다 요청을 쏘지 않도록, 입력은 폼 제출(적용
 * 버튼)로만 반영한다 — `ranking-page.tsx`의 월드 이름 입력과 동일한 패턴. */
function ApiKeyForm({
  apiKey,
  onSubmit,
  onClear,
  remembered,
  onRemember,
  onForget,
}: ApiKeyFormProps) {
  const [draft, setDraft] = useState(apiKey)
  const [visible, setVisible] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(draft.trim())
  }

  function handleClear() {
    setDraft('')
    onClear()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-medium">내 Nexon API 키</p>
      <p className="text-xs text-muted-foreground">
        입력한 키는 이 브라우저에서 넥슨 API로 직접 전송될 뿐, 이 사이트 서버로는 전송되지
        않습니다.{' '}
        {remembered
          ? '이 컴퓨터에 저장해 두었습니다 — 아래에서 언제든 지울 수 있습니다.'
          : '기본적으로 탭을 닫으면 자동으로 삭제됩니다.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nexon Open API 키를 입력하세요"
          className="max-w-sm"
          autoComplete="off"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => setVisible((value) => !value)}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button type="submit" disabled={draft.trim().length === 0}>
          적용
        </Button>
        {apiKey && (
          <Button type="button" variant="outline" onClick={handleClear}>
            지우기
          </Button>
        )}
      </div>
      <ApiKeyRemember
        apiKey={apiKey}
        remembered={remembered}
        onRemember={onRemember}
        onForget={onForget}
      />
    </form>
  )
}

interface HistoryListProps<TPage, TEntry> {
  query: UseInfiniteQueryResult<InfiniteData<TPage>, Error>
  getEntries: (page: TPage) => TEntry[]
  getFailures: (page: TPage) => DateFetchFailure[]
  getKey: (entry: TEntry) => string
  renderRow: (entry: TEntry) => React.ReactNode
  emptyMessage: string
  errorFallback: string
  /** Applied client-side to whatever's been loaded so far — doesn't fetch
   * extra pages to "fill out" a filtered result, same as the existing
   * "더 보기" button leaves pagination manual (2026-09-22, per the user). */
  filterPredicate?: (entry: TEntry) => boolean
  sortCompare?: (a: TEntry, b: TEntry) => number
}

function HistoryList<TPage, TEntry>({
  query,
  getEntries,
  getFailures,
  getKey,
  renderRow,
  emptyMessage,
  errorFallback,
  filterPredicate,
  sortCompare,
}: HistoryListProps<TPage, TEntry>) {
  const pages = query.data?.pages ?? []
  const failures = pages.flatMap(getFailures)
  const rawEntries = pages.flatMap(getEntries)
  let entries = filterPredicate ? rawEntries.filter(filterPredicate) : rawEntries
  if (sortCompare) entries = [...entries].sort(sortCompare)

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    const message = query.error instanceof NexonDirectApiError ? query.error.message : errorFallback
    return (
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {rawEntries.length > 0 ? '필터 조건에 맞는 이력이 없습니다.' : emptyMessage}
        </p>
        {failures.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {failures.length}개 날짜 조회에 실패했습니다 — 실제로는 이력이 있을 수 있어요. 날짜
              범위를 좁혀서 다시 시도해보세요.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {failures.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {failures.length}개 날짜 조회에 실패해 일부 이력이 누락됐을 수 있어요.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={getKey(entry)}>{renderRow(entry)}</div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? '불러오는 중...' : '더 보기'}
          </Button>
        </div>
      )}
    </div>
  )
}

interface HistoryPageShape<TEntry> {
  entries: TEntry[]
  nextDateIndex: number
  failures: DateFetchFailure[]
}

const NAME_SORT_OPTIONS: SortOption[] = [
  { value: 'default', label: '기본순' },
  { value: 'item', label: '아이템 이름순' },
  { value: 'character', label: '캐릭터 이름순' },
  { value: 'cost', label: '사용금액순' },
  { value: 'level', label: '아이템 레벨순' },
]

function matchesFilter(value: string | null, filter: string): boolean {
  const trimmed = filter.trim()
  return trimmed === '' || (value ?? '').includes(trimmed)
}

function compareByName(a: string | null, b: string | null): number {
  return (a ?? '').localeCompare(b ?? '', 'ko')
}

/** `null` costs/levels (not priceable, or item level not yet looked up)
 * sort to the bottom regardless of direction, rather than colliding with
 * real 0 values. */
function compareByNumberDesc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function StarforceHistoryTab({ apiKey, startDate, endDate }: DateRangeArgs) {
  const query = useStarforceHistory({ apiKey, startDate, endDate })
  const loadedEntries = (query.data?.pages ?? []).flatMap((page) => page.entries)
  const itemNames = loadedEntries
    .map((entry) => entry.target_item)
    .filter((name): name is string => name != null)
  const itemLevelsQuery = useItemLevels(itemNames)
  const itemLevels = itemLevelsQuery.data

  const [characterFilter, setCharacterFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [sortValue, setSortValue] = useState('default')

  type Entry = StarforceHistory['starforce_history'][number]
  const getLevel = (entry: Entry) => (entry.target_item ? (itemLevels?.get(entry.target_item)?.level ?? null) : null)
  const getCost = (entry: Entry) => getStarforceEntryCost(entry, getLevel(entry))

  const sortCompare: ((a: Entry, b: Entry) => number) | undefined =
    sortValue === 'item'
      ? (a, b) => compareByName(a.target_item, b.target_item)
      : sortValue === 'character'
        ? (a, b) => compareByName(a.character_name, b.character_name)
        : sortValue === 'cost'
          ? (a, b) => compareByNumberDesc(getCost(a), getCost(b))
          : sortValue === 'level'
            ? (a, b) => compareByNumberDesc(getLevel(a), getLevel(b))
            : undefined

  return (
    <div className="flex flex-col gap-3">
      <FilterSortBar
        characterFilter={characterFilter}
        onCharacterFilterChange={setCharacterFilter}
        itemFilter={itemFilter}
        onItemFilterChange={setItemFilter}
        sortValue={sortValue}
        onSortChange={setSortValue}
        sortOptions={NAME_SORT_OPTIONS}
      />
      <HistoryList<HistoryPageShape<Entry>, Entry>
        query={query}
        getEntries={(page) => page.entries}
        getFailures={(page) => page.failures}
        getKey={(entry) => entry.id}
        renderRow={(entry) => <StarforceHistoryRow entry={entry} itemLevel={getLevel(entry)} />}
        emptyMessage="표시할 스타포스 이력이 없습니다."
        errorFallback="스타포스 이력을 불러오지 못했습니다. API 키를 확인해주세요."
        filterPredicate={(entry) =>
          matchesFilter(entry.character_name, characterFilter) && matchesFilter(entry.target_item, itemFilter)
        }
        sortCompare={sortCompare}
      />
    </div>
  )
}

function PotentialHistoryTab({ apiKey, startDate, endDate }: DateRangeArgs) {
  const query = usePotentialHistory({ apiKey, startDate, endDate })
  const [characterFilter, setCharacterFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [sortValue, setSortValue] = useState('default')

  type Entry = PotentialHistory['potential_history'][number]
  const getCost = (entry: Entry) => estimatePotentialEntryCost(entry)

  const sortCompare: ((a: Entry, b: Entry) => number) | undefined =
    sortValue === 'item'
      ? (a, b) => compareByName(a.target_item, b.target_item)
      : sortValue === 'character'
        ? (a, b) => compareByName(a.character_name, b.character_name)
        : sortValue === 'cost'
          ? (a, b) => compareByNumberDesc(getCost(a), getCost(b))
          : sortValue === 'level'
            ? (a, b) => compareByNumberDesc(a.item_level, b.item_level)
            : undefined

  return (
    <div className="flex flex-col gap-3">
      <FilterSortBar
        characterFilter={characterFilter}
        onCharacterFilterChange={setCharacterFilter}
        itemFilter={itemFilter}
        onItemFilterChange={setItemFilter}
        sortValue={sortValue}
        onSortChange={setSortValue}
        sortOptions={NAME_SORT_OPTIONS}
      />
      <HistoryList<HistoryPageShape<Entry>, Entry>
        query={query}
        getEntries={(page) => page.entries}
        getFailures={(page) => page.failures}
        getKey={(entry) => entry.id}
        renderRow={(entry) => <PotentialCubeHistoryRow entry={entry} subtitle={entry.potential_type} />}
        emptyMessage="표시할 잠재능력 이력이 없습니다."
        errorFallback="잠재능력 이력을 불러오지 못했습니다. API 키를 확인해주세요."
        filterPredicate={(entry) =>
          matchesFilter(entry.character_name, characterFilter) && matchesFilter(entry.target_item, itemFilter)
        }
        sortCompare={sortCompare}
      />
    </div>
  )
}

function CubeHistoryTab({ apiKey, startDate, endDate }: DateRangeArgs) {
  const query = useCubeHistory({ apiKey, startDate, endDate })
  const [characterFilter, setCharacterFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [sortValue, setSortValue] = useState('default')

  type Entry = CubeHistory['cube_history'][number]
  const getCost = (entry: Entry) => estimateCubeAppraisalCost(entry)

  const sortCompare: ((a: Entry, b: Entry) => number) | undefined =
    sortValue === 'item'
      ? (a, b) => compareByName(a.target_item, b.target_item)
      : sortValue === 'character'
        ? (a, b) => compareByName(a.character_name, b.character_name)
        : sortValue === 'cost'
          ? (a, b) => compareByNumberDesc(getCost(a), getCost(b))
          : sortValue === 'level'
            ? (a, b) => compareByNumberDesc(a.item_level, b.item_level)
            : undefined

  return (
    <div className="flex flex-col gap-3">
      <FilterSortBar
        characterFilter={characterFilter}
        onCharacterFilterChange={setCharacterFilter}
        itemFilter={itemFilter}
        onItemFilterChange={setItemFilter}
        sortValue={sortValue}
        onSortChange={setSortValue}
        sortOptions={NAME_SORT_OPTIONS}
      />
      <HistoryList<HistoryPageShape<Entry>, Entry>
        query={query}
        getEntries={(page) => page.entries}
        getFailures={(page) => page.failures}
        getKey={(entry) => entry.id}
        renderRow={(entry) => (
          <PotentialCubeHistoryRow entry={entry} subtitle={entry.cube_type} appraisalCost={getCost(entry)} />
        )}
        emptyMessage="표시할 큐브 이력이 없습니다."
        errorFallback="큐브 이력을 불러오지 못했습니다. API 키를 확인해주세요."
        filterPredicate={(entry) =>
          matchesFilter(entry.character_name, characterFilter) && matchesFilter(entry.target_item, itemFilter)
        }
        sortCompare={sortCompare}
      />
    </div>
  )
}

export function ProbabilityPage() {
  const { apiKey, setApiKey, clearApiKey, remembered, remember, forget } =
    useProbabilityApiKey()
  const [startDate, setStartDate] = useState(getTodayKstDateString())
  const [endDate, setEndDate] = useState(getTwoYearsAgoKstDateString())
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('starforce')
  // Owned here, not inside AggregateTab — that component unmounts whenever
  // another tab is active (Radix `Tabs.Content`'s default lazy-unmount
  // behavior, used deliberately elsewhere in this domain), which would
  // throw away the aggregate result on every tab switch. This component
  // never unmounts, so the result survives switching tabs and back.
  const aggregate = useProbabilityAggregate()

  // "모아보기 탭 최초 진입시 선택되어있는 날짜 구간의 전체 이력을 불러온다"
  // — fires once per session: `status` flips away from 'idle' the instant
  // `run` starts, so this only ever triggers on the very first visit to the
  // tab, not on every switch back to it.
  useEffect(() => {
    if (category === 'aggregate' && aggregate.status === 'idle' && apiKey) {
      aggregate.run(apiKey, startDate, endDate)
    }
  }, [category, aggregate, apiKey, startDate, endDate])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">확률 정보</h1>
        <p className="text-sm text-muted-foreground">
          본인 소유의 Nexon Open API 키로 스타포스/잠재능력/큐브 사용 이력을 조회합니다.
        </p>
      </div>

      <ApiKeyForm
        apiKey={apiKey}
        onSubmit={setApiKey}
        onClear={clearApiKey}
        remembered={remembered}
        onRemember={remember}
        onForget={forget}
      />

      {!apiKey ? (
        <p className="text-sm text-muted-foreground">API 키를 입력하고 적용하면 이력을 조회할 수 있어요.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="probability-start-date" className="text-xs text-muted-foreground">
                조회 시작일 (최근)
              </label>
              <Input
                id="probability-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="probability-end-date" className="text-xs text-muted-foreground">
                조회 종료일 (과거, 최대 2년 전)
              </label>
              <Input
                id="probability-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-40"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            날짜를 따로 좁히지 않으면 오늘부터 최대 2년 전까지 전부 조회합니다. 넥슨 API가 날짜 하루 단위로만
            조회되기 때문에, 범위가 넓을수록 요청 수가 늘어나 다소 시간이 걸릴 수 있어요.
          </p>

          <Tabs value={category} onValueChange={(value) => setCategory(value as typeof category)}>
            <TabsList>
              {CATEGORIES.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="starforce" className="pt-4">
              <StarforceHistoryTab apiKey={apiKey} startDate={startDate} endDate={endDate} />
            </TabsContent>
            <TabsContent value="potential" className="pt-4">
              <PotentialHistoryTab apiKey={apiKey} startDate={startDate} endDate={endDate} />
            </TabsContent>
            <TabsContent value="cube" className="pt-4">
              <CubeHistoryTab apiKey={apiKey} startDate={startDate} endDate={endDate} />
            </TabsContent>
            <TabsContent value="aggregate" className="pt-4">
              <AggregateTab
                apiKey={apiKey}
                startDate={startDate}
                endDate={endDate}
                status={aggregate.status}
                progress={aggregate.progress}
                result={aggregate.result}
                error={aggregate.error}
                run={aggregate.run}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
