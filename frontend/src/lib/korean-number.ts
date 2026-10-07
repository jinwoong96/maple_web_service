const UNITS = ['', '만', '억', '조', '경']

/** Formats a number using Korean 4-digit grouping units (만/억/조/경). e.g. 687127826 -> "6억 8712만 7826" */
export function formatKoreanNumber(value: number): string {
  if (value === 0) return '0'

  const isNegative = value < 0
  let remaining = Math.floor(Math.abs(value))

  const groups: number[] = []
  while (remaining > 0) {
    groups.push(remaining % 10000)
    remaining = Math.floor(remaining / 10000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    parts.push(`${groups[i]}${UNITS[i]}`)
  }

  return (isNegative ? '-' : '') + parts.join(' ')
}

/** `bigint` 판. 경험치는 조 단위까지 가서 `number`로는 정밀도가 깨진다
 * (299레벨 요구치만 1,737,759,854,037,637).
 *
 * `maxParts`로 위에서 몇 덩어리만 보여줄지 정한다 — 성장량을
 * "1247억 3421만 8890" 까지 다 보여줘도 사람이 읽지 않는다. 기본 2덩어리. */
export function formatKoreanBigInt(value: bigint, maxParts = 2): string {
  if (value === 0n) return '0'

  const isNegative = value < 0n
  let remaining = isNegative ? -value : value

  const groups: bigint[] = []
  while (remaining > 0n) {
    groups.push(remaining % 10000n)
    remaining /= 10000n
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0 && parts.length < maxParts; i--) {
    if (groups[i] === 0n) continue
    parts.push(`${groups[i]}${UNITS[i] ?? ''}`)
  }

  return (isNegative ? '-' : '') + parts.join(' ')
}
