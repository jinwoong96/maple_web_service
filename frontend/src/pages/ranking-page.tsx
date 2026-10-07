import { type Dispatch, type FormEvent, type SetStateAction, useState } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

import {
  CharacterRankFilter,
  ClassFilter,
  FilterBar,
  NameFilter,
  NumericFilter,
} from '@/components/ranking/ranking-filters'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type CharacterRankFilterState,
  useCharacterRankFilter,
} from '@/hooks/use-character-rank-filter'
import {
  useRankingAchievement,
  useRankingDojang,
  useRankingGuild,
  useRankingOverall,
  useRankingTheSeed,
  useRankingUnion,
} from '@/hooks/use-ranking'
import type { components } from '@/lib/api-types'
import { formatTimeRecord } from '@/lib/format-time'
import { getYesterdayKstDateString } from '@/lib/kst-date'
import {
  DEFAULT_DOJANG_DIFFICULTY,
  DOJANG_DIFFICULTIES,
  GUILD_RANKING_TYPES,
  WORLD_TYPES,
} from '@/lib/ranking-options'

type OverallRankingEntry = components['schemas']['OverallRankingEntry']
type UnionRankingEntry = components['schemas']['UnionRankingEntry']
type GuildRankingEntry = components['schemas']['GuildRankingEntry']
type DojangRankingEntry = components['schemas']['DojangRankingEntry']
type TheSeedRankingEntry = components['schemas']['TheSeedRankingEntry']
type AchievementRankingEntry = components['schemas']['AchievementRankingEntry']

interface RankingParams {
  date: string
  worldName: string
  page: number
}

const CATEGORIES = [
  { value: 'overall', label: '종합' },
  { value: 'union', label: '유니온' },
  { value: 'guild', label: '길드' },
  { value: 'dojang', label: '무릉도장' },
  { value: 'theseed', label: '더 시드' },
  { value: 'achievement', label: '도전과제' },
] as const

