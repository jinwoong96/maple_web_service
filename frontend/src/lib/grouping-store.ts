/** ⓪ 그룹화 저장본 — **브라우저 DB(IndexedDB)**.
 *
 * 2026-10-04 localStorage에서 옮겼다. 그룹마다 대표·확정 여부·확정 뒤 멤버 변동을
 * 들고, 캐릭터마다 ocid를 들게 되면서 구조가 커졌다. 예전 저장본
 * (`maple-log:guild-admin:groups:v1`)은 처음 읽을 때 옮기고 지운다.
 *
 * 캐릭터를 **ocid로도** 기억하는 이유는 닉변이다. 닉네임은 바뀌어도 ocid는 그대로라,
 * 다시 그룹화할 때 사라진 이름과 새 이름의 ocid가 같으면 같은 캐릭터로 본다.
 */

import type { CharacterGroup, CharacterProfileSnapshot } from '@/lib/guild-admin-grouping'
import { loadOcidCache } from '@/lib/guild-admin-storage'
import { idbGet, idbGetAll, idbPut, STORES } from '@/lib/idb'

export interface GroupMember {
  name: string
  /** 모르면 `null`. 다음 그룹화 때 채운다. */
  ocid: string | null
  /** 넥슨에서 받아온 그때의 레벨·직업. 받은 적 없으면 없다. */
  profile?: CharacterProfileSnapshot
}

export interface StoredGroup {
  /** union-find 루트 이름. 식별자일 뿐이다. */
  id: string
  members: GroupMember[]
  /** 대표 캐릭터의 ocid. 닉변해도 그대로다. 아직 못 정했으면 `null`. */
  representative: string | null
  /** 사람이 대표를 확정했는가. 캐릭터가 하나뿐인 그룹은 자동 확정. */
  confirmed: boolean
  /** 확정한 뒤 멤버가 바뀌었는가. 다시 확정하면 지운다. */
  changedAfterConfirm: { joined: string[]; left: string[] } | null
}

export interface GroupingChanges {
  renames: { from: string; to: string }[]
  joined: string[]
  left: string[]
  /** 가입 중 새로 온 사람(새 그룹)의 캐릭터 / 기존 그룹에 더해진 캐릭터. 예전 저장본엔 없다. */
  joinedNewPeople?: string[]
  joinedToExisting?: string[]
  /** 탈퇴 중 그룹이 통째로 없어진 캐릭터 / 그룹에서 일부만 빠진 캐릭터. */
  leftWholePeople?: string[]
  leftPartial?: string[]
  /** 이번에 대표를 자동으로 고른 그룹 수. */
  picked: number
}

export interface StoredGrouping {
  oguildId: string
  guildName: string
  worldName: string
  updatedAt: string
  /** 그 시점 `guild_member_count` — 캐릭터 수. */
  memberCount: number
  /** 그 시점 `guild_user_count`. 사람 수가 아니라 가입한 캐릭터 수다. */
  userCount: number | null
  groups: StoredGroup[]
  unclassified: string[]
  /** 순회에 썼던 명단 전체. 증분 갱신과 닉변 감지에 쓴다. */
  memberSnapshot: string[]
  /** 마지막 갱신에서 바뀐 것. 그룹 탭 위쪽 요약에 쓴다. */
  lastChanges?: GroupingChanges
}

export interface RenameEntry {
  ocid: string
  from: string
  to: string
  detectedAt: string
  oguildId: string
}

/** 저장본이 바뀌었다고 알리는 이벤트. 같은 길드를 여러 탭(그룹·점수 입력)이 따로
 * 읽으므로, 한쪽에서 저장하면 다른 쪽이 다시 읽게 한다. */
export const GROUPING_SAVED_EVENT = 'maple-log:grouping-saved'

const LEGACY_KEY = 'maple-log:guild-admin:groups:v1'

interface LegacyGrouping {
  oguildId: string
  guildName: string
  worldName: string
  updatedAt: string
  memberCount: number
  userCount: number | null
  groups: CharacterGroup[]
  unclassified: string[]
  memberSnapshot: string[]
}

