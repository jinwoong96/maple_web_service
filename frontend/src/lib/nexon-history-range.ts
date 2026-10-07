import { nexonDirectGet } from '@/lib/nexon-direct-client'

/** How many dates to fetch in parallel via the work-stealing pool below.
 * Kept at/under `nexon-direct-client.ts`'s `BURST_CAPACITY` so the
 * concurrency pool — not the rate limiter — is the steady-state
 * bottleneck; see that file's comment for why the rate target itself was
 * pulled back to 200/s after real 429s were seen at a higher cap. */
export const DATE_FETCH_CONCURRENCY = 20

const MAX_PAGES_PER_DATE = 50

/** Nexon history endpoints' `date` selects a single calendar day; `cursor`
 * only continues *within* that day (confirmed live — never seen a cursor
 * chain cross into an earlier date). So getting more than one day's worth
 * of history means one request per day, not one growing cursor chain. */
export async function fetchOneDateAllPages<TPage, TEntry>(
  path: string,
  apiKey: string,
  date: string,
  getEntries: (page: TPage) => TEntry[],
  getNextCursor: (page: TPage) => string | null,
): Promise<TEntry[]> {
  const entries: TEntry[] = []
  let cursor: string | null = null
  for (let i = 0; i < MAX_PAGES_PER_DATE; i++) {
    const params = cursor ? { cursor, count: 1000 } : { date, count: 1000 }
    const page = await nexonDirectGet<TPage>(path, apiKey, params)
    entries.push(...getEntries(page))
    const next = getNextCursor(page)
    if (!next) break
    cursor = next
  }
  return entries
}

/** Every date from `newestDate` back through `oldestDate` inclusive
 * (newest first) — order-normalized, so it doesn't matter which of the two
 * args is actually later. */
export function generateDateRange(newestDate: string, oldestDate: string): string[] {
  let start = new Date(`${newestDate}T00:00:00Z`)
  let end = new Date(`${oldestDate}T00:00:00Z`)
  if (start < end) [start, end] = [end, start]

  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor >= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return dates
}

export interface DateFetchFailure {
  date: string
  message: string
}

export interface DatesConcurrentlyResult<TEntry> {
  results: TEntry[][]
  /** One date's request(s) failing (a 429 that outlasted
   * `nexonDirectGet`'s own retries, a boundary date just past Nexon's ~2yr
   * retention, or anything else) no longer aborts the whole sweep — it's
   * recorded here and that date just contributes no entries. Surfaced to
   * the UI rather than silently dropped, since a failure means the result
   * is an undercount, not a real zero. */
  failures: DateFetchFailure[]
}

/** Fetches `dates` (each internally paginated via `fetchOneDateAllPages`)
 * with up to `DATE_FETCH_CONCURRENCY` requests in flight via a
 * work-stealing pool (each worker grabs the next unstarted date as soon as
 * it finishes its own) rather than fixed-size `Promise.all` chunks — keeps
 * every slot busy even when some dates take much longer than others (a
 * date with >1000 entries needs extra within-date pages). Returns entries
 * in the same order as `dates`; `onDateDone` (optional) fires once per
 * date as it completes (success or failure), for progress reporting. */
export async function fetchDatesConcurrently<TPage, TEntry>(
  path: string,
  apiKey: string,
  dates: string[],
  getEntries: (page: TPage) => TEntry[],
  getNextCursor: (page: TPage) => string | null,
  onDateDone?: (entries: TEntry[], datesDoneSoFar: number, failure: DateFetchFailure | null) => void,
): Promise<DatesConcurrentlyResult<TEntry>> {
  const results: TEntry[][] = new Array(dates.length)
  const failures: DateFetchFailure[] = []
  let nextIndex = 0
  let doneCount = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= dates.length) return

      let entries: TEntry[] = []
      let failure: DateFetchFailure | null = null
      try {
        entries = await fetchOneDateAllPages<TPage, TEntry>(
          path,
          apiKey,
          dates[index],
          getEntries,
          getNextCursor,
        )
      } catch (err) {
        failure = { date: dates[index], message: err instanceof Error ? err.message : String(err) }
        failures.push(failure)
      }

      results[index] = entries
      doneCount += 1
      onDateDone?.(entries, doneCount, failure)
    }
  }

  const workerCount = Math.min(DATE_FETCH_CONCURRENCY, dates.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return { results, failures }
}

export interface DateRangeHistoryResult<TEntry> {
  entries: TEntry[]
  failures: DateFetchFailure[]
}

/** Eagerly fetches an entire `[oldestDate, newestDate]` range — every date,
 * fully paginated, all at once (concurrency-limited via
 * `fetchDatesConcurrently`). For "모아보기", which wants a real total, not
 * a partial one; individual tabs fetch smaller batches of dates instead
 * (see `hooks/use-probability.ts`) so opening a tab doesn't always trigger
 * a full 2-year sweep. */
export async function fetchDateRangeHistory<TPage, TEntry>(
  path: string,
  apiKey: string,
  newestDate: string,
  oldestDate: string,
  getEntries: (page: TPage) => TEntry[],
  getNextCursor: (page: TPage) => string | null,
  onProgress: (datesFetched: number, totalDates: number, entriesSoFar: number) => void,
): Promise<DateRangeHistoryResult<TEntry>> {
  const dates = generateDateRange(newestDate, oldestDate)
  const all: TEntry[] = []

  const { results, failures } = await fetchDatesConcurrently(
    path,
    apiKey,
    dates,
    getEntries,
    getNextCursor,
    (entries, doneCount) => {
      all.push(...entries)
      onProgress(doneCount, dates.length, all.length)
    },
  )
  return { entries: results.flat(), failures }
}
