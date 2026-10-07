import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'

export function useOguildId(guildName: string, worldName: string) {
  return useQuery({
    queryKey: ['guild', 'oguild-id', guildName, worldName],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/guilds/oguild-id', {
        params: { query: { guild_name: guildName, world_name: worldName } },
      })
      if (error) throw error
      return data.oguild_id
    },
    enabled: guildName.length > 0 && worldName.length > 0,
    retry: false,
  })
}

export function useGuildBasic(oguildId: string | undefined) {
  return useQuery({
    queryKey: ['guild', 'basic', oguildId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/guilds/{oguild_id}/basic', {
        params: { path: { oguild_id: oguildId! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(oguildId),
    retry: false,
  })
}
