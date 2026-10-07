import { useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGuildGroups, type GuildIdentity } from '@/hooks/use-guild-groups'
import { representativeName, type GroupMember, type StoredGroup } from '@/lib/grouping-store'

function formatUpdatedAt(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

interface GroupTabProps {
  guild: GuildIdentity
  apiKey: string
}

type GroupFilter = 'all' | 'unconfirmed' | 'changed'

/** 닉네임 아래에 작게 붙일 레벨·직업. 받아온 날짜는 마우스를 올리면 보인다. */
function ProfileLine({ member }: { member: GroupMember }) {
  if (!member.profile) return null
  const date = member.profile.checkedAt.slice(0, 10)
  return (
    <span className="block text-[11px] font-normal text-muted-foreground" title={`${date}에 받아온 값`}>
      Lv.{member.profile.level}
      {member.profile.job && ` · ${member.profile.job}`}
    </span>
  )
}

/** 확인이 필요한 그룹 — 대표가 있는데 아직 확정하지 않았다. */
function needsConfirm(group: StoredGroup): boolean {
  return group.representative !== null && !group.confirmed
}

function GroupRow({
  group,
  index,
  onConfirm,
  onPick,
}: {
  group: StoredGroup
  index: number
  onConfirm: () => void
  onPick: (ocid: string) => void
}) {
  const representative = representativeName(group)
  const representativeMember = group.members.find((member) => member.ocid === group.representative)
  const joined = new Set(group.changedAfterConfirm?.joined ?? [])
  /** 대표를 뺀 나머지는 **레벨 높은 순**(2026-10-04 사용자 요청). 대표는 따로 맨 앞에
   * 놓는다. 레벨을 모르는 캐릭터는 뒤에 원래(명단) 순서대로. */
  const others = group.members
    .filter((member) => member.name !== representative)
    .map((member, order) => ({ member, order }))
    .sort((a, b) => {
      const left = a.member.profile?.level
      const right = b.member.profile?.level
      if (left === undefined || right === undefined) {
        if (left !== right) return left === undefined ? 1 : -1
        return a.order - b.order
      }
      return right - left || a.order - b.order
    })
    .map((entry) => entry.member)
  const single = group.members.length === 1

  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${
        needsConfirm(group) ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30' : ''
      }`}
    >
      <span className="w-10 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
      {needsConfirm(group) && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          확인 필요
        </span>
      )}
      {group.changedAfterConfirm && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          확정 후 멤버 변동
          {group.changedAfterConfirm.joined.length > 0 && ` · 합류 ${group.changedAfterConfirm.joined.join(', ')}`}
          {group.changedAfterConfirm.left.length > 0 && ` · 탈퇴 ${group.changedAfterConfirm.left.join(', ')}`}
        </span>
      )}
      {representative ? (
        <span
          className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${
            group.confirmed
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300'
          }`}
        >
          대표 · {representative}
          {group.confirmed && ' ✓'}
          {representativeMember && <ProfileLine member={representativeMember} />}
        </span>
      ) : (
        <span className="rounded-md border border-dashed px-2 py-0.5 text-sm text-muted-foreground">
          대표 없음 — 캐릭터를 누르세요
        </span>
      )}
      {/* 확정 전에는 다른 캐릭터를 누르면 그 캐릭터가 대표가 되고 바로 확정된다.
          **확정된 그룹은 눌러도 바뀌지 않는다** — 잘못 눌러 확정한 대표가 바뀌면 안 된다
          (2026-10-04 사용자 요청). 바꿔야 하면 목록 위 "닉네임으로 대표 지정"을 쓴다. */}
      {group.confirmed &&
        others.map((member) => (
          <span
            key={member.name}
            title="확정된 그룹입니다. 대표를 바꾸려면 목록 위 '닉네임으로 대표 지정'을 쓰세요."
            className={`rounded-md border bg-muted px-2 py-0.5 text-sm ${
              joined.has(member.name) ? 'border-dashed border-violet-400' : ''
            }`}
          >
            {member.name}
            {joined.has(member.name) && <span className="ml-1 text-[11px] text-violet-700">새로 합류</span>}
            <ProfileLine member={member} />
          </span>
        ))}
      {!group.confirmed && others.map((member) => (
        <button
          key={member.name}
          type="button"
          disabled={!member.ocid}
          onClick={() => member.ocid && onPick(member.ocid)}
          title={member.ocid ? `${member.name}을(를) 대표로 정하고 확정` : 'ocid를 몰라 대표로 정할 수 없습니다'}
          className={`rounded-md border bg-muted px-2 py-0.5 text-sm hover:bg-muted/60 disabled:opacity-50 ${
            joined.has(member.name) ? 'border-dashed border-violet-400' : ''
          }`}
        >
          {member.name}
          {joined.has(member.name) && <span className="ml-1 text-[11px] text-violet-700">새로 합류</span>}
          <ProfileLine member={member} />
        </button>
      ))}
      {single && <span className="text-xs text-muted-foreground">캐릭터 1개 — 자동 확정</span>}
      <div className="grow" />
      {!single && representative && (!group.confirmed || group.changedAfterConfirm) && (
        <Button type="button" size="sm" variant={group.confirmed ? 'outline' : 'default'} onClick={onConfirm}>
          {group.confirmed ? '다시 확정' : '확정'}
        </Button>
      )}
    </li>
  )
}

