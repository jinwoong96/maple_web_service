import { useMemo, useState } from 'react'

import { EquipmentDiffPanel } from '@/components/guild-admin/equipment-diff-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGrowthTracking, type PersonView } from '@/hooks/use-growth-tracking'
import type { GuildIdentity } from '@/hooks/use-guild-groups'
import {
  EXP_TABLE_PATCH_DATE,
  isAffectedByExpPatch,
  PATCH_AFFECTED_LEVEL_RANGE,
  spansExpTablePatch,
  type CharacterGrowth,
} from '@/lib/character-growth'
import {
  DATE_RANGE_PRESETS,
  EARLIEST_QUERYABLE_DATE,
  isQueryableDate,
  resolvePreset,
} from '@/lib/guild-admin-date-range'
import { formatKoreanBigInt } from '@/lib/korean-number'
import { getYesterdayKstDateString } from '@/lib/kst-date'

interface GrowthTabProps {
  guild: GuildIdentity
  apiKey: string
}

/** 레벨 환산 표시.
 *
 * "변화 없음"은 **경험치가 0일 때만** 쓴다. 고레벨은 1레벨 요구치가 수백조라
 * 9254억을 벌어도 소수 레벨로는 0.00이 되는데, 거기에 "변화 없음"을 붙이면
 * 옆에 적힌 경험치와 말이 어긋난다(실측 화면에서 실제로 그렇게 보였다). */
function formatLevelGain(growth: CharacterGrowth): string {
  if (growth.expGained === 0n) return '성장 없음'
  return `+${growth.levelGained.toFixed(2)}레벨치`
}

interface CharacterRowProps {
  growth: CharacterGrowth
  apiKey: string
  oldDate: string
  newDate: string
}

function CharacterRow({ growth, apiKey, oldDate, newDate }: CharacterRowProps) {
  const grew = growth.expGained > 0n
  return (
    <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{growth.characterName}</span>
      <span className="text-xs text-muted-foreground">
        Lv.{growth.before.level} → Lv.{growth.after.level}
      </span>
      <span className={grew ? 'text-xs' : 'text-xs text-muted-foreground'}>
        {formatLevelGain(growth)}
      </span>
      {grew && (
        <span className="text-xs text-muted-foreground">
          ({formatKoreanBigInt(growth.expGained)} 경험치)
        </span>
      )}
      {growth.reachedMaxLevel && (
        <span className="rounded bg-muted px-2 py-0.5 text-xs">기간 중 만렙 달성</span>
      )}
      {isAffectedByExpPatch(growth) && (
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          패치 영향 구간
        </span>
      )}
    </div>
      {/* 장비는 고른 캐릭터만 2회로 조회한다 — 그룹 전체를 미리 받아두면
          대부분 볼 일 없는 부캐까지 12회씩 쏘게 된다. */}
      <EquipmentDiffPanel
        characterName={growth.characterName}
        apiKey={apiKey}
        oldDate={oldDate}
        newDate={newDate}
      />
    </div>
  )
}

interface PersonCardProps {
  person: PersonView
  rank: number
  apiKey: string
  oldDate: string
  newDate: string
}

/** 사람 카드. 머리에 **그룹 캐릭터 전부의 경험치 합계**를 보여주고 순위도 그걸로 세운다.
 * 기본은 접혀 있고 눌러서 캐릭터별 성장을 편다. 캐릭터가 여럿이면 가장 많이 큰 캐릭터를
 * 같이 적어 둔다 — 부캐로 키우는 사람이 많아서 누가 컸는지 접은 채로도 보이게. */
