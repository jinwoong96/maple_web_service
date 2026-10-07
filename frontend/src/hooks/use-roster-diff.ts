import { useCallback, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import { loadGrouping, toNameGroups } from '@/lib/grouping-store'
import { useOcidResolver } from '@/hooks/use-ocid-resolver'
import {
  diffRoster,
  type RosterDiffProgress,
  type RosterDiffResult,
} from '@/lib/guild-roster-diff'

export type RosterDiffStatus = 'idle' | 'running' | 'done' | 'error'

export interface RosterDiffSummary extends RosterDiffResult {
  oldDate: string
  newDate: string
  oldMemberCount: number
  newMemberCount: number
  /** 이전·이후 명단. 가입·탈퇴를 "사람 전체"인지 "일부 캐릭터"인지 가르는 데 쓴다. */
  oldMembers: string[]
  newMembers: string[]
  /** ocid 조회까지 합친 총 호출 수. */
  apiCalls: number
}

/** 길드 명단은 공용 키로 되는 조회라 우리 백엔드를 그대로 쓴다 — 사용자 키는
 * 캐릭터 수백 명을 훑는 쪽에 아껴 쓴다. */
async function fetchMembersAt(
  oguildId: string,
  date: string,
): Promise<{ members: string[]; userCount: number | null }> {
  const { data, error } = await apiClient.GET('/api/v1/guilds/{oguild_id}/basic', {
    params: { path: { oguild_id: oguildId }, query: { date } },
  })
  if (error) throw error
  const members = data.guild_member ?? []
  // 명단이 비어 오는 건 "전원 탈퇴"가 아니라 조회가 잘못된 것이다. 그대로
  // 넘기면 길드원 전체가 탈퇴로 잡히므로 여기서 막는다.
  if (members.length === 0) throw new Error(`${date} 명단을 받지 못했습니다.`)
  return { members, userCount: data.guild_user_count ?? null }
}

/** 기준일을 어제로 잡아도 넥슨이 아직 그날 자료를 안 올렸을 수 있다
 * (`OPENAPI00009` "Please wait until the data is ready" — 실측 확인:
 * 2026-09-26 오전에 `date=2026-09-25`). 그럴 때 하루 더 당겨 조회하고,
 * 실제로 쓴 날짜를 돌려준다.
 *
 * 길드 조회는 우리 백엔드를 거쳐서 넥슨 에러 코드가 그대로 오지 않으므로,
 * 원인을 가리지 않고 한 번만 되짚는다. 두 번째도 실패하면 처음 에러를
 * 그대로 올린다 — 날짜 문제가 아니었다는 뜻이다. */
export async function fetchMembersAtOrEarlier(
  oguildId: string,
  date: string,
): Promise<{ members: string[]; userCount: number | null; date: string }> {
  try {
    return { ...(await fetchMembersAt(oguildId, date)), date }
  } catch (first) {
    const previous = new Date(`${date}T00:00:00Z`)
    previous.setUTCDate(previous.getUTCDate() - 1)
    const fallback = previous.toISOString().slice(0, 10)
    try {
      return { ...(await fetchMembersAt(oguildId, fallback)), date: fallback }
    } catch {
      throw first
    }
  }
}

export function useRosterDiff(apiKey: string) {
  const { resolve, flush, takeNetworkCalls } = useOcidResolver(apiKey)
  const [status, setStatus] = useState<RosterDiffStatus>('idle')
  const [progress, setProgress] = useState<RosterDiffProgress | null>(null)
  const [summary, setSummary] = useState<RosterDiffSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (guild: { oguildId: string; guildName: string; worldName: string }, oldDate: string, newDate: string) => {
      setStatus('running')
      setError(null)
      setProgress(null)
      setSummary(null)
      try {
        const [oldRoster, newRoster] = await Promise.all([
          fetchMembersAtOrEarlier(guild.oguildId, oldDate),
          fetchMembersAtOrEarlier(guild.oguildId, newDate),
        ])
        const oldMembers = oldRoster.members
        const newMembers = newRoster.members
        const result = await diffRoster(
          {
            guildName: guild.guildName,
            worldName: guild.worldName,
            oldMembers,
            newMembers,
            oldDate: oldRoster.date,
          },
          apiKey,
          {
            resolveOcid: resolve,
            // ⓪을 이미 돌렸으면 현재 명단 쪽은 공짜로 묶인다.
            knownGroups: await loadGrouping(guild.oguildId).then((stored) => (stored ? toNameGroups(stored) : null)),
            onProgress: setProgress,
          },
        )
        flush()
        setSummary({
          ...result,
          apiCalls: result.basicCalls + result.championCalls + takeNetworkCalls(),
          oldDate: oldRoster.date,
          newDate: newRoster.date,
          oldMemberCount: oldMembers.length,
          newMemberCount: newMembers.length,
          oldMembers,
          newMembers,
        })
        setStatus('done')
      } catch (caught) {
        flush()
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
      }
    },
    [apiKey, resolve, flush, takeNetworkCalls],
  )

  return { status, progress, summary, error, run }
}
