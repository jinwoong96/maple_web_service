import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'

export function useUnionInfo(ocid: string | undefined) {
  return useQuery({
    queryKey: ['union', 'info', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/unions/{ocid}', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useUnionArtifact(ocid: string | undefined) {
  return useQuery({
    queryKey: ['union', 'artifact', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/unions/{ocid}/artifact', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useUnionRaider(ocid: string | undefined) {
  return useQuery({
    queryKey: ['union', 'raider', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/unions/{ocid}/raider', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}

export function useUnionChampion(ocid: string | undefined) {
  return useQuery({
    queryKey: ['union', 'champion', ocid],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/unions/{ocid}/champion', {
        params: { path: { ocid: ocid! } },
      })
      if (error) throw error
      return data.union_champion ?? []
    },
    enabled: Boolean(ocid),
    retry: false,
  })
}
