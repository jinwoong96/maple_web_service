import { useCallback, useState } from 'react'

import { useOcidResolver } from '@/hooks/use-ocid-resolver'
import { diffEquipment, type EquipmentItem, type SlotDiff } from '@/lib/equipment-diff'
import { nexonDirectGet } from '@/lib/nexon-direct-client'

interface ItemEquipmentResponse {
  item_equipment: EquipmentItem[] | null
  preset_no?: number | null
}

export type EquipmentDiffStatus = 'idle' | 'loading' | 'done' | 'error'

export interface EquipmentDiffResult {
  diffs: SlotDiff[]
  /** 프리셋 번호. 두 시점이 다르면 장비를 바꾼 게 아니라 프리셋을 바꾼 것일
   * 수 있어 화면에서 알려준다. */
  presetBefore: number | null
  presetAfter: number | null
}

/** 캐릭터 한 명의 장비 변경을 필요할 때만 조회한다.
 *
 * 사람 → 캐릭터 → 장비 3단계로 들어가는 마지막 단계다. 그룹 전체를 한꺼번에
 * 비교하면 한 번 클릭에 6캐릭 × 2시점 = 12회를 쏘게 되고, 대부분은 볼 필요도
 * 없는 부캐다. 고른 캐릭터만 **2회**로 끝낸다. */
export function useEquipmentDiff(apiKey: string) {
  const { resolve, flush } = useOcidResolver(apiKey)
  const [status, setStatus] = useState<EquipmentDiffStatus>('idle')
  const [result, setResult] = useState<EquipmentDiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (characterName: string, oldDate: string, newDate: string) => {
      setStatus('loading')
      setError(null)
      try {
        const ocid = await resolve(characterName)
        const [before, after] = await Promise.all([
          nexonDirectGet<ItemEquipmentResponse>('/maplestory/v1/character/item-equipment', apiKey, {
            ocid,
            date: oldDate,
          }),
          nexonDirectGet<ItemEquipmentResponse>('/maplestory/v1/character/item-equipment', apiKey, {
            ocid,
            date: newDate,
          }),
        ])
        flush()
        setResult({
          diffs: diffEquipment(before.item_equipment ?? [], after.item_equipment ?? []),
          presetBefore: before.preset_no ?? null,
          presetAfter: after.preset_no ?? null,
        })
        setStatus('done')
      } catch (caught) {
        flush()
        setError(caught instanceof Error ? caught.message : String(caught))
        setStatus('error')
      }
    },
    [apiKey, resolve, flush],
  )

  return { status, result, error, run }
}
