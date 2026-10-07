import { useMemo, useState } from 'react'
import { ArrowLeftRight, CircleHelp, PenLine, UserMinus, UserPlus, Users } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlliancePanel } from '@/components/guild-admin/alliance-panel'
import { GuildChips, GuildTag, PersonList, SectionCard, StatTile } from '@/components/guild-admin/roster-diff-parts'
import { headCount } from '@/components/guild-admin/roster-diff-tone'
import { allianceNeighbours, useAlliances } from '@/hooks/use-alliances'
import { useGuildGroups } from '@/hooks/use-guild-groups'
import { representativeName } from '@/lib/grouping-store'
import { useRosterDiff } from '@/hooks/use-roster-diff'
import type { GuildIdentity } from '@/hooks/use-guild-groups'
import {
  DATE_RANGE_PRESETS,
  EARLIEST_QUERYABLE_DATE,
  isQueryableDate,
  resolvePreset,
} from '@/lib/guild-admin-date-range'
import {
  countPeople,
  isAllianceMove,
  splitByPersonPresence,
  summarizeGuildFlow,
  type JoinedEntry,
  type LeftEntry,
} from '@/lib/guild-roster-diff'
import { getYesterdayKstDateString } from '@/lib/kst-date'

interface RosterDiffTabProps {
  guild: GuildIdentity
  apiKey: string
}

/** 길드 칸에 보여줄 글자.
 *
 * 길드가 없는 상태를 **`무길드`라고 쓰지 않는다** — `무길드`라는 이름의 길드가
 * 실제로 있을 수 있어서, 그렇게 쓰면 "길드가 없다"와 "「무길드」에 있다"가
 * 화면에서 구별되지 않는다. 길드 이름으로 쓰이지 않는 글자를 쓴다.
 *
 * `확인 불가`도 같은 이유로 걸릴 수 있지만, 공백이 들어간 이름은 길드명으로
 * 쓸 수 없어 충돌하지 않는다. 같은 이유로 길드 없음도 `길드 없음`(공백 포함)으로 쓴다 —
 * 예전엔 `X`였는데 칩에서 `X에서`로 보여 읽기 어려웠다(2026-10-04). */
const NO_GUILD = '길드 없음'

function guildLabel(name: string | null | undefined): string {
  if (name === undefined) return '확인 불가'
  if (name === null) return NO_GUILD
  return name
}

/** 탈퇴한 캐릭터가 간 곳. 캐릭터 정보가 아직 우리 길드로 남은 경우(오프접속 미갱신)는 모른다고 쓴다. */
function LeftDetail({ entry }: { entry: LeftEntry }) {
  return (
    <>
      <GuildTag tone="leave">→ {guildLabel(entry.currentGuildName)}</GuildTag>
      {entry.staleCharacterInfo && (
        <span
          className="text-xs text-muted-foreground"
          title="길드 명단에서는 빠졌지만 캐릭터 정보는 아직 이 길드로 남아 있습니다. 오프접속이면 캐릭터 정보가 늦게 갱신됩니다."
        >
          캐릭터 정보 미갱신(오프접속)
        </span>
      )}
    </>
  )
}

