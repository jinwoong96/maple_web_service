/** `초` → `M:SS`. `dojang_time_record`/`theseed_time_record` aren't
 * documented as seconds anywhere, but the raw values (557, 2313, ...) only
 * make sense as seconds for these timed challenges — flagged as an
 * inferred format in REVIEW_NOTES.md, not confirmed against an in-game
 * screenshot. */
export function formatTimeRecord(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

const TIMESTAMP_PATTERN = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** `date_create`-style ISO datetime (with a `+09:00` offset already baked
 * in by Nexon) -> `MM/DD HH:mm`. Regex, not `Date`, to sidestep the
 * browser's own timezone — same approach as `equipment-tooltip.tsx`'s
 * `formatExpiry`, just compact since this renders once per history row
 * (dozens per page) rather than once per detail modal. */
export function formatHistoryTimestamp(isoDateTime: string | null | undefined): string | null {
  if (!isoDateTime) return null
  const match = TIMESTAMP_PATTERN.exec(isoDateTime)
  if (!match) return isoDateTime
  const [, month, day, hour, minute] = match
  return `${month}/${day} ${hour}:${minute}`
}