function PersonCard({ person, rank, apiKey, oldDate, newDate }: PersonCardProps) {
  const [expanded, setExpanded] = useState(false)
  const single = person.characters.length === 1
  const top = person.characters.reduce<CharacterGrowth | null>(
    (best, c) => (best === null || c.expGained > best.expGained ? c : best),
    null,
  )
  return (
    <li className="rounded-lg border p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="w-10 shrink-0 text-xs text-muted-foreground">{rank}</span>
        <span className="text-sm font-medium">{person.representativeName}</span>
        {person.ungrouped && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            title="그룹화한 뒤 새로 들어온 캐릭터라 누구 것인지 모릅니다. 그룹 탭에서 갱신하면 그 사람으로 묶입니다."
          >
            그룹 미반영
          </span>
        )}
        <span className="text-sm">
          {person.totalExpGained === 0n ? '성장 없음' : `${formatKoreanBigInt(person.totalExpGained)} 경험치`}
        </span>
        {!single && (
          <span className="text-xs text-muted-foreground">
            캐릭터 {person.characters.length}개 합계
            {top && top.expGained > 0n && top.characterName !== person.representativeName &&
              ` · 주로 ${top.characterName}`}
          </span>
        )}
        <span className="grow" />
        <span className="text-xs text-muted-foreground">{expanded ? '접기' : '펼치기'}</span>
      </button>
      {expanded && (
        <div className="mt-2 flex flex-col gap-1 border-t pt-2">
          {person.characters.map((growth) => (
            <CharacterRow
              key={growth.characterName}
              growth={growth}
              apiKey={apiKey}
              oldDate={oldDate}
              newDate={newDate}
            />
          ))}
        </div>
      )}
    </li>
  )
}

