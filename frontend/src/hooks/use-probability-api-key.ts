import { useStoredApiKey } from '@/hooks/use-stored-api-key'

const STORAGE_KEY = 'nexon-api-key'

export function useProbabilityApiKey() {
  return useStoredApiKey(STORAGE_KEY)
}
