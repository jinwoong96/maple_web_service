import { useCallback, useState } from 'react'

import { useOcidResolver } from '@/hooks/use-ocid-resolver'
import {
  computeGrowth,
  groupGrowthByPerson,
  EXP_TABLE_ERROR_THRESHOLD,
  medianError,
  signedImpliedExpError,
  sortByGrowthAscending,
  type CharacterGrowth,
  type CharacterSnapshot,
  type PersonGrowth,
} from '@/lib/character-growth'
import { loadGrouping, representativeName, toNameGroups } from '@/lib/grouping-store'
import { nexonDirectGet, NexonDirectApiError } from '@/lib/nexon-direct-client'

interface CharacterBasicResponse {
  character_name: string
  character_level: number
  character_exp: number | string
  character_exp_rate: string
}

/** 캐릭터마다 독립적이라 그냥 동시에 던진다. 상한은
 * `nexon-direct-client.ts`의 토큰 버킷(200/s)이 잡는다. */
const GROWTH_CONCURRENCY = 12

export type GrowthStatus = 'idle' | 'running' | 'done' | 'error'

export interface GrowthProgress {
  resolved: number
  total: number
  basicCalls: number
}

/** 사람 한 명의 성장. 순위는 그룹 캐릭터 전부의 경험치 합계(`totalExpGained`)로 세운다. */
export interface PersonView extends PersonGrowth {
  /** 그룹화 뒤에 새로 들어온 캐릭터라 누구 것인지 모르고 따로 조회했다. */
  ungrouped: boolean
}

export interface GrowthSummary {
  people: PersonView[]
  /** 두 시점 모두 만렙이라 성장을 **잴 수 없는** 사람. 성장량 0이 아니라
   * 측정 불가라 본 목록에서 뺀다 — 안 그러면 길드에서 제일 열심히 한 사람이
   * "안 크는 사람" 1등으로 뜬다. */
  maxLevelPeople: PersonView[]
  /** 두 시점 중 한쪽 조회가 안 된 캐릭터(구간 시작 때 아직 없었다 등). */
  incomplete: string[]
  oldDate: string
  newDate: string
  apiCalls: number
  /** 그룹화 뒤에 새로 들어온 캐릭터. 사람을 몰라 각자 조회했다 — 그룹을 갱신하라고 알린다. */
  ungroupedNew: string[]
  /** 테이블 자가 검증 결과. `median`이 임계값을 넘으면 테이블이 낡은 것으로
   * 본다 — 개별 캐릭터가 어긋나는 건 흔하고 표 문제가 아니기 때문이다. */
  tableCheck: { median: number | null; sampled: number; stale: boolean }
}

/** 넥슨이 "아직 그날 자료가 준비 안 됐다"고 할 때의 코드. 기준일을 어제로
 * 잡아도 시간대에 따라 이게 온다(실측: 2026-09-26 오전에 date=2026-09-25). */
const DATA_NOT_READY = 'OPENAPI00009'

function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/** 실제로 조회되는 날짜를 찾는다.
 *
 * **스윕 전에 한 번만** 한다. 안 그러면 준비 안 된 날짜로 1000명을 다 돌고
 * 전부 실패한 뒤에야 알게 된다 — 2000번을 헛되이 쏘는 셈이다.
 *
 * `OPENAPI00009`(자료 미준비)일 때만 하루씩 당긴다. 다른 에러는 그 캐릭터
 * 사정이지 날짜 문제가 아니다(그 시점에 없던 캐릭터라면 날짜는 멀쩡하다). */
async function resolveAvailableDate(ocid: string, apiKey: string, date: string): Promise<string> {
  let candidate = date
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await nexonDirectGet<CharacterBasicResponse>('/maplestory/v1/character/basic', apiKey, {
        ocid,
        date: candidate,
      })
      return candidate
    } catch (error) {
      if (!(error instanceof NexonDirectApiError) || error.code !== DATA_NOT_READY) return candidate
      candidate = shiftDays(candidate, -1)
    }
  }
  return candidate
}

function toSnapshot(data: CharacterBasicResponse): CharacterSnapshot | null {
  if (data.character_level === null || data.character_level === undefined) return null
  const rate = Number(data.character_exp_rate)
  return {
    characterName: data.character_name,
    level: data.character_level,
    exp: BigInt(data.character_exp ?? 0),
    expRate: Number.isFinite(rate) ? rate : 0,
  }
}

/** ② 길드원 성장 추적.
 *
 * **길드원 캐릭터를 전부 조회하고, 그룹(사람)마다 경험치 합계로 순위를 세운다.**
 * 한때 호출을 줄이려고 대표만 조회하고 부캐는 눌러서 받게 했는데, 써 보니 부캐로만 키우는
 * 사람이 꽤 많아 대표 성장으로는 순위가 틀렸다(2026-10-04 사용자 판단). 호출은 캐릭터당 2회.
 *
 * 그룹에 없는 캐릭터(미분류, 그룹화 뒤 새로 들어온 캐릭터)는 누구 것인지 몰라 각자 한 사람으로 센다. */
