import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'

interface RankingListParams {
  date: string
  worldName: string
  page: number
  /** 한 캐릭터의 순위만 볼 때. 그 캐릭터가 이 범위에 기록이 없으면 빈 목록이
   * 온다 — 오류가 아니다. */
  ocid?: string
  /** 닉네임은 받았지만 아직 ocid로 바꾸지 못한 동안 호출을 멈춘다. 멈추지
   * 않으면 필터가 안 걸린 1위부터의 목록이 잠깐 보이고, 그게 검색 결과처럼
   * 읽힌다. */
  waiting?: boolean
}

function ready({ date, waiting }: RankingListParams): boolean {
  return date.length > 0 && !waiting
}

interface OverallParams extends RankingListParams {
  /** 월드 구분: 0 일반, 1 리부트. 월드 이름을 넣으면 넥슨이 이 값을 무시한다
   * (둘 다 넣어 같은 결과가 오는 것으로 확인, 2026-09-27). */
  worldType?: number
  /** `대분류-소분류`. `lib/ranking-classes.ts`의 값만 넣어야 한다 — 틀린
   * 값은 400이 아니라 **필터 없는 랭킹**으로 조용히 떨어진다. */
  className?: string
}

export function useRankingOverall(params: OverallParams) {
  const { date, worldName, page, ocid, worldType, className } = params
  return useQuery({
    queryKey: ['ranking', 'overall', date, worldName, page, ocid, worldType, className],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/overall', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            world_type: worldType,
            class: className || undefined,
            ocid,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}

export function useRankingUnion(params: RankingListParams) {
  const { date, worldName, page, ocid } = params
  return useQuery({
    queryKey: ['ranking', 'union', date, worldName, page, ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/union', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            ocid,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}

interface GuildParams extends RankingListParams {
  /** 길드 랭킹 종류. `lib/ranking-options.ts`의 `GUILD_RANKING_TYPES` 참고 —
   * 생략하면 400이라 항상 보낸다. */
  rankingType: number
  guildName?: string
}

export function useRankingGuild(params: GuildParams) {
  const { date, worldName, page, rankingType, guildName } = params
  return useQuery({
    queryKey: ['ranking', 'guild', date, worldName, page, rankingType, guildName],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/guild', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            ranking_type: rankingType,
            guild_name: guildName || undefined,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}

interface DojangParams extends RankingListParams {
  /** 구간: 0 입문, 1 통달. 생략하면 400이라 항상 보낸다. */
  difficulty: number
  className?: string
}

export function useRankingDojang(params: DojangParams) {
  const { date, worldName, page, ocid, difficulty, className } = params
  return useQuery({
    queryKey: ['ranking', 'dojang', date, worldName, page, ocid, difficulty, className],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/dojang', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            difficulty,
            class: className || undefined,
            ocid,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}

export function useRankingTheSeed(params: RankingListParams) {
  const { date, worldName, page, ocid } = params
  return useQuery({
    queryKey: ['ranking', 'theseed', date, worldName, page, ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/theseed', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            ocid,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}

export function useRankingAchievement(params: RankingListParams) {
  const { date, worldName, page, ocid } = params
  return useQuery({
    queryKey: ['ranking', 'achievement', date, worldName, page, ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/rankings/achievement', {
        params: {
          query: {
            date,
            world_name: worldName || undefined,
            ocid,
            page,
          },
        },
      })
      if (error) throw error
      return data.ranking ?? []
    },
    enabled: ready(params),
    retry: false,
  })
}
