import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { apiClient } from '@/lib/api-client'

export const NOTIFICATION_ITEM_TYPES = ['symbol_growth', 'artifact_expiry'] as const
export type NotificationItemType = (typeof NOTIFICATION_ITEM_TYPES)[number]

export const NOTIFICATION_ITEM_LABELS: Record<NotificationItemType, string> = {
  symbol_growth: '심볼업',
  artifact_expiry: '유니온 아티팩트 만료',
}

const CHANNEL_STORAGE_KEY = 'maple-log:notification:channel:v1'

export interface NotificationChannel {
  accessKey: string
  webhookUrlMasked: string
}

/** 웹훅 등록 때 받은 키는 `localStorage`에 둔다. 로그인이 없는 서비스라 이
 * 키가 "누구의 알림인지"를 가른다. 잃어버려도 같은 웹훅 URL을 다시 등록하면
 * 같은 키가 나오므로 대상 목록은 그대로 이어진다. */
function loadChannel(): NotificationChannel | null {
  try {
    const raw = window.localStorage.getItem(CHANNEL_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as NotificationChannel) : null
  } catch {
    return null
  }
}

function saveChannel(channel: NotificationChannel | null): void {
  try {
    if (channel) window.localStorage.setItem(CHANNEL_STORAGE_KEY, JSON.stringify(channel))
    else window.localStorage.removeItem(CHANNEL_STORAGE_KEY)
  } catch {
    // 저장 실패는 조용히 무시 — 이번 방문 동안은 메모리 상태로 동작한다.
  }
}

function keyHeader(accessKey: string) {
  return { 'x-notification-key': accessKey }
}

export function useNotificationChannel() {
  const [channel, setChannel] = useState<NotificationChannel | null>(loadChannel)
  const queryClient = useQueryClient()

  const update = useCallback((next: NotificationChannel | null) => {
    saveChannel(next)
    setChannel(next)
  }, [])

  const register = useMutation({
    mutationFn: async (webhookUrl: string) => {
      const { data, error } = await apiClient.POST('/api/v1/notifications/channels', {
        body: { webhook_url: webhookUrl },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) =>
      update({ accessKey: data.access_key, webhookUrlMasked: data.webhook_url_masked }),
  })

  const unregister = useMutation({
    mutationFn: async (accessKey: string) => {
      const { error } = await apiClient.DELETE('/api/v1/notifications/channels/me', {
        params: { header: keyHeader(accessKey) },
      })
      if (error) throw error
    },
    onSuccess: () => {
      update(null)
      queryClient.removeQueries({ queryKey: ['notification-targets'] })
    },
  })

  /** 이 브라우저에서만 잊는다 — 서버의 등록은 그대로 남는다. */
  const forget = useCallback(() => update(null), [update])

  return { channel, register, unregister, forget }
}

function targetsKey(accessKey: string) {
  return ['notification-targets', accessKey]
}

export function useNotificationTargets(accessKey: string | null) {
  return useQuery({
    queryKey: targetsKey(accessKey ?? ''),
    enabled: !!accessKey,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/notifications/targets', {
        params: { header: keyHeader(accessKey ?? '') },
      })
      if (error) throw error
      return data.targets
    },
  })
}

export function useAddNotificationTarget(accessKey: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { item_type: NotificationItemType; character_name: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/notifications/targets', {
        params: { header: keyHeader(accessKey ?? '') },
        body: payload,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: targetsKey(accessKey ?? '') }),
  })
}

export function useRemoveNotificationTarget(accessKey: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (targetId: number) => {
      const { error } = await apiClient.DELETE('/api/v1/notifications/targets/{target_id}', {
        params: { path: { target_id: targetId }, header: keyHeader(accessKey ?? '') },
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: targetsKey(accessKey ?? '') }),
  })
}

/** 검사는 넥슨을 실제로 조회하는 무거운 동작이라 자동으로 돌리지 않고
 * 버튼으로만 실행한다. `send`가 true면 등록한 디스코드 웹훅으로도 나간다. */
export function useRunNotificationCheck(accessKey: string | null) {
  return useMutation({
    mutationFn: async (send: boolean) => {
      const { data, error } = await apiClient.POST('/api/v1/notifications/check', {
        params: { query: { send }, header: keyHeader(accessKey ?? '') },
      })
      if (error) throw error
      return data
    },
  })
}
