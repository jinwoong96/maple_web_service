import { useCallback, useEffect, useRef, useState } from 'react'

import { useOcidResolver } from '@/hooks/use-ocid-resolver'
import {
  buildCharacterGroups,
  fetchProfiles,
  pickByLevel,
  type GroupingFailure,
  type GroupingProgress,
  type LevelProgress,
} from '@/lib/guild-admin-grouping'
import { loadOcidCache } from '@/lib/guild-admin-storage'
import { applyRenames, detectRenames, knownOcids, mergeGroups } from '@/lib/grouping-merge'
import { splitByPersonPresence } from '@/lib/guild-roster-diff'
import {
  addRenames,
  GROUPING_SAVED_EVENT,
  loadGrouping,
  saveGrouping,
  toNameGroups,
  type StoredGroup,
  type StoredGrouping,
} from '@/lib/grouping-store'

export type GroupingStatus = 'idle' | 'loading' | 'running' | 'done' | 'error'

export interface GuildIdentity {
  oguildId: string
  guildName: string
  worldName: string
  memberCount: number
  userCount: number | null
  members: string[]
}

export interface GroupingSummary extends StoredGrouping {
  failures: GroupingFailure[]
  /** 이번 실행에서 실제로 쏜 호출 수. 저장본을 불러온 경우 0이다. */
  apiCalls: number
  /** 증분으로 돌았는지. 처음 돌린 것과 구분해 화면에 표시한다. */
  incremental: boolean
}

function toSummary(stored: StoredGrouping): GroupingSummary {
  return { ...stored, failures: [], apiCalls: 0, incremental: false }
}

/** 이 동시 실행 수로 ocid를 채운다. 그룹화와 같은 값. */
const OCID_CONCURRENCY = 8

/** ⓪ 캐릭터 그룹화 실행/보관 — **브라우저 DB**에 둔다.
 *
 * TanStack Query가 아니라 명령형 훅이다 — 수백 번의 API 호출을 쏘는 작업이라
 * 화면에 들어오자마자 자동으로 돌면 안 되고, 사용자가 버튼을 눌러 시작해야 한다.
 *
 * 다시 돌릴 때(2026-10-04)
 * 1. **닉변 감지** — 사라진 이름과 새 이름의 ocid가 같으면 같은 캐릭터. 그룹 안
 *    이름을 바꾸고 내역을 쌓는다.
 * 2. 그룹화(새 캐릭터만 순회).
 * 3. 지난 그룹의 **대표·확정을 이어받는다.** 멤버가 바뀌어도 다시 고르지 않는다.
 * 4. 대표가 없는 그룹만 레벨로 한 번 고른다(확인 필요 상태).
 *
 * `oguildId`가 바뀌면 그 길드의 저장본을 꺼내 보여준다(호출 없음). 다른 탭이 같은
 * 길드의 저장본을 고치면 다시 읽는다.
 */
