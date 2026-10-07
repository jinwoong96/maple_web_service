import { getYesterdayKstDateString } from '@/lib/kst-date'

/** 넥슨이 길드/캐릭터 과거 조회를 제공하는 가장 이른 날짜. 이보다 이전을
 * 넘기면 400이다. 달력에서 아예 못 고르게 막고 안내 문구를 붙인다 — 400을
 * 맞고 알려주는 것보다 고르기 전에 막는 쪽이 낫다. */
export const EARLIEST_QUERYABLE_DATE = '2023-12-21'

/** 경험치 요구량이 바뀐 패치일. ②(성장 추적)에서 이 날짜를 걸치는 비교
 * 구간에 경고를 띄우는 데 쓴다. ①에서는 쓰지 않지만 날짜 상수를 한곳에
 * 모아둔다. */
export const EXP_TABLE_PATCH_DATE = '2026-03-19'

export interface DateRangePreset {
  value: string
  label: string
  days: number
}

/** 기준일은 **어제**다. 넥슨의 일일 스냅샷은 당일 데이터가 늦게 올라와서,
 * "오늘"을 기준으로 잡으면 날에 따라 빈 응답이 온다. */
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { value: '1d', label: '하루', days: 1 },
  { value: '7d', label: '일주일', days: 7 },
  { value: '30d', label: '1개월', days: 30 },
  { value: '90d', label: '3개월', days: 90 },
]

function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() - days)
  return shifted.toISOString().slice(0, 10)
}

export interface DateRange {
  oldDate: string
  newDate: string
}

/** 프리셋을 실제 날짜 두 개로 바꾼다. 하한을 넘어가면 하한으로 자른다. */
export function resolvePreset(days: number): DateRange {
  const newDate = getYesterdayKstDateString()
  const oldDate = shiftDays(newDate, days)
  return {
    oldDate: oldDate < EARLIEST_QUERYABLE_DATE ? EARLIEST_QUERYABLE_DATE : oldDate,
    newDate,
  }
}

export function isQueryableDate(date: string): boolean {
  return date >= EARLIEST_QUERYABLE_DATE && date <= getYesterdayKstDateString()
}
