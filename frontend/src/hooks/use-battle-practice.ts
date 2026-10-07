import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'

export function useBattlePracticeReplayIds(ocid: string | undefined) {
  return useQuery({
    queryKey: ['battle-practice', 'replay-ids', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/battle-practice/replay-ids', {
        params: { query: { ocid: ocid! } },
      })
      if (error) throw error
      return data.replay_list ?? []
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useBattlePracticeResult(replayId: string | undefined) {
  return useQuery({
    queryKey: ['battle-practice', 'result', replayId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/battle-practice/{replay_id}/result', {
        params: { path: { replay_id: replayId! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(replayId),
    retry: false,
  })
}

/** 그 판에서 스킬을 언제 썼는지. 페이지로 끊어 온다.
 *
 * 한 판이 수천 줄이라 넥슨이 `page_no`로 잘라 준다. 몇 쪽인지는 응답의
 * `total_page_no`가 알려주므로 화면이 미리 알 필요가 없다. */
export function useBattlePracticeSkillTimeline(replayId: string | undefined, pageNo: number) {
  return useQuery({
    queryKey: ['battle-practice', 'skill-timeline', replayId, pageNo],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/battle-practice/{replay_id}/skill-timeline',
        { params: { path: { replay_id: replayId! }, query: { page_no: pageNo } } },
      )
      if (error) throw error
      return data
    },
    enabled: Boolean(replayId),
    retry: false,
    // 지난 판의 기록은 바뀌지 않는다. 쪽을 오가며 다시 부를 이유가 없다.
    staleTime: Infinity,
  })
}

/** 그 판을 찍을 때의 캐릭터 상태. 스탯·하이퍼스탯·어빌리티가 통째로 온다. */
export function useBattlePracticeCharacterInfo(replayId: string | undefined) {
  return useQuery({
    queryKey: ['battle-practice', 'character-info', replayId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/battle-practice/{replay_id}/character-info',
        { params: { path: { replay_id: replayId! } } },
      )
      if (error) throw error
      return data
    },
    enabled: Boolean(replayId),
    retry: false,
    staleTime: Infinity,
  })
}
