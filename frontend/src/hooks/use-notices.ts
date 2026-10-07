import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'

export function useGeneralNotices() {
  return useQuery({
    queryKey: ['notices', 'general'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/notices/general')
      if (error) throw error
      return data.notice ?? []
    },
  })
}

export function useEventNotices() {
  return useQuery({
    queryKey: ['notices', 'events'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/notices/events')
      if (error) throw error
      return data.event_notice ?? []
    },
  })
}

export function useUpdateNotices() {
  return useQuery({
    queryKey: ['notices', 'updates'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/notices/updates')
      if (error) throw error
      return data.update_notice ?? []
    },
  })
}

export function useCashshopNotices() {
  return useQuery({
    queryKey: ['notices', 'cashshop'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/notices/cashshop')
      if (error) throw error
      return data.cashshop_notice ?? []
    },
  })
}
