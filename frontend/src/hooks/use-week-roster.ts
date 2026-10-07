import { useQuery } from '@tanstack/react-query'

import { fetchMembersAtOrEarlier } from '@/hooks/use-roster-diff'
import { getYesterdayKstDateString } from '@/lib/kst-date'

/** 주차(목요일 시작)의 마지막 날 — 수요일. 길드 컨텐츠는 목요일에 리셋되니 그 주 점수판에
 * 찍히는 명단은 수요일 명단이다. */
export function lastDayOfWeek(weekStart: string): string {
  const day = new Date(`${weekStart}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 6)
  return day.toISOString().slice(0, 10)
}

export interface WeekRoster {
  members: readonly string[]
  /** 그 당시 길드 인원(사람 수, `guild_user_count`). 점수판은 사람마다 한 줄이라 이것과 견준다. */
  userCount: number | null
  /** 명단을 받은 날짜. `null`이면 아직 끝나지 않은 주차라 최신 명단을 쓴 것. */
  date: string | null
  loading: boolean
  /** 그 날짜 명단을 못 받아 최신 명단으로 대신 쓰고 있다. */
  failed: boolean
}

/** 점수 입력에서 대조할 길드 명단 — **선택한 주차의 마지막 수요일** 명단(2026-10-04 사용자 결정).
 *
 * 예전엔 길드를 불러온 시점의 최신 명단을 썼다. 지난 주차를 나중에 입력하면 그 사이 닉변·탈퇴한
 * 사람의 스크린샷 이름이 명단에 없어 "못 찾음"이 되고, 새로 들어온 캐릭터가 엉뚱한 줄에 붙을 수
 * 있었다. 수요일이 아직 안 지났으면(진행 중인 주차) 최신 명단을 쓴다. 명단 조회는 우리 백엔드라
 * 사용자 키를 쓰지 않는다. */
export function useWeekRoster(
  oguildId: string,
  weekStart: string,
  latest: { members: readonly string[]; userCount: number | null },
): WeekRoster {
  const lastDay = lastDayOfWeek(weekStart)
  const past = lastDay <= getYesterdayKstDateString()
  const query = useQuery({
    queryKey: ['guild-admin', 'week-roster', oguildId, lastDay],
    queryFn: () => fetchMembersAtOrEarlier(oguildId, lastDay),
    enabled: past,
    staleTime: Infinity,
    retry: false,
  })
  const current = { members: latest.members, userCount: latest.userCount }
  if (!past) return { ...current, date: null, loading: false, failed: false }
  if (query.data) return { ...query.data, loading: false, failed: false }
  return { ...current, date: null, loading: query.isPending, failed: query.isError }
}
