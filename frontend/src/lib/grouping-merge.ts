/** 다시 그룹화할 때 **지난 저장본을 이어받는** 계산. 넥슨 호출이 없는 순수 함수들.
 *
 * - 닉변 감지: 지난 명단에서 사라진 이름과 새 이름의 ocid가 같으면 같은 캐릭터다.
 * - 대표·확정 이어받기: 새로 묶인 그룹을 지난 그룹과 멤버로 짝짓고, 대표 ocid가
 *   아직 그룹에 있으면 대표·확정을 그대로 둔다. **멤버가 바뀌어도 대표를 다시
 *   고르지 않는다**(2026-10-04 사용자 결정). 확정된 그룹이면 바뀐 멤버를
 *   `changedAfterConfirm`에 쌓아 표시만 한다.
 * - 대표가 길드를 떠났으면 대표를 비우고 확정을 푼다 — 다시 골라야 한다.
 */

import type { CharacterGroup } from '@/lib/guild-admin-grouping'
import type { StoredGroup, StoredGrouping } from '@/lib/grouping-store'

export interface Rename {
  ocid: string
  from: string
  to: string
}

/** 사라진 이름과 새 이름을 ocid로 짝짓는다. `freshOcids`는 새 이름 → ocid(모르면 없음). */
export function detectRenames(
  vanished: ReadonlyMap<string, string>,
  freshOcids: ReadonlyMap<string, string>,
): Rename[] {
  const byOcid = new Map<string, string>()
  for (const [name, ocid] of vanished) byOcid.set(ocid, name)
  const renames: Rename[] = []
  for (const [name, ocid] of freshOcids) {
    const from = byOcid.get(ocid)
    if (from !== undefined && from !== name) renames.push({ ocid, from, to: name })
  }
  return renames
}

/** 지난 그룹에 닉변을 반영한다(이름만 바꾸고 ocid·대표·확정은 그대로). */
export function applyRenames(groups: readonly StoredGroup[], renames: readonly Rename[]): StoredGroup[] {
  if (renames.length === 0) return [...groups]
  const to = new Map(renames.map((rename) => [rename.from, rename.to]))
  return groups.map((group) => ({
    ...group,
    members: group.members.map((member) => ({ ...member, name: to.get(member.name) ?? member.name })),
  }))
}

function mergeChange(
  previous: StoredGroup['changedAfterConfirm'],
  joined: string[],
  left: string[],
): StoredGroup['changedAfterConfirm'] {
  if (joined.length === 0 && left.length === 0) return previous
  const unique = (values: string[]) => [...new Set(values)]
  return {
    joined: unique([...(previous?.joined ?? []), ...joined]),
    left: unique([...(previous?.left ?? []), ...left]),
  }
}

/** 새로 묶인 그룹에 지난 그룹의 대표·확정·변동 표시를 이어 붙인다.
 *
 * `previous`는 닉변을 반영한 지난 그룹들이다. 새 그룹마다 멤버가 가장 많이 겹치는
 * 지난 그룹을 짝으로 삼는다. 한 지난 그룹을 두 새 그룹이 노리면 먼저 온 쪽만 갖는다
 * (그룹이 쪼개진 드문 경우 — 나머지는 새 그룹이 된다). */
export function mergeGroups(
  previous: readonly StoredGroup[],
  built: readonly CharacterGroup[],
  ocidOf: (name: string) => string | null,
): StoredGroup[] {
  const groupOfName = new Map<string, StoredGroup>()
  /** 지난번에 받아 둔 레벨·직업. 이름(닉변 반영)으로 이어받는다. */
  const profileOf = new Map<string, NonNullable<StoredGroup['members'][number]['profile']>>()
  for (const group of previous) {
    for (const member of group.members) {
      groupOfName.set(member.name, group)
      if (member.profile) profileOf.set(member.name, member.profile)
    }
  }
  const taken = new Set<StoredGroup>()

  return built.map((group) => {
    const members = group.members.map((name) => {
      const profile = profileOf.get(name)
      return profile ? { name, ocid: ocidOf(name), profile } : { name, ocid: ocidOf(name) }
    })

    const overlap = new Map<StoredGroup, number>()
    for (const name of group.members) {
      const old = groupOfName.get(name)
      if (old && !taken.has(old)) overlap.set(old, (overlap.get(old) ?? 0) + 1)
    }
    const match = [...overlap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    if (members.length === 1) {
      // 캐릭터가 하나뿐이면 고를 것이 없다 — 자동 확정.
      if (match) taken.add(match)
      return {
        id: group.id,
        members,
        representative: members[0].ocid,
        confirmed: members[0].ocid !== null,
        changedAfterConfirm: null,
      }
    }

    if (!match) {
      return { id: group.id, members, representative: null, confirmed: false, changedAfterConfirm: null }
    }
    taken.add(match)

    const before = new Set(match.members.map((member) => member.name))
    const now = new Set(group.members)
    const joined = group.members.filter((name) => !before.has(name))
    const left = match.members.map((member) => member.name).filter((name) => !now.has(name))
    const representativeStays =
      match.representative !== null && members.some((member) => member.ocid === match.representative)

    if (!representativeStays) {
      // 대표가 떠났다(또는 원래 없었다). 대표를 비우고 다시 고르게 한다.
      return { id: group.id, members, representative: null, confirmed: false, changedAfterConfirm: null }
    }
    return {
      id: group.id,
      members,
      representative: match.representative,
      confirmed: match.confirmed,
      changedAfterConfirm: match.confirmed
        ? mergeChange(match.changedAfterConfirm, joined, left)
        : null,
    }
  })
}

/** 그룹 저장본의 이름 → ocid. 이어받을 때 다시 조회하지 않으려고. */
export function knownOcids(grouping: StoredGrouping | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const group of grouping?.groups ?? []) {
    for (const member of group.members) if (member.ocid) map.set(member.name, member.ocid)
  }
  return map
}
