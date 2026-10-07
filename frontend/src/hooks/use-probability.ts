import { useInfiniteQuery } from '@tanstack/react-query'

import {
  DATE_FETCH_CONCURRENCY,
  type DateFetchFailure,
  fetchDatesConcurrently,
  generateDateRange,
} from '@/lib/nexon-history-range'
import type { CubeHistory, PotentialHistory, StarforceHistory } from '@/lib/nexon-probability-types'

// A "page" here isn't one network response — it's however many dates it
// took (fetched `DATE_FETCH_CONCURRENCY` at a time) to accumulate at least
// this many entries, or the whole range if it runs out first. Keeps the
// existing "20ish per 더 보기 click" feel even though the underlying fetch
// is now a multi-date parallel sweep, not single-date cursor pagination.
const MIN_ENTRIES_PER_PAGE = 20

interface HistoryRangeArgs {
  apiKey: string
  startDate: string
  endDate: string
}

interface HistoryPage<TEntry> {
  entries: TEntry[]
  nextDateIndex: number
  /** Dates within this page's sweep that failed (429 outlasting retries, a
   * boundary date past Nexon's retention, etc.) — a failure means this
   * page's `entries` may be an undercount for the dates it covered, not
   * that the sweep stopped. Surfaced so the UI doesn't present a
   * silently-partial result as complete. */
  failures: DateFetchFailure[]
}

/** Nexon's `date` selects one calendar day and `cursor` only continues
 * *within* that day (see `lib/nexon-history-range.ts`), so a date range is
 * one request per day, not a single growing cursor chain. `pageParam` is
 * an index into the precomputed date list (newest-first) rather than a
 * cursor string — each "page" sweeps `DATE_FETCH_CONCURRENCY` dates at a
 * time (work-stealing pool) until it collects `MIN_ENTRIES_PER_PAGE`
 * entries or the date list runs out. */
function useDateRangeHistory<TPage, TEntry>(
  categoryKey: string,
  path: string,
  { apiKey, startDate, endDate }: HistoryRangeArgs,
  getEntries: (page: TPage) => TEntry[],
  getNextCursor: (page: TPage) => string | null,
) {
  const dates = generateDateRange(startDate, endDate)

  return useInfiniteQuery({
    queryKey: ['probability', categoryKey, apiKey, startDate, endDate],
    queryFn: async ({ pageParam }: { pageParam: number }): Promise<HistoryPage<TEntry>> => {
      const collected: TEntry[] = []
      const failures: DateFetchFailure[] = []
      let index = pageParam
      while (index < dates.length) {
        const batch = dates.slice(index, index + DATE_FETCH_CONCURRENCY)
        const { results, failures: batchFailures } = await fetchDatesConcurrently<TPage, TEntry>(
          path,
          apiKey,
          batch,
          getEntries,
          getNextCursor,
        )
        collected.push(...results.flat())
        failures.push(...batchFailures)
        index += batch.length
        if (collected.length >= MIN_ENTRIES_PER_PAGE) break
      }
      return { entries: collected, nextDateIndex: index, failures }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.nextDateIndex < dates.length ? lastPage.nextDateIndex : undefined),
    enabled: Boolean(apiKey) && dates.length > 0,
    retry: false,
  })
}

export function useStarforceHistory(args: HistoryRangeArgs) {
  return useDateRangeHistory<StarforceHistory, StarforceHistory['starforce_history'][number]>(
    'starforce',
    '/maplestory/v1/history/starforce',
    args,
    (page) => page.starforce_history,
    (page) => page.next_cursor,
  )
}

export function usePotentialHistory(args: HistoryRangeArgs) {
  return useDateRangeHistory<PotentialHistory, PotentialHistory['potential_history'][number]>(
    'potential',
    '/maplestory/v1/history/potential',
    args,
    (page) => page.potential_history,
    (page) => page.next_cursor,
  )
}

export function useCubeHistory(args: HistoryRangeArgs) {
  return useDateRangeHistory<CubeHistory, CubeHistory['cube_history'][number]>(
    'cube',
    '/maplestory/v1/history/cube',
    args,
    (page) => page.cube_history,
    (page) => page.next_cursor,
  )
}