export function GrowthTab({ guild, apiKey }: GrowthTabProps) {
  const { status, progress, summary, error, run } = useGrowthTracking(apiKey)
  const [range, setRange] = useState(() => resolvePreset(7))
  const [activePreset, setActivePreset] = useState<string | null>('7d')
  const [nameFilter, setNameFilter] = useState('')
  /** 기본은 성장이 적은 순(안 크는 사람 찾기). 많은 순으로 뒤집어 볼 수 있다. */
  const [mostFirst, setMostFirst] = useState(false)

  const rangeValid =
    isQueryableDate(range.oldDate) && isQueryableDate(range.newDate) && range.oldDate < range.newDate

  const filtered = useMemo(() => {
    if (!summary) return []
    const needle = nameFilter.trim().toLowerCase()
    const matched = needle
      ? summary.people.filter((person) =>
          person.characters.some((c) => c.characterName.toLowerCase().includes(needle)),
        )
      : summary.people
    if (!mostFirst) return matched
    // 뒤집기만 하면 성장이 같은 사람끼리 이름도 거꾸로 서니, 이름 순은 그대로 둔다.
    return [...matched].sort((a, b) =>
      a.totalExpGained === b.totalExpGained
        ? a.representativeName.localeCompare(b.representativeName)
        : a.totalExpGained > b.totalExpGained
          ? -1
          : 1,
    )
  }, [summary, nameFilter, mostFirst])

  function applyPreset(value: string, days: number) {
    setActivePreset(value)
    setRange(resolvePreset(days))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              size="sm"
              variant={activePreset === preset.value ? 'default' : 'outline'}
              onClick={() => applyPreset(preset.value, preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">시작일</label>
            <Input
              type="date"
              value={range.oldDate}
              min={EARLIEST_QUERYABLE_DATE}
              max={getYesterdayKstDateString()}
              onChange={(event) => {
                setActivePreset(null)
                setRange((prev) => ({ ...prev, oldDate: event.target.value }))
              }}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">종료일</label>
            <Input
              type="date"
              value={range.newDate}
              min={EARLIEST_QUERYABLE_DATE}
              max={getYesterdayKstDateString()}
              onChange={(event) => {
                setActivePreset(null)
                setRange((prev) => ({ ...prev, newDate: event.target.value }))
              }}
              className="w-40"
            />
          </div>
          <Button
            type="button"
            onClick={() => void run(guild, range.oldDate, range.newDate)}
            disabled={!apiKey || !rangeValid || status === 'running'}
          >
            {status === 'running' ? '조회 중…' : '성장 조회'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          길드원 {guild.memberCount.toLocaleString()}캐릭을 두 시점으로 조회합니다 — 호출이 약{' '}
          {(guild.memberCount * 2).toLocaleString()}회라 1~2분 걸릴 수 있습니다.
        </p>
      </div>

      {!apiKey && (
        <Alert>
          <AlertDescription>성장을 조회하려면 위에 Nexon API 키를 입력해주세요.</AlertDescription>
        </Alert>
      )}

      {spansExpTablePatch(range.oldDate, range.newDate) && (
        <Alert>
          <AlertDescription>
            이 기간에 경험치 요구량 변경 패치({EXP_TABLE_PATCH_DATE})가 있어,{' '}
            {PATCH_AFFECTED_LEVEL_RANGE.min}~{PATCH_AFFECTED_LEVEL_RANGE.max} 구간에 걸쳐 있던
            캐릭터의 경험치 수치가 부정확할 수 있습니다. 해당 캐릭터에는 "패치 영향 구간" 표식을
            답니다. 레벨 표시와 260 이상 캐릭터는 정확합니다.
          </AlertDescription>
        </Alert>
      )}

      {status === 'running' && progress && (
        <Alert>
          <AlertDescription>
            {progress.resolved.toLocaleString()} / {progress.total.toLocaleString()}캐릭 조회 중 ·
            캐릭터 조회 {progress.basicCalls.toLocaleString()}회
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertDescription>성장 조회에 실패했습니다: {error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">
              {summary.oldDate} → {summary.newDate}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.people.length.toLocaleString()}명 추적 · 만렙 {summary.maxLevelPeople.length}명
              {summary.incomplete.length > 0 && ` · 조회 불가 ${summary.incomplete.length}캐릭`} · API{' '}
              {summary.apiCalls.toLocaleString()}회
            </p>
            {summary.ungroupedNew.length > 0 && (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                그룹화한 뒤 새로 들어온 캐릭터 {summary.ungroupedNew.length}개는 누구 것인지 몰라 따로
                조회했습니다(목록에 "그룹 미반영"). 부캐라면 성장 0으로 보일 수 있습니다 — 그룹 탭에서 "새
                캐릭터만 갱신"을 누른 뒤 다시 조회하세요.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              모든 캐릭터를 조회해 사람(그룹)마다 경험치를 합쳐 순위를 세웠습니다 — 부캐로만 키워도 그 사람의
              성장으로 잡힙니다.
            </p>
          </div>

          {summary.tableCheck.stale && summary.tableCheck.median !== null && (
            <Alert variant="destructive">
              <AlertDescription>
                경험치 테이블이 실제 값과 어긋납니다 (표본 {summary.tableCheck.sampled}명의 오차
                중앙값 {(summary.tableCheck.median * 100).toFixed(1)}%). 요구 경험치가 바뀌는
                패치가 있었을 수 있습니다 — `node scripts/generate-exp-table.mjs`로 테이블을 다시
                받아주세요. 레벨 표시는 영향받지 않습니다.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">캐릭터명</label>
              <Input
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="캐릭터명 검색"
                className="w-44"
              />
            </div>
            <div className="flex rounded-md border p-0.5" role="group" aria-label="정렬">
              {[
                { value: false, label: '성장 적은 순' },
                { value: true, label: '성장 많은 순' },
              ].map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="sm"
                  variant={mostFirst === option.value ? 'default' : 'ghost'}
                  aria-pressed={mostFirst === option.value}
                  onClick={() => setMostFirst(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="pb-2 text-xs text-muted-foreground">{filtered.length.toLocaleString()}명</p>
          </div>

          <ul className="flex flex-col gap-2">
            {filtered.map((person, index) => (
              <PersonCard
                key={person.id}
                person={person}
                rank={index + 1}
                apiKey={apiKey}
                oldDate={summary.oldDate}
                newDate={summary.newDate}
              />
            ))}
          </ul>

          {summary.maxLevelPeople.length > 0 && (
            <section className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">
                만렙 {summary.maxLevelPeople.length}명 (성장 추적 불가)
              </p>
              <p className="text-xs text-muted-foreground">
                캐릭터가 전부 {300}레벨이라 경험치가 0으로 고정되어 성장을 <strong>잴 수 없습니다</strong>.
                성장이 0인 것과는 다르기 때문에 본 목록에서 빼둡니다.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {summary.maxLevelPeople.map((person) => (
                  <span key={person.id} className="rounded bg-muted px-2 py-1 text-sm">
                    {person.representativeName}
                  </span>
                ))}
              </div>
            </section>
          )}

          {summary.incomplete.length > 0 && (
            <section className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">조회 불가 {summary.incomplete.length}캐릭</p>
              <p className="text-xs text-muted-foreground">
                시작일 시점에 아직 없었거나(그 사이 길드에 들어온 캐릭터), 조회가 실패한
                캐릭터입니다.
              </p>
              <div className="flex flex-wrap gap-1">
                {summary.incomplete.slice(0, 60).map((name) => (
                  <span key={name} className="rounded bg-muted px-2 py-0.5 text-sm">
                    {name}
                  </span>
                ))}
                {summary.incomplete.length > 60 && (
                  <span className="px-2 py-0.5 text-sm text-muted-foreground">
                    외 {summary.incomplete.length - 60}캐릭
                  </span>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
