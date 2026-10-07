/** ② 장비 변경 비교 — 두 시점의 `character/item-equipment`를 맞대본다.
 *
 * 슬롯끼리 그냥 비교하면 **반지 순서만 바꿔 껴도 변경 4건**으로 잡힌다.
 * 응답에 `item_equipment_part`(부위, "반지")와 `item_equipment_slot`
 * (슬롯, "반지3")이 따로 있으므로, **부위로 묶은 뒤 그 안에서 짝을 짓는다.**
 *
 * 실측(2026-09-26)에서 부위 하나에 슬롯이 여럿인 건 `반지`(반지1~4 +
 * 예비 특수 반지)와 `펜던트`(펜던트, 펜던트2)였다.
 */

/** 넥슨 응답의 장비 한 칸. 필요한 필드만 추린다. */
export interface EquipmentItem {
  item_equipment_part: string
  item_equipment_slot: string
  item_name: string
  item_icon?: string | null
  starforce?: string | null
  starforce_scroll_flag?: string | null
  scroll_upgrade?: string | null
  scroll_resilience_count?: string | null
  golden_hammer_flag?: string | null
  potential_option_grade?: string | null
  potential_option_1?: string | null
  potential_option_2?: string | null
  potential_option_3?: string | null
  additional_potential_option_grade?: string | null
  additional_potential_option_1?: string | null
  additional_potential_option_2?: string | null
  additional_potential_option_3?: string | null
  item_add_option?: Record<string, string> | null
  soul_name?: string | null
  soul_option?: string | null
  special_ring_level?: number | null
  equipment_level_increase?: number | null
  growth_level?: number | null
}

export interface FieldChange {
  label: string
  before: string
  after: string
}

export type SlotChangeKind =
  /** 같은 아이템인데 강화·잠재 등이 바뀌었다. */
  | 'changed'
  /** 아이템 자체가 바뀌었다. */
  | 'replaced'
  /** 없던 부위에 새로 착용했다. */
  | 'equipped'
  /** 끼고 있던 것을 벗었다. */
  | 'removed'

export interface SlotDiff {
  part: string
  slot: string
  kind: SlotChangeKind
  beforeName: string | null
  afterName: string | null
  /** 교체는 둘 다 보여줘야 뭘 빼고 뭘 꼈는지 한눈에 보인다. */
  beforeIcon: string | null
  afterIcon: string | null
  /** `replaced`/`equipped`/`removed`일 때는 비운다 — 아이템이 통째로 달라졌으니
   * 하위 필드를 나열해봐야 잡음이다. */
  changes: FieldChange[]
  /** 무엇이 바뀌었는지 한 줄 요약. **아이템명은 넣지 않는다** — 이름은
   * `beforeName`/`afterName`으로 따로 주고 화면이 항상 보여준다. */
  summary: string
}

function text(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '없음'
  return String(value)
}

/** 추가옵션 객체에서 0이 아닌 항목만 읽기 좋게. */
function formatAddOption(option: Record<string, string> | null | undefined): string {
  if (!option) return '없음'
  const parts = Object.entries(option)
    .filter(([, v]) => v !== '0' && v !== '' && v !== null)
    .map(([k, v]) => `${k} ${v}`)
  return parts.length > 0 ? parts.join(', ') : '없음'
}

function potentialText(
  grade: string | null | undefined,
  lines: (string | null | undefined)[],
): string {
  const options = lines.filter((line): line is string => Boolean(line))
  if (!grade && options.length === 0) return '없음'
  return `${grade ?? '등급 없음'} / ${options.length > 0 ? options.join(' · ') : '옵션 없음'}`
}

/** 같은 아이템 안에서 바뀐 값들. */
function fieldChanges(before: EquipmentItem, after: EquipmentItem): FieldChange[] {
  const changes: FieldChange[] = []
  function push(label: string, b: string, a: string) {
    if (b !== a) changes.push({ label, before: b, after: a })
  }

  push('스타포스', text(before.starforce), text(after.starforce))
  push('스타포스 주문서', text(before.starforce_scroll_flag), text(after.starforce_scroll_flag))
  push('주문서 강화', text(before.scroll_upgrade), text(after.scroll_upgrade))
  push('복구 가능 횟수', text(before.scroll_resilience_count), text(after.scroll_resilience_count))
  push('황금망치', text(before.golden_hammer_flag), text(after.golden_hammer_flag))
  push(
    '잠재능력',
    potentialText(before.potential_option_grade, [
      before.potential_option_1,
      before.potential_option_2,
      before.potential_option_3,
    ]),
    potentialText(after.potential_option_grade, [
      after.potential_option_1,
      after.potential_option_2,
      after.potential_option_3,
    ]),
  )
  push(
    '에디셔널 잠재능력',
    potentialText(before.additional_potential_option_grade, [
      before.additional_potential_option_1,
      before.additional_potential_option_2,
      before.additional_potential_option_3,
    ]),
    potentialText(after.additional_potential_option_grade, [
      after.additional_potential_option_1,
      after.additional_potential_option_2,
      after.additional_potential_option_3,
    ]),
  )
  push('추가옵션', formatAddOption(before.item_add_option), formatAddOption(after.item_add_option))
  push('소울', text(before.soul_name), text(after.soul_name))
  push('소울 옵션', text(before.soul_option), text(after.soul_option))
  push('특수 반지 레벨', text(before.special_ring_level), text(after.special_ring_level))
  push('착용 레벨 감소', text(before.equipment_level_increase), text(after.equipment_level_increase))
  push('성장 레벨', text(before.growth_level), text(after.growth_level))

  return changes
}

