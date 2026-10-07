import { useCallback, useRef } from 'react'

import { fetchOcid } from '@/lib/guild-admin-grouping'
import { loadOcidCache, saveOcidCache } from '@/lib/guild-admin-storage'

/** 이름 → ocid 변환을 ⓪(그룹화)과 ①(명단 변동)이 함께 쓰는 캐시 위에서 한다.
 *
 * 길드 명단은 이름만 주고 ocid 조회는 이름 1개당 1회라, 캐시가 없으면 화면을
 * 옮길 때마다 수백 번을 다시 쏜다. 반대로 매 조회마다 `localStorage`에 쓰면
 * 직렬화가 프레임을 잡아먹어서, 메모리에 들고 있다가 작업이 끝날 때
 * `flush()`로 한 번만 저장한다.
 *
 * `forceRefresh`는 **월드 리프** 때문에 필요하다. 월드를 옮기면 ocid가 바뀌어
 * 캐시해둔 값이 무효가 되는데, 이름은 그대로라 `/id`로 다시 받으면 새 ocid가
 * 나온다(실측: `초코칩` → 다른 월드). 캐시된 ocid로 조회가 실패했을 때 쓴다.
 */
export function useOcidResolver(apiKey: string) {
  const cacheRef = useRef<Record<string, string> | null>(null)
  const dirtyRef = useRef(false)
  const networkCallsRef = useRef(0)

  const getCache = useCallback(() => {
    cacheRef.current ??= loadOcidCache()
    return cacheRef.current
  }, [])

  const resolve = useCallback(
    async (characterName: string, forceRefresh = false): Promise<string> => {
      const cache = getCache()
      if (!forceRefresh) {
        const cached = cache[characterName]
        if (cached) return cached
      }
      const ocid = await fetchOcid(characterName, apiKey)
      networkCallsRef.current += 1
      cache[characterName] = ocid
      dirtyRef.current = true
      return ocid
    },
    [apiKey, getCache],
  )

  const flush = useCallback(() => {
    if (!dirtyRef.current || cacheRef.current === null) return
    saveOcidCache(cacheRef.current)
    dirtyRef.current = false
  }, [])

  /** 이번 작업에서 실제로 네트워크를 탄 ocid 조회 수. 캐시 적중은 안 센다. */
  const takeNetworkCalls = useCallback(() => {
    const count = networkCallsRef.current
    networkCallsRef.current = 0
    return count
  }, [])

  return { resolve, flush, takeNetworkCalls }
}
