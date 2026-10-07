/** 넥슨 API 키를 화면에서 다루는 공용 훅.
 *
 * 길드 관리와 확률 정보가 **서로 다른 저장 칸**을 쓴다(운영진 키와 개인 조회
 * 키를 분리해 쓸 수 있게). 동작은 같으므로 칸 이름만 달리 받는다.
 *
 * 기본은 이번 탭에만 남기고, 사용자가 직접 고를 때만 이 컴퓨터에 저장한다 —
 * 근거는 `lib/api-key-storage.ts`에 있다.
 */
import { useCallback, useState } from 'react'

import {
  forgetKey,
  hasRememberedKey,
  rememberKey,
  readApiKey,
  writeSessionKey,
} from '@/lib/api-key-storage'

export function useStoredApiKey(storageKey: string) {
  const [apiKey, setApiKeyState] = useState(() => readApiKey(storageKey))
  const [remembered, setRemembered] = useState(() => hasRememberedKey(storageKey))

  const setApiKey = useCallback(
    (value: string) => {
      setApiKeyState(value)
      writeSessionKey(storageKey, value)
      // 키를 비우면 저장해둔 것도 같이 사라진다(`writeSessionKey` 참고).
      if (!value) setRemembered(false)
    },
    [storageKey],
  )

  const clearApiKey = useCallback(() => setApiKey(''), [setApiKey])

  /** 이 컴퓨터에 남긴다. 되묻기는 화면이 먼저 한다. */
  const remember = useCallback(() => {
    if (!apiKey) return
    rememberKey(storageKey, apiKey)
    setRemembered(true)
  }, [apiKey, storageKey])

  /** 저장해둔 것만 지운다. 이번 세션은 그대로 쓴다. */
  const forget = useCallback(() => {
    forgetKey(storageKey)
    setRemembered(false)
  }, [storageKey])

  return { apiKey, setApiKey, clearApiKey, remembered, remember, forget }
}
