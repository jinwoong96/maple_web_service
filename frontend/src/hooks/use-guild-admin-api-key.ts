import { useStoredApiKey } from '@/hooks/use-stored-api-key'

/** 확률 정보 탭(`use-probability-api-key.ts`)의 `nexon-api-key`와 **일부러
 * 다른 칸**을 쓴다. 두 탭을 동시에 쓰라고 만든 기능이 아니라서, 따로 넣게
 * 해도 불편이 작다고 판단했다(사용자 결정, 2026-09-25). 대신 운영진 키와
 * 개인 조회 키를 분리해 쓸 수 있다. */
const STORAGE_KEY = 'guild-admin-nexon-api-key'

export function useGuildAdminApiKey() {
  return useStoredApiKey(STORAGE_KEY)
}
