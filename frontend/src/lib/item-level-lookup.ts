import { apiClient } from '@/lib/api-client'

export interface ItemLevelInfo {
  level: number
  icon: string | null
}

/** Looks up item required-levels (and icons) from **our own backend** (not
 * Nexon) — `item_level_reference` is a small shared reference table crawled
 * ahead of time (see `backend/scripts/crawl_item_levels.py`), not personal
 * account data, so routing this through our backend is fine even though the
 * rest of the Probability domain deliberately bypasses it (see
 * docs/planning/features/probability.md's "모아보기" section). */
export async function lookupItemLevels(itemNames: string[]): Promise<Map<string, ItemLevelInfo>> {
  const uniqueNames = Array.from(new Set(itemNames))
  if (uniqueNames.length === 0) return new Map()

  const { data, error } = await apiClient.GET('/api/v1/item-levels', {
    params: { query: { names: uniqueNames } },
  })
  if (error) throw error

  return new Map(
    data.items.map((item) => [item.item_name, { level: item.base_equipment_level, icon: item.item_icon ?? null }]),
  )
}
