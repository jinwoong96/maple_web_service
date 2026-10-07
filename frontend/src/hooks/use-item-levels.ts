import { useQuery } from '@tanstack/react-query'

import { type ItemLevelInfo, lookupItemLevels } from '@/lib/item-level-lookup'

/** Reference data (our own backend, not personal Nexon data), so a plain
 * `useQuery` is fine here — no per-viewer sensitivity like the rest of the
 * Probability domain. `staleTime: Infinity` since item level/icon never
 * changes within a session (a fresh crawl only ever adds/refreshes rows, it
 * doesn't need live re-fetching mid-session). */
export function useItemLevels(itemNames: string[]) {
  const sortedNames = Array.from(new Set(itemNames)).sort()
  return useQuery<Map<string, ItemLevelInfo>>({
    queryKey: ['item-levels', sortedNames],
    queryFn: () => lookupItemLevels(sortedNames),
    enabled: sortedNames.length > 0,
    staleTime: Infinity,
  })
}