export function RankingPage() {
  const [date, setDate] = useState(getYesterdayKstDateString())
  const [worldNameInput, setWorldNameInput] = useState('')
  const [worldName, setWorldName] = useState('')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('overall')

  const params: RankingParams = { date, worldName, page }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorldName(worldNameInput.trim())
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategory(value as (typeof CATEGORIES)[number]['value'])
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">랭킹</h1>
        <p className="text-sm text-muted-foreground">
          기준 날짜와 월드를 선택해 카테고리별 랭킹을 확인할 수 있어요.
        </p>
      </div>

      <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ranking-date" className="text-xs text-muted-foreground">
            날짜
          </label>
          <Input
            id="ranking-date"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setPage(1)
            }}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ranking-world" className="text-xs text-muted-foreground">
            월드
          </label>
          <Input
            id="ranking-world"
            value={worldNameInput}
            onChange={(event) => setWorldNameInput(event.target.value)}
            placeholder="전체 월드"
            className="w-40"
          />
        </div>
        <Button type="submit">조회</Button>
      </form>

      <Tabs value={category} onValueChange={handleCategoryChange}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c.value} value={c.value}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overall" className="pt-4">
          <OverallRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="union" className="pt-4">
          <UnionRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="guild" className="pt-4">
          <GuildRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="dojang" className="pt-4">
          <DojangRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="theseed" className="pt-4">
          <TheSeedRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
        <TabsContent value="achievement" className="pt-4">
          <AchievementRankingTab params={params} onPageChange={setPage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface RankingTabProps {
  params: RankingParams
  onPageChange: Dispatch<SetStateAction<number>>
}

/** 세부 필터를 건드리면 쪽수를 1로 되돌린다 — 3쪽을 보던 중에 직업을 바꾸면
 * 그 직업의 3쪽이 뜨는데, 고른 사람은 1쪽을 기대한다. */
function resetting<T>(onPageChange: Dispatch<SetStateAction<number>>, apply: (value: T) => void) {
  return (value: T) => {
    apply(value)
    onPageChange(1)
  }
}

function OverallRankingTab({ params, onPageChange }: RankingTabProps) {
  const [worldType, setWorldType] = useState<number | undefined>(undefined)
  const [className, setClassName] = useState('')
  const character = useCharacterRankFilter()
  const query = useRankingOverall({
    ...params,
    // 월드를 고르면 넥슨이 월드 구분을 무시한다. 보내지 않는 편이 정직하다.
    worldType: params.worldName ? undefined : worldType,
    className,
    ocid: character.ocid,
    waiting: character.waiting,
  })
  return (
    <>
      <FilterBar>
        <NumericFilter
          label="월드 구분"
          options={WORLD_TYPES}
          value={worldType}
          onChange={resetting(onPageChange, setWorldType)}
          allLabel="전체"
          disabled={params.worldName.length > 0}
          hint={params.worldName ? '월드를 고르면 월드 구분은 적용되지 않습니다.' : undefined}
        />
        <ClassFilter value={className} onChange={resetting(onPageChange, setClassName)} />
        <CharacterRankFilter
          filter={character}
          onChange={resetting(onPageChange, character.setName)}
        />
      </FilterBar>
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={character.name.length > 0}
        getKey={(entry: OverallRankingEntry) => entry.ranking}
      renderRow={(entry: OverallRankingEntry) => (
        <CharacterRankingRow
          ranking={entry.ranking}
          characterName={entry.character_name}
          worldName={entry.world_name}
          className={entry.class_name}
          subClassName={entry.sub_class_name}
          characterLevel={entry.character_level}
          trailing={entry.character_guildname}
          />
        )}
      />
    </>
  )
}

/** 세부 필터가 닉네임 하나뿐인 카테고리(유니온·더 시드·도전과제). */
function CharacterOnlyFilterBar({
  filter,
  onPageChange,
}: {
  filter: CharacterRankFilterState
  onPageChange: Dispatch<SetStateAction<number>>
}) {
  return (
    <FilterBar>
      <CharacterRankFilter filter={filter} onChange={resetting(onPageChange, filter.setName)} />
    </FilterBar>
  )
}

function UnionRankingTab({ params, onPageChange }: RankingTabProps) {
  const character = useCharacterRankFilter()
  const query = useRankingUnion({ ...params, ocid: character.ocid, waiting: character.waiting })
  return (
    <>
      <CharacterOnlyFilterBar filter={character} onPageChange={onPageChange} />
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={character.name.length > 0}
        getKey={(entry: UnionRankingEntry) => entry.ranking}
      renderRow={(entry: UnionRankingEntry) => (
        <CharacterRankingRow
          ranking={entry.ranking}
          characterName={entry.character_name}
          worldName={entry.world_name}
          className={entry.class_name}
          subClassName={entry.sub_class_name}
          characterLevel={null}
          trailing={
            entry.union_level != null ? `유니온 Lv.${entry.union_level.toLocaleString('ko-KR')}` : null
            }
          />
        )}
      />
    </>
  )
}

function GuildRankingTab({ params, onPageChange }: RankingTabProps) {
  const [rankingType, setRankingType] = useState(GUILD_RANKING_TYPES[0].value)
  const [guildName, setGuildName] = useState('')
  const query = useRankingGuild({ ...params, rankingType, guildName })
  return (
    <>
      <FilterBar>
        {/* 생략하면 넥슨이 400을 내므로 "전체"가 없다 — 항상 하나가 골라져 있다. */}
        <NumericFilter
          label="랭킹 종류"
          options={GUILD_RANKING_TYPES}
          value={rankingType}
          onChange={resetting(onPageChange, (value: number | undefined) =>
            setRankingType(value ?? GUILD_RANKING_TYPES[0].value),
          )}
        />
        <NameFilter
          label="길드 순위 찾기"
          placeholder="길드명"
          value={guildName}
          onSubmit={resetting(onPageChange, setGuildName)}
        />
      </FilterBar>
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={guildName.length > 0}
        emptyMessage={guildName ? guildName + ' 길드의 기록이 없습니다.' : undefined}
        getKey={(entry: GuildRankingEntry) => entry.ranking}
        renderRow={(entry: GuildRankingEntry) => <GuildRankingRow entry={entry} />}
      />
    </>
  )
}

function DojangRankingTab({ params, onPageChange }: RankingTabProps) {
  const [difficulty, setDifficulty] = useState(DEFAULT_DOJANG_DIFFICULTY)
  const [className, setClassName] = useState('')
  const character = useCharacterRankFilter()
  const query = useRankingDojang({
    ...params,
    difficulty,
    className,
    ocid: character.ocid,
    waiting: character.waiting,
  })
  return (
    <>
      <FilterBar>
        <NumericFilter
          label="구간"
          options={DOJANG_DIFFICULTIES}
          value={difficulty}
          onChange={resetting(onPageChange, (value: number | undefined) =>
            setDifficulty(value ?? DEFAULT_DOJANG_DIFFICULTY),
          )}
        />
        <ClassFilter value={className} onChange={resetting(onPageChange, setClassName)} />
        <CharacterRankFilter
          filter={character}
          onChange={resetting(onPageChange, character.setName)}
        />
      </FilterBar>
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={character.name.length > 0}
        getKey={(entry: DojangRankingEntry) => entry.ranking}
      renderRow={(entry: DojangRankingEntry) => (
        <CharacterRankingRow
          ranking={entry.ranking}
          characterName={entry.character_name}
          worldName={entry.world_name}
          className={entry.class_name}
          subClassName={entry.sub_class_name}
          characterLevel={entry.character_level}
          trailing={
            entry.dojang_floor != null
              ? `${entry.dojang_floor}층${entry.dojang_time_record != null ? ` · ${formatTimeRecord(entry.dojang_time_record)}` : ''}`
              : null
            }
          />
        )}
      />
    </>
  )
}

function TheSeedRankingTab({ params, onPageChange }: RankingTabProps) {
  const character = useCharacterRankFilter()
  const query = useRankingTheSeed({ ...params, ocid: character.ocid, waiting: character.waiting })
  return (
    <>
      <CharacterOnlyFilterBar filter={character} onPageChange={onPageChange} />
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={character.name.length > 0}
        getKey={(entry: TheSeedRankingEntry) => entry.ranking}
      renderRow={(entry: TheSeedRankingEntry) => (
        <CharacterRankingRow
          ranking={entry.ranking}
          characterName={entry.character_name}
          worldName={entry.world_name}
          className={entry.class_name}
          subClassName={entry.sub_class_name}
          characterLevel={entry.character_level}
          trailing={
            entry.theseed_floor != null
              ? `${entry.theseed_floor}층${entry.theseed_time_record != null ? ` · ${formatTimeRecord(entry.theseed_time_record)}` : ''}`
              : null
            }
          />
        )}
      />
    </>
  )
}

function AchievementRankingTab({ params, onPageChange }: RankingTabProps) {
  const character = useCharacterRankFilter()
  const query = useRankingAchievement({
    ...params,
    ocid: character.ocid,
    waiting: character.waiting,
  })
  return (
    <>
      <CharacterOnlyFilterBar filter={character} onPageChange={onPageChange} />
      <RankingResultList
        query={query}
        page={params.page}
        onPageChange={onPageChange}
        single={character.name.length > 0}
        getKey={(entry: AchievementRankingEntry) => entry.ranking}
      renderRow={(entry: AchievementRankingEntry) => (
        <CharacterRankingRow
          ranking={entry.ranking}
          characterName={entry.character_name}
          worldName={entry.world_name}
          className={entry.class_name}
          subClassName={entry.sub_class_name}
          characterLevel={null}
          trailing={
            entry.trophy_grade
              ? `${entry.trophy_grade}${entry.trophy_score != null ? ` · ${entry.trophy_score.toLocaleString('ko-KR')}점` : ''}`
                : null
            }
          />
        )}
      />
    </>
  )
}

interface RankingResultListProps<T> {
  query: UseQueryResult<T[]>
  page: number
  onPageChange: Dispatch<SetStateAction<number>>
  renderRow: (entry: T, index: number) => React.ReactNode
  getKey: (entry: T, index: number) => React.Key
  /** 한 줄만 찾는 중(닉네임·길드명 필터). 쪽 넘기기를 숨기고, 빈 결과를
   * "순위가 없다"가 아니라 "그 기록이 없다"로 말한다 — 이름을 넣어 찾았는데
   * "표시할 순위가 없습니다"가 뜨면 서비스가 고장 난 것처럼 읽힌다. */
  single?: boolean
  emptyMessage?: string
}

/** Loading/error/empty/pagination shell shared by all 6 categories — only
 * the row shape differs between them. */
function RankingResultList<T>({
  query,
  page,
  onPageChange,
  renderRow,
  getKey,
  single,
  emptyMessage,
}: RankingResultListProps<T>) {
  const entries = query.data ?? []

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>랭킹 정보를 불러오지 못했습니다. 날짜를 다시 확인해주세요.</AlertDescription>
      </Alert>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ??
          (single
            ? '이 조건에는 해당 기록이 없습니다. 날짜·월드·구간을 바꿔보세요.'
            : '표시할 순위가 없습니다.')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <div key={getKey(entry, index)}>{renderRow(entry, index)}</div>
        ))}
      </div>

      {!single && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange((current) => current - 1)}
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">{page} 페이지</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((current) => current + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
}