/** 닉네임으로 그 캐릭터의 그룹을 찾아 대표로 정한다. 보조 기능이라 접어 둔다. */
function PickByName({
  groups,
  onPick,
}: {
  groups: readonly StoredGroup[]
  onPick: (groupId: string, ocid: string) => void
}) {
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const found = trimmed
    ? groups
        .map((group, index) => ({ group, index, member: group.members.find((member) => member.name === trimmed) }))
        .find((entry) => entry.member !== undefined)
    : undefined

  return (
    <details className="rounded-lg border px-3 py-2.5">
      <summary className="cursor-pointer text-sm text-muted-foreground">닉네임으로 대표 지정</summary>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="대표로 정할 닉네임"
          aria-label="대표로 지정할 닉네임"
          list="group-member-names"
          className="w-48"
        />
        <datalist id="group-member-names">
          {groups.flatMap((group) => group.members).map((member) => (
            <option key={member.name} value={member.name} />
          ))}
        </datalist>
        {trimmed && !found && <span className="text-sm text-muted-foreground">그룹에 그 닉네임이 없습니다.</span>}
        {found && (
          <>
            <span className="text-sm">
              → {found.index + 1}번 그룹(지금 대표: {representativeName(found.group) ?? '없음'})
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!found.member?.ocid}
              onClick={() => {
                if (found.member?.ocid) onPick(found.group.id, found.member.ocid)
                setName('')
              }}
            >
              이 캐릭터를 대표로 (확정)
            </Button>
          </>
        )}
      </div>
    </details>
  )
}