export function useGuildGroups(oguildId: string | null, apiKey: string) {
  const { resolve: resolveOcid, flush: flushOcidCache, takeNetworkCalls } = useOcidResolver(apiKey)
  const [status, setStatus] = useState<GroupingStatus>('idle')
  const [progress, setProgress] = useState<GroupingProgress | null>(null)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [summary, setSummary] = useState<GroupingSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 길드가 바뀌면 저장본을 읽는다. 다른 탭이 저장하면 다시 읽는다(실행 중이 아닐 때).
  useEffect(() => {
    let alive = true
    const reload = async () => {
      try {
        const stored = oguildId ? await loadGrouping(oguildId) : null
        if (!alive || abortRef.current) return
        setSummary(stored ? toSummary(stored) : null)
        setStatus(stored ? 'done' : 'idle')
        setError(null)
      } catch (caught) {
        if (!alive) return
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
      }
    }
    void reload()
    const onSaved = (event: Event) => {
      if ((event as CustomEvent<string>).detail === oguildId) void reload()
    }
    window.addEventListener(GROUPING_SAVED_EVENT, onSaved)
    return () => {
      alive = false
      window.removeEventListener(GROUPING_SAVED_EVENT, onSaved)
    }
  }, [oguildId])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  /** 이름들의 ocid를 채운다. 아는 것은 건너뛰고, 모르는 것만 조회한다. 실패는 비운다. */
  const resolveMany = useCallback(
    async (names: readonly string[], known: Map<string, string>, signal: AbortSignal) => {
      const missing = names.filter((name) => !known.has(name))
      for (let start = 0; start < missing.length; start += OCID_CONCURRENCY) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        await Promise.all(
          missing.slice(start, start + OCID_CONCURRENCY).map(async (name) => {
            try {
              known.set(name, await resolveOcid(name))
            } catch {
              // 못 찾으면(이미 닉변해 사라진 이름 등) 비워 둔다.
            }
          }),
        )
      }
    },
    [resolveOcid],
  )

  const run = useCallback(
    async (guild: GuildIdentity, { force = false }: { force?: boolean } = {}) => {
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('running')
      setError(null)
      setLevelProgress(null)
      setProgress({ resolved: 0, total: guild.members.length, championCalls: 0 })

      try {
        // "처음부터 다시"(force)도 지난 저장본을 읽는다 — 묶기는 처음부터 하되, 확정된 대표는
        // 이어받는다(2026-10-04 사용자 요청). 지우지 않고 새로 저장할 때 덮어쓴다.
        const previous = await loadGrouping(guild.oguildId)

        // 이름 → ocid. 지난 저장본 → localStorage 캐시 순으로 채우고, 모르는 것만 조회한다.
        const ocids = knownOcids(previous)
        for (const [name, ocid] of Object.entries(loadOcidCache())) if (!ocids.has(name)) ocids.set(name, ocid)

        // 1. 닉변 감지.
        const roster = new Set(guild.members)
        const before = new Set(previous?.memberSnapshot ?? [])
        const vanished = new Map<string, string>()
        for (const name of before) {
          const ocid = ocids.get(name)
          if (!roster.has(name) && ocid) vanished.set(name, ocid)
        }
        const fresh = guild.members.filter((name) => !before.has(name))
        let renames: ReturnType<typeof detectRenames> = []
        if (previous && vanished.size > 0 && fresh.length > 0) {
          await resolveMany(fresh, ocids, controller.signal)
          const freshOcids = new Map(fresh.flatMap((name) => (ocids.has(name) ? [[name, ocids.get(name)!]] : [])))
          renames = detectRenames(vanished, freshOcids as Map<string, string>)
        }
        const carried = applyRenames(previous?.groups ?? [], renames)

        // 2. 그룹화. 이어받은 그룹을 심어 두면 새 캐릭터만 순회한다.
        const result = await buildCharacterGroups(guild.members, apiKey, {
          resolveOcid,
          preassigned: previous && !force ? toNameGroups({ ...previous, groups: carried }) : undefined,
          onProgress: setProgress,
          signal: controller.signal,
        })
        setProgress(null)

        // 3. 멤버 ocid를 채우고 대표·확정을 이어받는다.
        await resolveMany(
          result.groups.flatMap((group) => group.members),
          ocids,
          controller.signal,
        )
        let merged = mergeGroups(carried, result.groups, (name) => ocids.get(name) ?? null)
        if (force) {
          // 처음부터 다시: **확정된 대표만** 남기고, 확정 전이던 대표는 다시 고른다.
          merged = merged.map((group) =>
            group.members.length > 1 && !group.confirmed
              ? { ...group, representative: null, changedAfterConfirm: null }
              : group,
          )
        }

        // 4. 레벨·직업을 모르는 캐릭터(대개 이번에 새로 들어온 캐릭터)만 받아 채우고, 대표가 없는
        //    그룹만 레벨로 한 번 고른다. 이미 받아 둔 레벨은 다시 받지 않고 고르는 데 쓴다.
        //    예전엔 대표를 고를 그룹만 받아서, 기존 그룹에 합류한 캐릭터는 레벨·직업이 비어 있었다
        //    (2026-10-04 사용자 발견).
        const unpicked = merged.filter((group) => group.representative === null && group.members.length > 1)
        const missing = merged.flatMap((group) => group.members.filter((member) => !member.profile).map((member) => member.name))
        let levelCalls = 0
        let groups: StoredGroup[] = merged
        if (missing.length > 0 || unpicked.length > 0) {
          const fetched =
            missing.length > 0
              ? await fetchProfiles(missing, apiKey, {
                  resolveOcid,
                  onProgress: setLevelProgress,
                  signal: controller.signal,
                })
              : { profiles: {}, calls: 0, failures: [] }
          levelCalls = fetched.calls
          groups = merged.map((group) => {
            const members = group.members.map((member) =>
              fetched.profiles[member.name] ? { ...member, profile: fetched.profiles[member.name] } : member,
            )
            if (group.representative !== null || members.length < 2) return { ...group, members }
            const levels = Object.fromEntries(
              members.flatMap((member) => (member.profile ? [[member.name, member.profile.level]] : [])),
            )
            const name = pickByLevel(
              members.map((member) => member.name),
              levels,
            )
            const ocid = members.find((member) => member.name === name)?.ocid ?? null
            return { ...group, members, representative: ocid, confirmed: false, changedAfterConfirm: null }
          })
        }

        const renamedTo = new Set(renames.map((rename) => rename.to))
        const renamedFrom = new Set(renames.map((rename) => rename.from))
        const joinedNames = previous ? fresh.filter((name) => !renamedTo.has(name)) : []
        const leftNames = [...before].filter((name) => !roster.has(name) && !renamedFrom.has(name))
        // 가입은 새 그룹 기준(이전 명단에 같은 사람 캐릭터가 있었나), 탈퇴는 지난 그룹 기준
        // (지금 명단에 같은 사람 캐릭터가 남았나)으로 가른다.
        const joinKinds = splitByPersonPresence(
          joinedNames,
          groups.map((group) => ({ id: group.id, members: group.members.map((member) => member.name) })),
          before,
        )
        const leaveKinds = splitByPersonPresence(leftNames, previous ? toNameGroups(previous) : null, roster)
        const next: StoredGrouping = {
          oguildId: guild.oguildId,
          guildName: guild.guildName,
          worldName: guild.worldName,
          updatedAt: new Date().toISOString(),
          memberCount: guild.memberCount,
          userCount: guild.userCount,
          groups,
          unclassified: result.unclassified,
          memberSnapshot: guild.members,
          lastChanges: {
            renames: renames.map(({ from, to }) => ({ from, to })),
            joined: joinedNames,
            left: leftNames,
            joinedNewPeople: joinKinds.whole,
            joinedToExisting: joinKinds.partial,
            leftWholePeople: leaveKinds.whole,
            leftPartial: leaveKinds.partial,
            picked: unpicked.length,
          },
        }
        await saveGrouping(next)
        const detectedAt = next.updatedAt
        await addRenames(renames.map((rename) => ({ ...rename, detectedAt, oguildId: guild.oguildId })))
        flushOcidCache()

        setSummary({
          ...next,
          failures: result.failures,
          apiCalls: result.championCalls + levelCalls + takeNetworkCalls(),
          incremental: previous !== null && !force,
        })
        setStatus('done')
        setLevelProgress(null)
      } catch (caught) {
        // 중단은 실패가 아니다 — 지금까지 받은 ocid는 살려두고 저장본을 보여준다.
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          flushOcidCache()
          const stored = await loadGrouping(guild.oguildId)
          setSummary(stored ? toSummary(stored) : null)
          setStatus(stored ? 'done' : 'idle')
          setProgress(null)
          setLevelProgress(null)
          return
        }
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
      } finally {
        abortRef.current = null
      }
    },
    [apiKey, resolveOcid, resolveMany, flushOcidCache, takeNetworkCalls],
  )

  /** 레벨·직업을 모르는 캐릭터만 받아와 저장한다. 버튼을 눌러야 돈다(캐릭터당 1회). */
  const fillProfiles = useCallback(async () => {
    if (!oguildId) return
    const stored = await loadGrouping(oguildId)
    if (!stored) return
    const names = stored.groups.flatMap((group) => group.members.filter((member) => !member.profile).map((member) => member.name))
    if (names.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('running')
    setError(null)
    try {
      const fetched = await fetchProfiles(names, apiKey, {
        resolveOcid,
        onProgress: setLevelProgress,
        signal: controller.signal,
      })
      flushOcidCache()
      // 받는 동안 다른 탭에서 확정했을 수 있다 — 다시 읽어 그 위에 얹는다.
      const latest = (await loadGrouping(oguildId)) ?? stored
      const next: StoredGrouping = {
        ...latest,
        groups: latest.groups.map((group) => ({
          ...group,
          members: group.members.map((member) =>
            fetched.profiles[member.name] ? { ...member, profile: fetched.profiles[member.name] } : member,
          ),
        })),
      }
      await saveGrouping(next)
      setSummary({ ...toSummary(next), apiCalls: fetched.calls + takeNetworkCalls() })
      setStatus('done')
      setLevelProgress(null)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        flushOcidCache()
        setStatus('done')
        setLevelProgress(null)
        return
      }
      setError(caught instanceof Error ? caught.message : String(caught))
      setStatus('error')
    } finally {
      abortRef.current = null
    }
  }, [oguildId, apiKey, resolveOcid, flushOcidCache, takeNetworkCalls])

  /** 저장본의 그룹 몇 개를 고쳐 저장한다. 호출이 없다. */
  const updateGroups = useCallback(
    async (change: (group: StoredGroup) => StoredGroup | null) => {
      if (!oguildId) return
      const stored = await loadGrouping(oguildId)
      if (!stored) return
      const next = { ...stored, groups: stored.groups.map((group) => change(group) ?? group) }
      await saveGrouping(next)
      setSummary((prev) => (prev ? { ...prev, groups: next.groups } : toSummary(next)))
    },
    [oguildId],
  )

  /** 지금 대표를 확정한다. 확정 뒤 멤버 변동 표시도 지운다. */
  const confirm = useCallback(
    (groupIds: readonly string[]) => {
      const ids = new Set(groupIds)
      return updateGroups((group) =>
        ids.has(group.id) && group.representative !== null
          ? { ...group, confirmed: true, changedAfterConfirm: null }
          : null,
      )
    },
    [updateGroups],
  )

  /** 대표를 바꾸고 바로 확정한다. */
  const setRepresentative = useCallback(
    (groupId: string, ocid: string) =>
      updateGroups((group) =>
        group.id === groupId ? { ...group, representative: ocid, confirmed: true, changedAfterConfirm: null } : null,
      ),
    [updateGroups],
  )

  return { status, progress, levelProgress, summary, error, run, cancel, confirm, setRepresentative, fillProfiles }
}
