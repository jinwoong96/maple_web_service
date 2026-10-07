import { ChevronsDown, ChevronsUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type BossSelection, type PlannerCharacter, weeklyIndexOf } from '@/hooks/use-boss-revenue'
import {
  BOSSES,
  type BossDefinition,
  type BossDifficulty,
  type BossDifficultyEntry,
  getBossPrice,
  getMaxParty,
  getRevenuePerPerson,
  WEEKLY_BOSS_LIMIT,
  WEEKLY_BOSSES,
} from '@/lib/boss-revenue-reference'
import { formatKoreanNumber } from '@/lib/korean-number'

/** 난이도별 색. 아이템 등급 색(레어/에픽/유니크/레전드리)과 겹치지 않게
 * 골랐다 — `docs/frontend-design.md`에서 등급 색은 등급 표시 전용이다. */
const DIFFICULTY_CLASS: Record<BossDifficulty, string> = {
  이지: 'bg-sky-600 border-sky-600',
  노멀: 'bg-teal-700 border-teal-700',
  하드: 'bg-rose-700 border-rose-700',
  카오스: 'bg-violet-700 border-violet-700',
  익스트림: 'bg-rose-900 border-rose-900',
}

interface BossRowProps {
  boss: BossDefinition
  selection: BossSelection | undefined
  weeklyLimitReached: boolean
  todayKst: string
  /** 주간 보스일 때만 숨기기 화살표를 단다. `hiding*`이면 지금 이 보스가
   * 그쪽 경계라서, 같은 버튼이 "다시 보이기" 토글이 된다. */
  hideControls: {
    canHideAbove: boolean
    canHideBelow: boolean
    hidingAbove: boolean
    hidingBelow: boolean
  } | null
  onToggle: (bossId: string, difficulty: BossDifficulty) => void
  onPartySizeChange: (bossId: string, partySize: number) => void
  onHideAbove: (bossId: string) => void
  onHideBelow: (bossId: string) => void
}