export function useGrowthTracking(apiKey: string) {
  const { resolve, flush, takeNetworkCalls } = useOcidResolver(apiKey)
  const [status, setStatus] = useState<GrowthStatus>('idle')
  const [progress, setProgress] = useState<GrowthProgress | null>(null)
  const [summary, setSummary] = useState<GrowthSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** 이름들을 두 시점 조회해 성장을 계산한다. */
  const probeMany = useCallback(
    async (names: readonly string[], oldDate: string, newDate: string, onEach?: (calls: number) => void) => {
      const growths: CharacterGrowth[] = []
      const incomplete: string[] = []
      const tableErrors: number[] = []
      let calls = 0

      async function probe(name: string) {
        try {
          const ocid = await resolve(name)
          const [beforeData, afterData] = await Promise.all([
            nexonDirectGet<CharacterBasicResponse>('/maplestory/v1/character/basic', apiKey, { ocid, date: oldDate }),
            nexonDirectGet<CharacterBasicResponse>('/maplestory/v1/character/basic', apiKey, { ocid, date: newDate }),
          ])
          calls += 2
          const before = toSnapshot(beforeData)
          const after = toSnapshot(afterData)
          if (!before || !after) {
            incomplete.push(name)
            return
          }
          // 테이블이 낡았는지 최신 스냅샷으로 표본 검사한다.
          const err = signedImpliedExpError(after)
          if (err !== null) tableErrors.push(err)
          growths.push(computeGrowth(before, after))
        } catch {
          // 구간 시작 시점에 아직 없던 캐릭터이거나 조회 실패. 어느 쪽이든 성장을 계산할 수 없다.
          incomplete.push(name)
        } finally {
          onEach?.(calls)
        }
      }

      let cursor = 0
      async function drain() {
        for (;;) {
          const index = cursor
          cursor += 1
          if (index >= names.length) return
          await probe(names[index])
        }
      }
      await Promise.all(Array.from({ length: Math.min(GROWTH_CONCURRENCY, names.length) }, () => drain()))
      return { growths, incomplete, tableErrors, calls }
    },
    [apiKey, resolve],
  )

  const run = useCallback(
    async (guild: { oguildId: string; members: string[] }, oldDate: string, newDate: string) => {
      setStatus('running')
      setError(null)
      setSummary(null)

      try {
        const stored = await loadGrouping(guild.oguildId)
        const roster = new Set(guild.members)
        const groups = stored
          ? toNameGroups(stored).map((group) => ({ ...group, members: group.members.filter((name) => roster.has(name)) }))
          : null
        const representatives = new Map<string, string>()
        for (const group of stored?.groups ?? []) {
          const name = representativeName(group)
          if (name && roster.has(name)) representatives.set(group.id, name)
        }

        const targets = guild.members

        let resolved = 0
        setProgress({ resolved: 0, total: targets.length, basicCalls: 0 })

        // 조회 가능한 날짜부터 확정한다. 기준 캐릭터는 아무나 — 날짜 판정에만 쓴다.
        let effectiveOldDate = oldDate
        let effectiveNewDate = newDate
        if (targets.length > 0) {
          const referenceOcid = await resolve(targets[0])
          ;[effectiveOldDate, effectiveNewDate] = await Promise.all([
            resolveAvailableDate(referenceOcid, apiKey, oldDate),
            resolveAvailableDate(referenceOcid, apiKey, newDate),
          ])
        }

        const result = await probeMany(targets, effectiveOldDate, effectiveNewDate, (calls) => {
          resolved += 1
          setProgress({ resolved, total: targets.length, basicCalls: calls })
        })
        flush()

        const snapshot = new Set(stored?.memberSnapshot ?? [])
        const ungroupedNew = stored ? guild.members.filter((name) => !snapshot.has(name)) : []
        const ungroupedSet = new Set(ungroupedNew)
        const people: PersonView[] = groupGrowthByPerson(result.growths, groups, representatives).map((person) => ({
          ...person,
          ungrouped: ungroupedSet.has(person.id),
        }))
        setSummary({
          // 그룹 합계가 적은 순 — 부캐로만 키워도 그 사람의 성장으로 잡힌다.
          people: sortByGrowthAscending(people.filter((p) => !p.allStuckAtMaxLevel)),
          maxLevelPeople: people.filter((p) => p.allStuckAtMaxLevel),
          incomplete: result.incomplete,
          oldDate: effectiveOldDate,
          newDate: effectiveNewDate,
          apiCalls: result.calls + takeNetworkCalls(),
          ungroupedNew,
          tableCheck: {
            median: medianError(result.tableErrors),
            sampled: result.tableErrors.length,
            stale: Math.abs(medianError(result.tableErrors) ?? 0) > EXP_TABLE_ERROR_THRESHOLD,
          },
        })
        setStatus('done')
      } catch (caught) {
        flush()
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
      }
    },
    [apiKey, resolve, flush, takeNetworkCalls, probeMany],
  )

  return { status, progress, summary, error, run }
}
