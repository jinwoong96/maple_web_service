import { EquipmentItemTooltip, SimpleDetailTooltip } from '@/components/character/equipment-tooltip'
import { ItemCard, ItemCardGrid } from '@/components/character/item-card'
import { SetEffectList } from '@/components/character/set-effect-list'
import { SymbolList } from '@/components/character/symbol-list'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCharacterAndroidEquipment,
  useCharacterItemEquipment,
  useCharacterRingSkillEquipment,
  useCharacterSetEffect,
  useCharacterSymbolEquipment,
} from '@/hooks/use-character'
import type { components } from '@/lib/api-types'

type ItemEquipmentPiece = components['schemas']['ItemEquipmentPiece']
type RingSkillEquipment =
  | components['schemas']['RingExchangeSkillEquipment']
  | components['schemas']['RingReserveSkillEquipment']

interface RingSkillInfo {
  name: string
  level: number | null | undefined
  icon: string | null | undefined
  description: string | null | undefined
}

/** `RingExchangeSkillEquipment`/`RingReserveSkillEquipment` differ only in
 * field prefix; both carry a permissive index signature that defeats clean
 * `in`-narrowing, so read through a plain record instead — confirmed
 * against real API responses (see docs/planning/features/character.md's
 * "장비 tab"). */
function getRingSkillInfo(data: RingSkillEquipment | undefined): RingSkillInfo | null {
  if (!data) return null
  const record = data as Record<string, unknown>
  const name = (record.special_ring_exchange_name ?? record.special_ring_reserve_name) as
    | string
    | null
    | undefined
  if (!name) return null
  return {
    name,
    level: (record.special_ring_exchange_level ?? record.special_ring_reserve_level) as
      | number
      | null
      | undefined,
    icon: (record.special_ring_exchange_icon ?? record.special_ring_reserve_icon) as
      | string
      | null
      | undefined,
    description: (record.special_ring_exchange_description ??
      record.special_ring_reserve_description) as string | null | undefined,
  }
}

// 방어구류/장신구류 slot names, confirmed from a real item-equipment pull —
// see docs/planning/features/character.md's "장비 tab" grouping. Anything
// in item_equipment[] that isn't one of these is 무기류 (the catch-all),
// including class-specific weapon-slot names like 메카닉's 매그넘/건.
const ARMOR_PARTS = new Set(['모자', '상의', '하의', '장갑', '망토', '신발', '어깨장식'])
const ACCESSORY_PARTS = new Set([
  '얼굴장식',
  '눈장식',
  '펜던트',
  '벨트',
  '포켓 아이템',
  '기계 심장',
  '뱃지',
  '귀고리',
  '반지',
  '훈장',
])

interface EquipmentClusters {
  weapon: ItemEquipmentPiece[]
  armor: ItemEquipmentPiece[]
  accessory: ItemEquipmentPiece[]
  special: ItemEquipmentPiece[]
}

function groupEquipment(
  itemEquipment: ItemEquipmentPiece[],
  mechanicEquipment: ItemEquipmentPiece[],
  dragonEquipment: ItemEquipmentPiece[],
): EquipmentClusters {
  const clusters: EquipmentClusters = { weapon: [], armor: [], accessory: [], special: [] }
  for (const piece of itemEquipment) {
    if (ARMOR_PARTS.has(piece.item_equipment_part)) {
      clusters.armor.push(piece)
    } else if (ACCESSORY_PARTS.has(piece.item_equipment_part)) {
      clusters.accessory.push(piece)
    } else {
      clusters.weapon.push(piece)
    }
  }
  clusters.special = [...mechanicEquipment, ...dragonEquipment]
  return clusters
}

function EquipmentCluster({ title, items }: { title: string; items: ItemEquipmentPiece[] }) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <ItemCardGrid>
        {items.map((item) => (
          <EquipmentItemTooltip key={item.item_equipment_slot} item={item}>
            <ItemCard
              iconUrl={item.item_icon}
              name={item.item_name}
              part={item.item_equipment_part}
              grade={item.potential_option_grade}
              starforce={Number(item.starforce ?? 0)}
              potentialGrade={item.potential_option_grade}
              additionalPotentialGrade={item.additional_potential_option_grade}
              hasExceptional={Boolean(item.item_exceptional_option?.exceptional_upgrade)}
            />
          </EquipmentItemTooltip>
        ))}
      </ItemCardGrid>
    </div>
  )
}

interface EquipmentTabProps {
  ocid: string | undefined
}