function CharacterRankingRow({
  ranking,
  characterName,
  worldName,
  className,
  subClassName,
  characterLevel,
  trailing,
}: {
  ranking: number
  characterName: string
  worldName: string
  className: string
  subClassName?: string | null
  characterLevel: number | null
  trailing?: string | null
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <span className="w-10 shrink-0 text-center text-sm font-semibold text-muted-foreground">
        {ranking}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{characterName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {worldName} · {className}
          {subClassName ? ` (${subClassName})` : ''}
          {characterLevel != null ? ` · Lv.${characterLevel}` : ''}
        </p>
      </div>
      {trailing && (
        <span className="shrink-0 truncate text-xs text-muted-foreground">{trailing}</span>
      )}
    </div>
  )
}

function GuildRankingRow({ entry }: { entry: GuildRankingEntry }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <span className="w-10 shrink-0 text-center text-sm font-semibold text-muted-foreground">
        {entry.ranking}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.guild_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.world_name} · Lv.{entry.guild_level}
          {entry.guild_master_name ? ` · 길드마스터 ${entry.guild_master_name}` : ''}
        </p>
      </div>
      {entry.guild_point != null && (
        <span className="shrink-0 truncate text-xs text-muted-foreground">
          {entry.guild_point.toLocaleString('ko-KR')}P
        </span>
      )}
    </div>
  )
}