export function RosterDiffTab({ guild, apiKey }: RosterDiffTabProps) {
  const { status, progress, summary, error, run } = useRosterDiff(apiKey)
  const [range, setRange] = useState(() => resolvePreset(30))
  const [activePreset, setActivePreset] = useState<string | null>('30d')

  const rangeValid = isQueryableDate(range.oldDate) && isQueryableDate(range.newDate) && range.oldDate < range.newDate


  // 연합은 이 브라우저에 저장한 `{ 연합 이름, 길드명 목록 }`이다. 이 길드가 든
  // 연합들의 다른 길드로 옮긴 사람은 탈퇴가 아니라 연합 내 이동으로 센다.
  const alliances = useAlliances()
  const allianceGuildNames = useMemo(
    () => allianceNeighbours(alliances.alliances, guild.guildName),
    [alliances.alliances, guild.guildName],
  )

  /** 캐릭터 → 그 사람의 대표(⓪ 그룹 탭에서 정한 것). 전체 가입·탈퇴에서 메인으로 보여준다. */
  const { summary: grouping } = useGuildGroups(guild.oguildId, apiKey)
  const mainByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of grouping?.groups ?? []) {
      const name = representativeName(group)
      if (!name) continue
      for (const member of group.members) map.set(member.name, name)
    }
    return map
  }, [grouping])
  const mainOf = (name: string) => mainByName.get(name) ?? null

  const leftByReason = useMemo(() => {
    const buckets = {
      left: [] as LeftEntry[],
      untraceable: [] as LeftEntry[],
      /** 연합 내 다른 길드로 옮겼다. **탈퇴가 아니다.** */
      allianceMove: [] as LeftEntry[],
    }
    for (const entry of summary?.left ?? []) {
      if (entry.reason === 'left' && isAllianceMove(entry.currentGuildName, allianceGuildNames)) {
        buckets.allianceMove.push(entry)
        continue
      }
      buckets[entry.reason].push(entry)
    }
    return buckets
  }, [summary, allianceGuildNames])


  const joinedSplit = useMemo(() => {
    const fresh: JoinedEntry[] = []
    const moved: JoinedEntry[] = []
    for (const entry of summary?.joined ?? []) {
      if (isAllianceMove(entry.previousGuildName, allianceGuildNames)) moved.push(entry)
      else fresh.push(entry)
    }
    return { fresh, moved }
  }, [summary, allianceGuildNames])

  /** 사람 단위 수. 같은 그룹 캐릭터는 합쳐 1명, 그룹에 없는 캐릭터는 각자 1명이다. */
  const groups = summary?.personGroups ?? null
  /** 가입: 새로 온 사람 / 기존 길드원의 캐릭터 추가. 탈퇴: 떠난 사람 / 일부 캐릭터만. */
  const joinKinds = useMemo(
    () =>
      splitByPersonPresence(
        joinedSplit.fresh.map((entry) => entry.characterName),
        groups,
        new Set(summary?.oldMembers ?? []),
      ),
    [joinedSplit.fresh, groups, summary?.oldMembers],
  )
  const leaveKinds = useMemo(
    () =>
      splitByPersonPresence(
        leftByReason.left.map((entry) => entry.characterName),
        groups,
        new Set(summary?.newMembers ?? []),
      ),
    [leftByReason.left, groups, summary?.newMembers],
  )
  const joinedNew = joinedSplit.fresh.filter((entry) => !joinKinds.others.has(entry.characterName))
  const joinedAdded = joinedSplit.fresh.filter((entry) => joinKinds.others.has(entry.characterName))
  const leftWhole = leftByReason.left.filter((entry) => !leaveKinds.others.has(entry.characterName))
  const leftPartial = leftByReason.left.filter((entry) => leaveKinds.others.has(entry.characterName))
  // 길드 간 흐름도 같은 기준으로 가른다. 흐름은 연합 내 이동까지 다 보므로 따로 가른다.
  const flow = useMemo(() => {
    if (!summary) return []
    const joinedAll = splitByPersonPresence(
      summary.joined.map((entry) => entry.characterName),
      summary.personGroups,
      new Set(summary.oldMembers),
    )
    const leftAll = splitByPersonPresence(
      summary.left.filter((entry) => entry.reason === 'left').map((entry) => entry.characterName),
      summary.personGroups,
      new Set(summary.newMembers),
    )
    // 연합 목록이 바뀌면 흐름도 다시 가른다.
    return summarizeGuildFlow(summary, allianceGuildNames, {
      joined: new Set(joinedAll.partial),
      left: new Set(leftAll.partial),
    })
  }, [summary, allianceGuildNames])

  const joinedNewCount = countPeople(joinKinds.whole, groups)
  const joinedAddedCount = countPeople(joinKinds.partial, groups)
  const leftWholeCount = countPeople(leaveKinds.whole, groups)
  const leftPartialCount = countPeople(leaveKinds.partial, groups)
  const movedCount = countPeople(
    [...joinedSplit.moved, ...leftByReason.allianceMove].map((entry) => entry.characterName),
    groups,
  )

  function applyPreset(value: string, days: number) {
    setActivePreset(value)
    setRange(resolvePreset(days))
  }

  return (
    <div className="flex flex-col gap-4">
      <AlliancePanel guildName={guild.guildName} actions={alliances} />
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
            {status === 'running' ? '조회 중…' : '변동 조회'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          넥슨은 {EARLIEST_QUERYABLE_DATE}부터의 기록만 제공하며, 당일 자료는 늦게 올라와
          기준일이 어제입니다.
        </p>
      </div>

      {!apiKey && (
        <Alert>
          <AlertDescription>변동을 조회하려면 위에 Nexon API 키를 입력해주세요.</AlertDescription>
        </Alert>
      )}

      {status === 'running' && progress && (
        <Alert>
          <AlertDescription>
            {progress.resolved.toLocaleString()} / {progress.total.toLocaleString()}캐릭 확인 중 ·
            캐릭터 조회 {progress.basicCalls.toLocaleString()}회
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertDescription>변동 조회에 실패했습니다: {error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-base font-semibold tabular-nums">
                {summary.oldDate} → {summary.newDate}
              </span>
              <span className="text-xs text-muted-foreground">
                {summary.oldMemberCount.toLocaleString()}캐릭 → {summary.newMemberCount.toLocaleString()}캐릭 · API{' '}
                {summary.apiCalls.toLocaleString()}회
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile
                tone="join"
                icon={UserPlus}
                label="전체 가입"
                targetId="roster-joined"
                value={`${joinedNewCount.people}명`}
                sub={`${joinedNewCount.characters}캐릭`}
              />
              <StatTile
                tone="leave"
                icon={UserMinus}
                label="전체 탈퇴"
                targetId="roster-left"
                value={`${leftWholeCount.people}명`}
                sub={`${leftWholeCount.characters}캐릭`}
              />
              <StatTile
                tone="alliance"
                icon={ArrowLeftRight}
                label="연합 내 이동"
                targetId={movedCount.characters > 0 ? 'roster-alliance' : undefined}
                value={`${movedCount.people}명`}
                sub={`${movedCount.characters}캐릭`}
              />
              <StatTile
                tone="rename"
                icon={PenLine}
                label="닉네임 변경"
                targetId={summary.renamed.length > 0 ? 'roster-renamed' : undefined}
                value={`${summary.renamed.length}캐릭`}
              />
              <StatTile
                tone="partial"
                icon={Users}
                label="일부 가입·탈퇴"
                targetId="roster-partial"
                value={`${joinedAddedCount.people + leftPartialCount.people}명`}
                sub={`가입 ${joinedAddedCount.people} · 탈퇴 ${leftPartialCount.people}`}
              />
              <StatTile
                tone="unknown"
                icon={CircleHelp}
                label="추적 불가"
                targetId={leftByReason.untraceable.length > 0 ? 'roster-untraceable' : undefined}
                value={`${leftByReason.untraceable.length}캐릭`}
              />
            </div>
          </div>

          {summary.renamed.length > 0 && (
            <SectionCard id="roster-renamed" tone="rename" icon={PenLine} title="닉네임 변경" count={`${summary.renamed.length}캐릭`}>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {summary.renamed.map((entry) => (
                  <li key={entry.toName} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through">{entry.fromName}</span>
                    <span className="text-violet-500">→</span>
                    <span className="font-semibold">{entry.toName}</span>
                    {entry.level !== null && (
                      <span className="text-xs text-muted-foreground tabular-nums">Lv.{entry.level}</span>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* **전체 가입·탈퇴** — 사람이 통째로 들어오거나 나간 것. 넓은 화면에서는 나란히. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              id="roster-joined"
              tone="join"
              icon={UserPlus}
              title="전체 가입"
              count={headCount(joinedNewCount)}
              description="그 사람의 캐릭터가 전부 새로 들어왔습니다(새 그룹). 사람마다 메인 캐릭터만 보입니다."
            >
              <GuildChips
                tone="join"
                label="어디서"
                rows={flow
                  .filter((entry) => !entry.alliance)
                  .map((entry) => ({ guildName: entry.guildName, count: entry.incoming.whole }))}
              />
              <PersonList<JoinedEntry>
                entries={joinedNew}
                groups={summary.personGroups}
                mainOf={mainOf}
                collapse
                renderDetail={(entry) => (
                  <>
                    <GuildTag tone="join">{guildLabel(entry.previousGuildName)}에서</GuildTag>
                    {entry.previousName && (
                      <span className="text-xs text-muted-foreground">이전 닉네임 {entry.previousName}</span>
                    )}
                  </>
                )}
              />
            </SectionCard>
            <SectionCard
              id="roster-left"
              tone="leave"
              icon={UserMinus}
              title="전체 탈퇴"
              count={headCount(leftWholeCount)}
              description="그 사람의 캐릭터가 모두 빠졌습니다(그룹이 없어짐). 사람마다 메인 캐릭터만 보입니다."
            >
              <GuildChips
                tone="leave"
                label="어디로"
                rows={flow
                  .filter((entry) => !entry.alliance)
                  .map((entry) => ({ guildName: entry.guildName, count: entry.outgoing.whole }))}
              />
              <PersonList<LeftEntry>
                entries={leftWhole}
                groups={summary.personGroups}
                mainOf={mainOf}
                collapse
                renderDetail={(entry) => <LeftDetail entry={entry} />}
              />
            </SectionCard>
          </div>

          {/* **연합 내 이동** — 사람 단위로 묶고 메인 캐릭터만. 가입·탈퇴 집계에서는 뺀다. */}
          {movedCount.characters > 0 && (
            <SectionCard
              id="roster-alliance"
              tone="alliance"
              icon={ArrowLeftRight}
              title="연합 내 이동"
              count={headCount(movedCount)}
              description={
                <>
                  연합 안 다른 길드에서 오거나 그쪽으로 갔습니다. <strong>가입·탈퇴 집계에서 뺐습니다</strong> — 같은
                  사건이 양쪽 길드 화면에서 같은 이름으로 보입니다.
                </>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    들어옴 {headCount(countPeople(joinedSplit.moved.map((entry) => entry.characterName), groups))}
                  </h3>
                  <PersonList<JoinedEntry>
                    entries={joinedSplit.moved}
                    groups={summary.personGroups}
                    mainOf={mainOf}
                    collapse
                    renderDetail={(entry) => (
                      <GuildTag tone="alliance">{guildLabel(entry.previousGuildName)}에서</GuildTag>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    나감{' '}
                    {headCount(countPeople(leftByReason.allianceMove.map((entry) => entry.characterName), groups))}
                  </h3>
                  <PersonList<LeftEntry>
                    entries={leftByReason.allianceMove}
                    groups={summary.personGroups}
                    mainOf={mainOf}
                    collapse
                    renderDetail={(entry) => (
                      <GuildTag tone="alliance">→ {guildLabel(entry.currentGuildName)}</GuildTag>
                    )}
                  />
                </div>
              </div>
            </SectionCard>
          )}

          {/* **일부 가입·탈퇴** — 길드에 남아 있는 사람이 캐릭터만 넣거나 뺀 것. 기본은 접어 둔다. */}
          <SectionCard
            id="roster-partial"
            tone="partial"
            icon={Users}
            title="일부 가입·탈퇴"
            count={`가입 ${headCount(joinedAddedCount)} · 탈퇴 ${headCount(leftPartialCount)}`}
            description="길드에 있는 사람이 캐릭터만 더 넣거나 뺐습니다 — 같은 사람의 다른 캐릭터가 이미 있었거나 아직 남아 있습니다."
            collapsible
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">일부 가입 {headCount(joinedAddedCount)}</h3>
                <GuildChips
                  tone="join"
                  label="어디서"
                  rows={flow
                    .filter((entry) => !entry.alliance)
                    .map((entry) => ({ guildName: entry.guildName, count: entry.incoming.partial }))}
                />
                <PersonList<JoinedEntry>
                  entries={joinedAdded}
                  groups={summary.personGroups}
                  mainOf={mainOf}
                  renderDetail={(entry) => (
                    <>
                      <GuildTag tone="join">{guildLabel(entry.previousGuildName)}에서</GuildTag>
                      <span className="text-xs text-muted-foreground">
                        이미 있던 캐릭터 {(joinKinds.others.get(entry.characterName) ?? []).join(', ')}
                      </span>
                    </>
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">일부 탈퇴 {headCount(leftPartialCount)}</h3>
                <GuildChips
                  tone="leave"
                  label="어디로"
                  rows={flow
                    .filter((entry) => !entry.alliance)
                    .map((entry) => ({ guildName: entry.guildName, count: entry.outgoing.partial }))}
                />
                <PersonList<LeftEntry>
                  entries={leftPartial}
                  groups={summary.personGroups}
                  mainOf={mainOf}
                  renderDetail={(entry) => (
                    <>
                      <LeftDetail entry={entry} />
                      <span className="text-xs text-muted-foreground">
                        남은 캐릭터 {(leaveKinds.others.get(entry.characterName) ?? []).join(', ')}
                      </span>
                    </>
                  )}
                />
              </div>
            </div>
          </SectionCard>

          {leftByReason.untraceable.length > 0 && (
            <SectionCard
              id="roster-untraceable"
              tone="unknown"
              icon={CircleHelp}
              title="추적 불가"
              count={`${leftByReason.untraceable.length}캐릭`}
              description={
                <>
                  명단에서 빠졌는데 <strong>이 이름으로는 더 이상 추적할 수 없는</strong> 캐릭터입니다. 탈퇴 후
                  닉네임 변경, 캐릭터 삭제, 월드 리프, 닉네임 이전이 모두 같은 모습으로 나타나서 원인을 가릴 수
                  없습니다. 알아낸 단서만 그대로 적습니다.
                </>
              }
            >
              <ul className="divide-y rounded-md border bg-background">
                {leftByReason.untraceable.map((entry) => (
                  <li key={entry.characterName} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-semibold">{entry.characterName}</span>
                    {entry.hint === 'not-found' && (
                      <span className="text-xs text-muted-foreground">이 이름으로 조회되지 않음</span>
                    )}
                    {entry.hint === 'name-reused' && (
                      <span className="text-xs text-muted-foreground">
                        이 이름을 쓰는 캐릭터가 조회 시작 시점엔 다른 이름이었음 — 다른 사람입니다
                      </span>
                    )}
                    {(entry.hint === 'same-name-reachable-world' ||
                      entry.hint === 'same-name-unreachable-world') && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          같은 이름이 {entry.foundWorldName}에 있음
                          {entry.level !== null && ` (Lv.${entry.level}`}
                          {entry.foundCreatedAt && `, 생성일 ${entry.foundCreatedAt}`}
                          {entry.level !== null && ')'}
                        </span>
                        {entry.hint === 'same-name-unreachable-world' ? (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs">리프 불가 월드 — 다른 사람입니다</span>
                        ) : (
                          <GuildTag tone="unknown">리프 가능 월드 — 본인일 수도, 동명이인일 수도</GuildTag>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