function BossRow({
  boss,
  selection,
  weeklyLimitReached,
  todayKst,
  hideControls,
  onToggle,
  onPartySizeChange,
  onHideAbove,
  onHideBelow,
}: BossRowProps) {
  const selectedEntry: BossDifficultyEntry | undefined = selection
    ? boss.difficulties.find((entry) => entry.difficulty === selection.difficulty)
    : undefined
  const maxParty = selectedEntry ? getMaxParty(boss, selectedEntry) : boss.maxParty
  const revenue = selectedEntry
    ? getRevenuePerPerson(getBossPrice(selectedEntry, todayKst), selection?.partySize ?? 1)
    : null
  // 12개를 채우면 아직 안 고른 보스만 잠근다 — 이미 고른 보스는 난이도를
  // 바꾸거나 해제할 수 있어야 하므로.
  const locked = weeklyLimitReached && !selection && boss.category === 'weekly'

  return (
    <div
      className={`grid grid-cols-1 gap-2 border-b px-3 py-2.5 last:border-0 md:grid-cols-[minmax(0,9rem)_1fr_auto_7rem_auto] md:items-center md:gap-3 md:py-2 ${
        boss.category === 'monthly' ? 'bg-amber-50' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`truncate text-sm ${selection ? 'font-medium' : 'text-muted-foreground'}`}>
          {boss.name}
        </span>
        {boss.category === 'monthly' && (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            월간
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {boss.difficulties.map((entry) => {
          const isSelected = selection?.difficulty === entry.difficulty
          return (
            <button
              key={entry.difficulty}
              type="button"
              aria-pressed={isSelected}
              disabled={locked}
              onClick={() => onToggle(boss.id, entry.difficulty)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                isSelected
                  ? `text-white ${DIFFICULTY_CLASS[entry.difficulty]}`
                  : 'border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-background'
              }`}
            >
              {entry.difficulty}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`party-${boss.id}`}>
          {boss.name} 파티원 수
        </label>
        <select
          id={`party-${boss.id}`}
          value={selection?.partySize ?? 1}
          disabled={!selection}
          onChange={(event) => onPartySizeChange(boss.id, Number(event.target.value))}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {Array.from({ length: maxParty }, (_, index) => index + 1).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className={`text-xs ${maxParty < 6 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
          최대 {maxParty}
        </span>
      </div>

      <div className="text-sm font-semibold md:text-right">
        {revenue != null ? formatKoreanNumber(revenue) : <span className="text-muted-foreground">—</span>}
      </div>

      <div className="flex items-center gap-0.5">
        {hideControls && (
          <>
            <button
              type="button"
              disabled={!hideControls.canHideAbove}
              aria-pressed={hideControls.hidingAbove}
              onClick={() => onHideAbove(boss.id)}
              aria-label={
                hideControls.hidingAbove ? `${boss.name} 위쪽 보스 다시 보기` : `${boss.name} 위쪽 보스 숨기기`
              }
              title={hideControls.hidingAbove ? '위쪽 다시 보기' : '이 위로 숨기기'}
              className={`hover:text-foreground disabled:opacity-25 ${
                hideControls.hidingAbove ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <ChevronsUp className="size-4" />
            </button>
            <button
              type="button"
              disabled={!hideControls.canHideBelow}
              aria-pressed={hideControls.hidingBelow}
              onClick={() => onHideBelow(boss.id)}
              aria-label={
                hideControls.hidingBelow ? `${boss.name} 아래쪽 보스 다시 보기` : `${boss.name} 아래쪽 보스 숨기기`
              }
              title={hideControls.hidingBelow ? '아래쪽 다시 보기' : '이 아래로 숨기기'}
              className={`hover:text-foreground disabled:opacity-25 ${
                hideControls.hidingBelow ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <ChevronsDown className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface BossTableProps {
  character: PlannerCharacter | undefined
  weeklyCount: number
  todayKst: string
  sectionNumber: string
  visibleFromBossId: string | null
  visibleToBossId: string | null
  onToggle: (bossId: string, difficulty: BossDifficulty) => void
  onPartySizeChange: (bossId: string, partySize: number) => void
  onClear: () => void
  onHideAbove: (bossId: string) => void
  onHideBelow: (bossId: string) => void
  onShowAll: () => void
}

export function BossTable({
  character,
  weeklyCount,
  todayKst,
  sectionNumber,
  visibleFromBossId,
  visibleToBossId,
  onToggle,
  onPartySizeChange,
  onClear,
  onHideAbove,
  onHideBelow,
  onShowAll,
}: BossTableProps) {
  const selectionsByBoss = new Map(
    (character?.selections ?? []).map((selection) => [selection.bossId, selection]),
  )
  const weeklyLimitReached = weeklyCount >= WEEKLY_BOSS_LIMIT

  // 숨기기는 주간 보스에만 걸리고, 월간 보스는 항상 맨 뒤에 그대로 붙는다.
  const fromIndex = weeklyIndexOf(visibleFromBossId, 0)
  const toIndex = weeklyIndexOf(visibleToBossId, WEEKLY_BOSSES.length - 1)
  const visibleWeekly = WEEKLY_BOSSES.slice(fromIndex, toIndex + 1)
  const hiddenCount = WEEKLY_BOSSES.length - visibleWeekly.length
  const monthlyBosses = BOSSES.filter((boss) => boss.category === 'monthly')
  const visibleBosses = [...visibleWeekly, ...monthlyBosses]

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-primary">{sectionNumber}</span>
        <h2 className="text-base font-semibold">보스</h2>
        {character && <span className="text-sm text-muted-foreground">{character.name}</span>}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            weeklyLimitReached ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          주간 {weeklyCount} / {WEEKLY_BOSS_LIMIT}
        </span>
        {hiddenCount > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {hiddenCount}개 숨김
          </span>
        )}
        <div className="grow" />
        {hiddenCount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={onShowAll}>
            전체 보기
          </Button>
        )}
        {character && (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            전체 해제
          </Button>
        )}
      </div>

      {!character ? (
        <p className="text-sm text-muted-foreground">캐릭터를 선택하면 보스를 고를 수 있어요.</p>
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="hidden grid-cols-[minmax(0,9rem)_1fr_auto_7rem_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
              <div>보스</div>
              <div>난이도</div>
              <div>파티원</div>
              <div className="text-right">1인당 수익</div>
              <div className="w-[2.25rem]" />
            </div>
            {visibleBosses.map((boss, index) => (
              <BossRow
                key={boss.id}
                boss={boss}
                selection={selectionsByBoss.get(boss.id)}
                weeklyLimitReached={weeklyLimitReached}
                todayKst={todayKst}
                hideControls={
                  boss.category === 'weekly'
                    ? {
                        // 경계가 걸린 보스는 위/아래로 더 가릴 게 없어도 버튼을
                        // 살려둬야 다시 눌러 해제할 수 있다.
                        canHideAbove: index > 0 || visibleFromBossId === boss.id,
                        canHideBelow:
                          index < visibleWeekly.length - 1 || visibleToBossId === boss.id,
                        hidingAbove: visibleFromBossId === boss.id,
                        hidingBelow: visibleToBossId === boss.id,
                      }
                    : null
                }
                onToggle={onToggle}
                onPartySizeChange={onPartySizeChange}
                onHideAbove={onHideAbove}
                onHideBelow={onHideBelow}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            수익은 결정석 가격을 파티원 수로 나눈 값입니다. 주간 보스는 입장 횟수 제한에 맞춰 캐릭터당{' '}
            {WEEKLY_BOSS_LIMIT}개까지 고를 수 있고, 월간 보스인 검은 마법사는 이 개수에 포함되지 않습니다.
            화살표로 숨긴 보스는 모든 캐릭터에서 함께 숨겨지며, 숨겨도 이미 선택한 보스의 수익과 개수는
            그대로 집계됩니다.
          </p>
        </>
      )}
    </section>
  )
}