/** 옮긴 뒤 예전 localStorage 저장본에서 그 길드를 지운다. */
function forgetLegacy(oguildId: string): void {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const store = JSON.parse(raw) as Record<string, LegacyGrouping>
    delete store[oguildId]
    if (Object.keys(store).length === 0) window.localStorage.removeItem(LEGACY_KEY)
    else window.localStorage.setItem(LEGACY_KEY, JSON.stringify(store))
  } catch {
    // 못 지워도 다음에 IndexedDB 쪽이 먼저 읽히므로 문제없다.
  }
}

/** 예전 localStorage 저장본을 새 모양으로 바꾼다. 대표는 아직 없다 — 다음 그룹화 때 고른다. */
function migrateLegacy(oguildId: string): StoredGrouping | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const store = JSON.parse(raw) as Record<string, LegacyGrouping>
    const legacy = store[oguildId]
    if (!legacy) return null
    const ocids = loadOcidCache()
    const migrated: StoredGrouping = {
      oguildId: legacy.oguildId,
      guildName: legacy.guildName,
      worldName: legacy.worldName,
      updatedAt: legacy.updatedAt,
      memberCount: legacy.memberCount,
      userCount: legacy.userCount,
      groups: legacy.groups.map((group) => {
        const members = group.members.map((name) => ({ name, ocid: ocids[name] ?? null }))
        const single = members.length === 1
        return {
          id: group.id,
          members,
          representative: single ? members[0].ocid : null,
          confirmed: single && members[0].ocid !== null,
          changedAfterConfirm: null,
        }
      }),
      unclassified: legacy.unclassified,
      memberSnapshot: legacy.memberSnapshot,
    }
    return migrated
  } catch {
    return null
  }
}

/** 저장본을 읽는다. 없으면 `null`. **저장소를 못 열면 던진다** — 삼키면 "그룹화한 적
 * 없음"으로 보여서, 사용자가 처음부터 다시 돌려 대표·확정을 날릴 수 있다. */
export async function loadGrouping(oguildId: string): Promise<StoredGrouping | null> {
  const stored = await idbGet<StoredGrouping>(STORES.groupings, oguildId)
  if (stored) return stored
  const migrated = migrateLegacy(oguildId)
  // 옮긴 것을 먼저 저장하고 나서 예전 것을 지운다 — 저장이 실패하면 예전 것이 남는다.
  if (migrated) {
    await idbPut(STORES.groupings, oguildId, migrated)
    forgetLegacy(oguildId)
  }
  return migrated
}

export async function saveGrouping(grouping: StoredGrouping): Promise<void> {
  await idbPut(STORES.groupings, grouping.oguildId, grouping)
  window.dispatchEvent(new CustomEvent(GROUPING_SAVED_EVENT, { detail: grouping.oguildId }))
}

/** 이름만 담은 그룹. 그룹화 함수·명단 변동·성장 추적이 이 모양을 쓴다. */
export function toNameGroups(grouping: StoredGrouping): CharacterGroup[] {
  return grouping.groups.map((group) => ({ id: group.id, members: group.members.map((member) => member.name) }))
}

/** 그룹의 대표 이름. 대표 ocid를 지금 멤버에서 찾는다 — 닉변했으면 새 이름이 나온다. */
export function representativeName(group: StoredGroup): string | null {
  if (group.representative === null) return null
  return group.members.find((member) => member.ocid === group.representative)?.name ?? null
}

export async function addRenames(entries: RenameEntry[]): Promise<void> {
  for (const entry of entries) {
    await idbPut(STORES.renames, `${entry.ocid}|${entry.detectedAt}`, entry)
  }
}

export function listRenames(): Promise<RenameEntry[]> {
  return idbGetAll<RenameEntry>(STORES.renames).catch(() => [])
}

/** 예전 이름 → 지금 이름. 닉변이 이어졌으면(A→B→C) 끝까지 따라간다. */
export function currentNameResolver(renames: readonly RenameEntry[]): (name: string) => string {
  const next = new Map<string, string>()
  for (const entry of [...renames].sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))) {
    next.set(entry.from, entry.to)
  }
  return (name) => {
    let current = name
    for (let guard = 0; guard < 20 && next.has(current); guard++) current = next.get(current)!
    return current
  }
}