export function GroupTab({ guild, apiKey }: GroupTabProps) {
  const { status, progress, levelProgress, summary, error, run, cancel, confirm, setRepresentative, fillProfiles } =
    useGuildGroups(guild.oguildId, apiKey)
  const [nameFilter, setNameFilter] = useState('')
  const [filter, setFilter] = useState<GroupFilter>('all')

  /** **대표(후보) 닉네임 순**으로 세운다(2026-10-04 사용자 요청). 게임 닉네임 정렬처럼
   * **문자 코드 순**이다 — 숫자 → 영문 대문자 → 영문 소문자 → 한글, 대소문자 구분
   * (`DRUMS` < `DayBreak`). 대표가 없는 그룹은 맨 뒤에 첫 캐릭터 이름순으로. 화면 순서만
   * 바꾸고 저장본은 그대로다. */
  const groups = useMemo(() => {
    const keyed = (summary?.groups ?? []).map((group) => {
      const representative = representativeName(group)
      return { group, representative, key: representative ?? group.members[0]?.name ?? '' }
    })
    keyed.sort((a, b) => {
      if ((a.representative === null) !== (b.representative === null)) return a.representative === null ? 1 : -1
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })
    return keyed.map((entry) => entry.group)
  }, [summary])
  const classifiedCharacters = groups.reduce((sum, group) => sum + group.members.length, 0)
  const counts = {
    all: groups.length,
    unconfirmed: groups.filter(needsConfirm).length,
    changed: groups.filter((group) => group.changedAfterConfirm !== null).length,
  }
  const confirmedCount = groups.filter((group) => group.confirmed).length
  /** 레벨·직업을 아직 모르는 캐릭터 수. 받아오기 버튼의 호출 수다. */
  const missingProfiles = groups.reduce(
    (sum, group) => sum + group.members.filter((member) => !member.profile).length,
    0,
  )

  /** 번호는 전체 목록의 자리로 고정한다 — 걸러봐도 같은 그룹은 같은 번호. */
  const filteredGroups = useMemo(() => {
    const needle = nameFilter.trim().toLowerCase()
    return groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => {
        if (filter === 'unconfirmed' && !needsConfirm(group)) return false
        if (filter === 'changed' && group.changedAfterConfirm === null) return false
        if (!needle) return true
        return group.members.some((member) => member.name.toLowerCase().includes(needle))
      })
  }, [groups, nameFilter, filter])

  const confirmable = filteredGroups.filter(
    ({ group }) => group.representative !== null && (!group.confirmed || group.changedAfterConfirm !== null),
  )

  const exceedsSlotCount =
    summary !== null && summary.userCount !== null && summary.groups.length > summary.userCount
  const changes = summary?.lastChanges

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {guild.guildName} <span className="text-muted-foreground">({guild.worldName})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {guild.memberCount.toLocaleString()}캐릭
            {guild.userCount !== null && ` · 가입 ${guild.userCount.toLocaleString()}캐릭`}
            {summary && ` · 분류 ${summary.groups.length.toLocaleString()}명`}
            {summary && ` · 대표 확정 ${confirmedCount.toLocaleString()}`}
            {summary && summary.unclassified.length > 0 && ` · 미분류 ${summary.unclassified.length}캐릭`}
            {summary && ` · ${formatUpdatedAt(summary.updatedAt)} 갱신 · 이 브라우저 DB에 저장`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'running' ? (
            <Button type="button" variant="outline" onClick={cancel}>
              중단
            </Button>
          ) : (
            <>
              <Button type="button" onClick={() => void run(guild)} disabled={!apiKey || (status === 'error' && !summary)}>
                {summary ? '새 캐릭터만 갱신' : '그룹화 실행'}
              </Button>
              {summary && missingProfiles > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fillProfiles()}
                  disabled={!apiKey}
                  title="닉네임 아래에 보여줄 레벨·직업을 모르는 캐릭터만 받아옵니다"
                >
                  레벨·직업 모르는 캐릭터 받아오기 ({missingProfiles.toLocaleString()}회)
                </Button>
              )}
              {summary && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void run(guild, { force: true })}
                  disabled={!apiKey}
                  title="그룹을 처음부터 다시 묶습니다. 확정된 대표는 그대로 이어받고, 확정 전 그룹만 대표를 다시 고릅니다."
                >
                  처음부터 다시
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {!apiKey && (
        <Alert>
          <AlertDescription>그룹화를 실행하려면 위에 Nexon API 키를 입력해주세요.</AlertDescription>
        </Alert>
      )}

      {status === 'running' && progress && (
        <Alert>
          <AlertDescription>
            {progress.resolved.toLocaleString()} / {progress.total.toLocaleString()}캐릭 분류 중 ·
            챔피언 조회 {progress.championCalls.toLocaleString()}회
          </AlertDescription>
        </Alert>
      )}

      {status === 'running' && levelProgress && (
        <Alert>
          <AlertDescription>
            캐릭터 레벨·직업 받아오는 중 · {levelProgress.done.toLocaleString()} /{' '}
            {levelProgress.total.toLocaleString()}캐릭
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertDescription>{summary ? `그룹화에 실패했습니다: ${error}` : error}</AlertDescription>
        </Alert>
      )}

      {changes && status !== 'running' && (
        <div className="flex flex-col gap-1 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <span className="font-semibold">
            마지막 갱신에서 바뀐 것 · 닉변 {changes.renames.length} · 합류 {changes.joined.length} · 탈퇴{' '}
            {changes.left.length}
            {summary && summary.apiCalls > 0 && ` · API ${summary.apiCalls.toLocaleString()}회`}
          </span>
          {changes.renames.length > 0 && (
            <span>닉변: {changes.renames.map((rename) => `${rename.from} → ${rename.to}`).join(' · ')}</span>
          )}
          {/* 사람 단위로 가른다 — 새 그룹이 생긴 것과 기존 그룹에 캐릭터가 더해진 것,
              그룹이 통째로 없어진 것과 일부 캐릭터만 빠진 것. */}
          {changes.joinedNewPeople && changes.joinedNewPeople.length > 0 && (
            <span>새로 온 사람(새 그룹): {changes.joinedNewPeople.join(', ')}</span>
          )}
          {changes.joinedToExisting && changes.joinedToExisting.length > 0 && (
            <span>기존 그룹에 캐릭터 추가: {changes.joinedToExisting.join(', ')}</span>
          )}
          {changes.leftWholePeople && changes.leftWholePeople.length > 0 && (
            <span>떠난 사람(그룹 없어짐): {changes.leftWholePeople.join(', ')}</span>
          )}
          {changes.leftPartial && changes.leftPartial.length > 0 && (
            <span>그룹에서 일부 캐릭터만 탈퇴: {changes.leftPartial.join(', ')}</span>
          )}
          {changes.picked > 0 && (
            <span>대표가 없던 그룹 {changes.picked}개는 레벨로 대표를 골랐습니다(확인 필요).</span>
          )}
          <span className="text-xs">기존 그룹은 멤버가 바뀌어도 대표를 다시 고르지 않습니다.</span>
        </div>
      )}

      {exceedsSlotCount && summary?.userCount != null && (
        <Alert variant="destructive">
          <AlertDescription>
            묶인 그룹이 {summary.groups.length.toLocaleString()}개인데 실제 가입 캐릭터는{' '}
            {summary.userCount.toLocaleString()}개입니다. 한 사람이 최소 한 캐릭터는 가입해야
            하니 그룹 수가 이걸 넘을 수 없는데 넘었습니다 — 그룹화가 잘못됐을 수 있습니다.
          </AlertDescription>
        </Alert>
      )}

      {summary && summary.failures.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {summary.failures.length}개 캐릭터 조회가 실패해 건너뛰었습니다 (
            {summary.failures
              .slice(0, 3)
              .map((failure) => failure.characterName)
              .join(', ')}
            {summary.failures.length > 3 && ' 외'}).
          </AlertDescription>
        </Alert>
      )}

      {summary && groups.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border p-0.5">
              {(
                [
                  ['all', `전체 ${counts.all}`],
                  ['unconfirmed', `확인 필요 ${counts.unconfirmed}`],
                  ['changed', `확정 후 멤버 변동 ${counts.changed}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    filter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="캐릭터명 검색"
              aria-label="캐릭터명 검색"
              className="w-44"
            />
            <span className="text-xs text-muted-foreground">
              {filteredGroups.length.toLocaleString()}명 · 캐릭터 {classifiedCharacters.toLocaleString()}개
            </span>
            <div className="grow" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={confirmable.length === 0}
              onClick={() => void confirm(confirmable.map(({ group }) => group.id))}
            >
              보이는 그룹 모두 확정 ({confirmable.length})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            대표가 맞으면 <strong>확정</strong>을 누르세요. 확정 전에는 다른 캐릭터를 누르면 그 캐릭터가 대표가
            되고 바로 확정됩니다. 확정된 그룹은 눌러도 바뀌지 않으니, 바꾸려면 바로 아래 "닉네임으로 대표 지정"을
            쓰세요. 점수 입력은 대표의 지금 닉네임으로 저장합니다.
          </p>

          <PickByName groups={groups} onPick={(groupId, ocid) => void setRepresentative(groupId, ocid)} />

          <ul className="flex flex-col gap-2">
            {filteredGroups.map(({ group, index }) => (
              <GroupRow
                key={group.id}
                group={group}
                index={index}
                onConfirm={() => void confirm([group.id])}
                onPick={(ocid) => void setRepresentative(group.id, ocid)}
              />
            ))}
          </ul>

        </>
      )}

      {summary && summary.unclassified.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">미분류 {summary.unclassified.length}캐릭</p>
          <p className="text-xs text-muted-foreground">
            유니온 챔피언을 개방하지 않았고, 다른 길드원의 챔피언 목록에도 나오지 않아 누구의
            캐릭터인지 알 수 없는 캐릭터입니다.
          </p>
          <div className="flex flex-wrap gap-1">
            {summary.unclassified.map((name) => (
              <span key={name} className="rounded bg-muted px-2 py-0.5 text-sm">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
