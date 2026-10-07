import {
  CashItemTooltip,
  RichDialogContent,
  SimpleDetailTooltip,
} from '@/components/character/equipment-tooltip'
import { ItemCard, ItemCardGrid } from '@/components/character/item-card'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCharacterBeautyEquipment,
  useCharacterCashitemEquipment,
  useCharacterPetEquipment,
} from '@/hooks/use-character'
import type { components } from '@/lib/api-types'

type HairStyle = components['schemas']['HairStyle']
type FaceStyle = components['schemas']['FaceStyle']
type SkinStyle = components['schemas']['SkinStyle']
type PetEquipmentItem = components['schemas']['PetEquipmentItem']

function formatHair(hair: HairStyle | null | undefined): string | null {
  if (!hair?.hair_name) return null
  if (hair.mix_color && hair.mix_rate) {
    return `${hair.hair_name} (${hair.base_color} / ${hair.mix_color} ${hair.mix_rate}%)`
  }
  return hair.hair_name
}

function formatFace(face: FaceStyle | null | undefined): string | null {
  if (!face?.face_name) return null
  if (face.mix_color && face.mix_rate) {
    return `${face.face_name} (${face.base_color} / ${face.mix_color} ${face.mix_rate}%)`
  }
  return face.face_name
}

function formatSkin(skin: SkinStyle | null | undefined): string | null {
  return skin?.skin_name ?? null
}

/** Simple icon+name+option-list modal for a pet's equipped item —
 * `PetEquipmentItem` has the same option-list shape as a cash item
 * (`item_option: OptionEntry[]`) but different field names and no
 * label/expiry, so it doesn't fit `CashItemTooltip` cleanly. */
function PetEquipmentTooltip({
  item,
  children,
}: {
  item: PetEquipmentItem
  children: React.ReactNode
}) {
  const options = item.item_option ?? []

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <RichDialogContent title={item.item_name ?? '펫 장비'}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            {item.item_icon && (
              <img src={item.item_icon} alt={item.item_name ?? ''} className="h-10 w-10 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">{item.item_name}</p>
              {item.item_description && (
                <p className="text-xs text-muted-foreground">{item.item_description}</p>
              )}
            </div>
          </div>

          {options.length > 0 && (
            <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
              {options.map((option) => (
                <div key={option.option_type} className="flex gap-3.5">
                  <span className="w-[60px] shrink-0 text-muted-foreground">
                    {option.option_type}
                  </span>
                  <span>+{option.option_value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}

interface PetCardProps {
  name: string | null | undefined
  nickname: string | null | undefined
  icon: string | null | undefined
  petType: string | null | undefined
  description: string | null | undefined
  equipment: PetEquipmentItem | null | undefined
}

function PetCard({ name, nickname, icon, petType, description, equipment }: PetCardProps) {
  if (!name) return null

  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
      <SimpleDetailTooltip
        title={name}
        iconUrl={icon}
        name={name}
        subtitle={[nickname, petType].filter(Boolean).join(' · ') || undefined}
        description={description}
      >
        <button type="button" className="flex flex-1 cursor-pointer items-center gap-2.5 text-left">
          {icon && <img src={icon} alt={name} className="h-9 w-9" />}
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {[nickname, petType].filter(Boolean).join(' · ')}
            </p>
          </div>
        </button>
      </SimpleDetailTooltip>
      {equipment?.item_name && (
        <PetEquipmentTooltip item={equipment}>
          <button type="button" className="shrink-0 cursor-pointer">
            {equipment.item_icon && (
              <img
                src={equipment.item_icon}
                alt={equipment.item_name}
                className="h-8 w-8 rounded border bg-muted/40"
              />
            )}
          </button>
        </PetEquipmentTooltip>
      )}
    </div>
  )
}

interface CashTabProps {
  ocid: string | undefined
}

export function CashTab({ ocid }: CashTabProps) {
  const beautyQuery = useCharacterBeautyEquipment(ocid)
  const cashitemQuery = useCharacterCashitemEquipment(ocid)
  const petQuery = useCharacterPetEquipment(ocid)

  if (cashitemQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (cashitemQuery.isError || !cashitemQuery.data) {
    return <p className="pt-4 text-sm text-muted-foreground">캐시 코디 정보를 불러오지 못했습니다.</p>
  }

  const hair = formatHair(beautyQuery.data?.character_hair)
  const face = formatFace(beautyQuery.data?.character_face)
  const skin = formatSkin(beautyQuery.data?.character_skin)
  const cashItems = cashitemQuery.data.cash_item_equipment_base ?? []
  const pet = petQuery.data

  return (
    <div className="flex flex-col gap-4 pt-4">
      {(hair || face || skin) && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">외형</p>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {hair && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">헤어</span>
                <span className="font-medium">{hair}</span>
              </div>
            )}
            {face && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">성형</span>
                <span className="font-medium">{face}</span>
              </div>
            )}
            {skin && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">피부</span>
                <span className="font-medium">{skin}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {cashItems.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">캐시 코디</p>
          <ItemCardGrid>
            {cashItems.map((item) => (
              <CashItemTooltip key={item.cash_item_equipment_slot} item={item}>
                <ItemCard
                  iconUrl={item.cash_item_icon}
                  name={item.cash_item_name}
                  part={item.cash_item_equipment_part}
                />
              </CashItemTooltip>
            ))}
          </ItemCardGrid>
        </div>
      )}

      {pet && (pet.pet_1_name || pet.pet_2_name || pet.pet_3_name) && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">펫</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <PetCard
              name={pet.pet_1_name}
              nickname={pet.pet_1_nickname}
              icon={pet.pet_1_icon}
              petType={pet.pet_1_pet_type}
              description={pet.pet_1_description}
              equipment={pet.pet_1_equipment}
            />
            <PetCard
              name={pet.pet_2_name}
              nickname={pet.pet_2_nickname}
              icon={pet.pet_2_icon}
              petType={pet.pet_2_pet_type}
              description={pet.pet_2_description}
              equipment={pet.pet_2_equipment}
            />
            <PetCard
              name={pet.pet_3_name}
              nickname={pet.pet_3_nickname}
              icon={pet.pet_3_icon}
              petType={pet.pet_3_pet_type}
              description={pet.pet_3_description}
              equipment={pet.pet_3_equipment}
            />
          </div>
        </div>
      )}
    </div>
  )
}
