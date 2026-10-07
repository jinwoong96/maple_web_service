/** Returns yesterday's date in KST as "YYYY-MM-DD". Nexon's daily ranking snapshot
 * for "today" isn't published until later in the day, so yesterday is the safest default. */
export function getYesterdayKstDateString(): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  kstNow.setUTCDate(kstNow.getUTCDate() - 1)
  return kstNow.toISOString().slice(0, 10)
}

/** Returns today's date in KST as "YYYY-MM-DD". Unlike the ranking snapshot,
 * the Probability history endpoints return live per-account data as of the
 * moment of the call, so "today" (not "yesterday") is the right default. */
export function getTodayKstDateString(): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kstNow.toISOString().slice(0, 10)
}

/** Today in KST, minus a little under 2 years, as "YYYY-MM-DD" — the
 * default floor for a "no range selected" full-history sweep in the
 * Probability domain. Pulled in 3 days short of exactly 2 years, not
 * exactly 2 years: confirmed live (2026-09-21, with `today` = 2026-09-21)
 * that Nexon's real retention cutoff is 1 day *short* of the exact
 * calendar-year mark — `date=2024-09-21` (exactly 2 years back) 400s,
 * `date=2024-09-22` succeeds. The exact day-count isn't necessarily stable
 * across leap years, so this adds 2 more days of margin on top of that
 * confirmed 1-day gap rather than hugging the precise boundary — a date
 * that's still somehow too old just shows up as one isolated, gracefully
 * handled failure (see `lib/nexon-history-range.ts`'s per-date failure
 * isolation) rather than anything breaking. */
export function getTwoYearsAgoKstDateString(): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  kstNow.setUTCFullYear(kstNow.getUTCFullYear() - 2)
  kstNow.setUTCDate(kstNow.getUTCDate() + 3)
  return kstNow.toISOString().slice(0, 10)
}