/** 이름이 같은 아이템이 한 부위에 둘 이상일 때 쓰는 2차 지문.
 * 시스템상 드물지만(사용자 확인) 0은 아니라 대비해둔다. */
function fingerprint(item: EquipmentItem): string {
  return [
    item.starforce ?? '',
    item.scroll_upgrade ?? '',
    item.potential_option_grade ?? '',
    item.potential_option_1 ?? '',
    item.additional_potential_option_grade ?? '',
  ].join('|')
}

/** 무엇이 바뀌었는지만 말한다. 아이템명은 화면이 항상 따로 보여주므로 여기
 * 넣으면 한 줄에 같은 이름이 두 번 나온다. */
function summarize(diff: Omit<SlotDiff, 'summary'>): string {
  if (diff.kind !== 'changed') return ''
  const labels = diff.changes.map((c) => c.label)
  if (labels.length === 0) return '변경 없음'
  const head = labels.slice(0, 2).join(' · ')
  return labels.length > 2 ? `${head} 외 ${labels.length - 2}건` : head
}

/** 한 부위 안에서 before/after 아이템을 1:1로 짝짓는다.
 *
 * 1. **아이템명**이 같은 것끼리 먼저 붙인다. 같은 부위에 같은 이름을 두 개
 *    끼는 경우는 시스템상 거의 없어서(사용자 확인) 이것만으로 대부분 붙는다.
 * 2. 이름이 겹쳐 남은 것만 강화·잠재 지문으로 2차 매칭.
 * 3. 그래도 남으면 착용/해제다. */
function pairWithinPart(
  before: EquipmentItem[],
  after: EquipmentItem[],
): { before: EquipmentItem | null; after: EquipmentItem | null }[] {
  const pairs: { before: EquipmentItem | null; after: EquipmentItem | null }[] = []
  const remainingBefore = [...before]
  const remainingAfter = [...after]

  for (const matcher of [
    (b: EquipmentItem, a: EquipmentItem) => b.item_name === a.item_name,
    (b: EquipmentItem, a: EquipmentItem) => fingerprint(b) === fingerprint(a),
  ]) {
    for (let i = remainingBefore.length - 1; i >= 0; i--) {
      const index = remainingAfter.findIndex((a) => matcher(remainingBefore[i], a))
      if (index === -1) continue
      pairs.push({ before: remainingBefore[i], after: remainingAfter[index] })
      remainingBefore.splice(i, 1)
      remainingAfter.splice(index, 1)
    }
  }

  // 슬롯이 같은 것끼리 남은 것을 붙이면 "교체"로 읽힌다. 그래야 한 부위에서
  // 하나 벗고 하나 낀 걸 "해제 + 착용" 두 줄로 흩지 않는다.
  for (let i = remainingBefore.length - 1; i >= 0; i--) {
    const index = remainingAfter.findIndex(
      (a) => a.item_equipment_slot === remainingBefore[i].item_equipment_slot,
    )
    if (index === -1) continue
    pairs.push({ before: remainingBefore[i], after: remainingAfter[index] })
    remainingBefore.splice(i, 1)
    remainingAfter.splice(index, 1)
  }
  // 슬롯도 안 맞으면 남은 것끼리 순서대로 붙인다.
  while (remainingBefore.length > 0 && remainingAfter.length > 0) {
    pairs.push({ before: remainingBefore.shift()!, after: remainingAfter.shift()! })
  }
  for (const item of remainingBefore) pairs.push({ before: item, after: null })
  for (const item of remainingAfter) pairs.push({ before: null, after: item })

  return pairs
}

/** 변경된 것만 돌려준다. 안 바뀐 부위는 보여줄 게 없다. */
export function diffEquipment(before: EquipmentItem[], after: EquipmentItem[]): SlotDiff[] {
  const parts = new Set([
    ...before.map((item) => item.item_equipment_part),
    ...after.map((item) => item.item_equipment_part),
  ])

  const diffs: SlotDiff[] = []
  for (const part of parts) {
    const pairs = pairWithinPart(
      before.filter((item) => item.item_equipment_part === part),
      after.filter((item) => item.item_equipment_part === part),
    )
    for (const { before: b, after: a } of pairs) {
      if (b && a) {
        if (b.item_name !== a.item_name) {
          const base = {
            part,
            slot: a.item_equipment_slot,
            kind: 'replaced' as const,
            beforeName: b.item_name,
            afterName: a.item_name,
            beforeIcon: b.item_icon ?? null,
            afterIcon: a.item_icon ?? null,
            changes: [],
          }
          diffs.push({ ...base, summary: summarize(base) })
          continue
        }
        const changes = fieldChanges(b, a)
        if (changes.length === 0) continue
        const base = {
          part,
          slot: a.item_equipment_slot,
          kind: 'changed' as const,
          beforeName: b.item_name,
          afterName: a.item_name,
          beforeIcon: b.item_icon ?? null,
          afterIcon: a.item_icon ?? null,
          changes,
        }
        diffs.push({ ...base, summary: summarize(base) })
      } else if (a) {
        const base = {
          part,
          slot: a.item_equipment_slot,
          kind: 'equipped' as const,
          beforeName: null,
          afterName: a.item_name,
          beforeIcon: null,
          afterIcon: a.item_icon ?? null,
          changes: [],
        }
        diffs.push({ ...base, summary: summarize(base) })
      } else if (b) {
        const base = {
          part,
          slot: b.item_equipment_slot,
          kind: 'removed' as const,
          beforeName: b.item_name,
          afterName: null,
          beforeIcon: b.item_icon ?? null,
          afterIcon: null,
          changes: [],
        }
        diffs.push({ ...base, summary: summarize(base) })
      }
    }
  }

  return diffs.sort((x, y) => x.slot.localeCompare(y.slot))
}