export function EquipmentTab({ ocid }: EquipmentTabProps) {
  const itemEquipmentQuery = useCharacterItemEquipment(ocid)
  const ringSkillQuery = useCharacterRingSkillEquipment(ocid)
  const androidQuery = useCharacterAndroidEquipment(ocid)
  const symbolQuery = useCharacterSymbolEquipment(ocid)
  const setEffectQuery = useCharacterSetEffect(ocid)

  if (itemEquipmentQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (itemEquipmentQuery.isError || !itemEquipmentQuery.data) {
    return <p className="pt-4 text-sm text-muted-foreground">장비 정보를 불러오지 못했습니다.</p>
  }

  const { title, medal_shape, item_equipment, mechanic_equipment, dragon_equipment } =
    itemEquipmentQuery.data
  const clusters = groupEquipment(
    item_equipment ?? [],
    mechanic_equipment ?? [],
    dragon_equipment ?? [],
  )

  const ringSkill = getRingSkillInfo(ringSkillQuery.data)

  return (
    <div className="flex flex-col gap-4 pt-4">
      {(title || medal_shape) && (
        <div className="flex flex-wrap gap-6 rounded-lg border p-4">
          {title?.title_name && (
            <SimpleDetailTooltip
              title={title.title_name}
              iconUrl={title.title_icon}
              name={title.title_name}
              description={title.title_description}
            >
              <button type="button" className="flex cursor-pointer items-center gap-2.5 text-left">
                {title.title_icon && (
                  <img src={title.title_icon} alt={title.title_name} className="h-9 w-9" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground">칭호</p>
                  <p className="text-sm font-medium">{title.title_name}</p>
                </div>
              </button>
            </SimpleDetailTooltip>
          )}
          {medal_shape?.medal_shape_name && (
            <SimpleDetailTooltip
              title={medal_shape.medal_shape_name}
              iconUrl={medal_shape.medal_shape_icon}
              name={medal_shape.medal_shape_name}
              description={medal_shape.medal_shape_description}
            >
              <button type="button" className="flex cursor-pointer items-center gap-2.5 text-left">
                {medal_shape.medal_shape_icon && (
                  <img
                    src={medal_shape.medal_shape_icon}
                    alt={medal_shape.medal_shape_name}
                    className="h-9 w-9"
                  />
                )}
                <div>
                  <p className="text-xs text-muted-foreground">훈장</p>
                  <p className="text-sm font-medium">{medal_shape.medal_shape_name}</p>
                </div>
              </button>
            </SimpleDetailTooltip>
          )}
        </div>
      )}

      <EquipmentCluster title="무기류" items={clusters.weapon} />
      <EquipmentCluster title="방어구류" items={clusters.armor} />
      <EquipmentCluster title="장신구류" items={clusters.accessory} />
      <EquipmentCluster title="특수장비류" items={clusters.special} />

      {symbolQuery.data && symbolQuery.data.symbol && symbolQuery.data.symbol.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">심볼</p>
          <SymbolList symbols={symbolQuery.data.symbol} />
        </div>
      )}

      {setEffectQuery.data?.set_effect && setEffectQuery.data.set_effect.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">세트 효과</p>
          <SetEffectList sets={setEffectQuery.data.set_effect} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">반지 스킬</p>
          {ringSkill ? (
            <SimpleDetailTooltip
              title={ringSkill.name}
              iconUrl={ringSkill.icon}
              name={ringSkill.name}
              subtitle={ringSkill.level != null ? `Lv.${ringSkill.level}` : undefined}
              description={ringSkill.description}
            >
              <button type="button" className="flex cursor-pointer items-center gap-2.5 text-left">
                {ringSkill.icon && (
                  <img src={ringSkill.icon} alt={ringSkill.name} className="h-9 w-9" />
                )}
                <div>
                  <p className="text-sm font-medium">{ringSkill.name}</p>
                  {ringSkill.level != null && (
                    <p className="text-xs text-muted-foreground">Lv.{ringSkill.level}</p>
                  )}
                </div>
              </button>
            </SimpleDetailTooltip>
          ) : (
            <p className="text-sm text-muted-foreground">장착한 반지 없음</p>
          )}
        </div>

        {androidQuery.data && (
          <SimpleDetailTooltip
            title={androidQuery.data.android_name}
            iconUrl={androidQuery.data.android_icon}
            name={androidQuery.data.android_name}
            subtitle={androidQuery.data.android_nickname}
            description={androidQuery.data.android_description}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-4 text-left"
            >
              {androidQuery.data.android_icon && (
                <img
                  src={androidQuery.data.android_icon}
                  alt={androidQuery.data.android_name}
                  className="h-9 w-9"
                />
              )}
              <div>
                <p className="text-xs text-muted-foreground">안드로이드</p>
                <p className="text-sm font-medium">{androidQuery.data.android_name}</p>
                {androidQuery.data.android_nickname && (
                  <p className="text-xs text-muted-foreground">
                    {androidQuery.data.android_nickname}
                  </p>
                )}
              </div>
            </button>
          </SimpleDetailTooltip>
        )}
      </div>
    </div>
  )
}
