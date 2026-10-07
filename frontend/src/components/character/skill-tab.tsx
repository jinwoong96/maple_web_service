import {
  EquipmentSlotButton,
  EquipmentSlotGrid,
  EquipmentSlotIcon,
} from '@/components/character/equipment-slot-grid'
import { RichDialogContent } from '@/components/character/equipment-tooltip'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useCharacterHexamatrix,
  useCharacterHexamatrixStat,
  useCharacterLinkSkill,
  useCharacterSkillsByGrade,
  useCharacterVmatrix,
} from '@/hooks/use-character'
import type { components } from '@/lib/api-types'

type SkillInfo = components['schemas']['SkillInfo']
type VCoreEquipment = components['schemas']['VCoreEquipment']
type HexaCoreEquipment = components['schemas']['HexaCoreEquipment']
type HexaStatCore = components['schemas']['HexaStatCore']

// skill_description is prefixed with "[마스터 레벨 : N]" ahead of the actual
// body text — confirmed across every grade pulled from 다섯별(메카닉). Split
// it out so the level shows structured (next to skill_level) instead of as
// plain text at the top of the description.
const MASTER_LEVEL_PATTERN = /^\[마스터\s*레벨\s*:\s*(\d+)\]\r?\n+/

function parseSkillDescription(description: string | null | undefined): {
  masterLevel: number | null
  body: string | null
} {
  if (!description) return { masterLevel: null, body: null }
  const match = MASTER_LEVEL_PATTERN.exec(description)
  if (!match) return { masterLevel: null, body: description }
  return { masterLevel: Number(match[1]), body: description.slice(match[0].length) || null }
}

function SkillTooltip({ skill, children }: { skill: SkillInfo; children: React.ReactNode }) {
  const { masterLevel, body } = parseSkillDescription(skill.skill_description)

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <RichDialogContent title={skill.skill_name}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            {skill.skill_icon && (
              <img src={skill.skill_icon} alt={skill.skill_name} className="h-10 w-10 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">{skill.skill_name}</p>
              <p className="text-xs text-muted-foreground">
                Lv.{skill.skill_level}
                {masterLevel != null && ` (마스터 레벨 ${masterLevel})`}
              </p>
            </div>
          </div>

          {body && (
            <p className="border-t pt-2.5 text-xs whitespace-pre-line text-muted-foreground">
              {body}
            </p>
          )}

          {skill.skill_effect && (
            <div className="flex flex-col gap-0.5 border-t pt-2.5 text-xs">
              <p className="font-medium">효과</p>
              <p className="whitespace-pre-line text-muted-foreground">{skill.skill_effect}</p>
            </div>
          )}

          {skill.skill_effect_next && (
            <div className="flex flex-col gap-0.5 rounded-md bg-muted p-2.5 text-xs">
              <p className="font-medium text-primary">다음 레벨 효과</p>
              <p className="whitespace-pre-line text-muted-foreground">
                {skill.skill_effect_next}
              </p>
            </div>
          )}
        </div>
      </RichDialogContent>
    </Dialog>
  )
}

function SkillGrid({ skills }: { skills: SkillInfo[] }) {
  return (
    <EquipmentSlotGrid>
      {skills.map((skill, index) => (
        <SkillTooltip key={`${skill.skill_name}-${index}`} skill={skill}>
          <EquipmentSlotButton label={skill.skill_name} sublabel={`Lv.${skill.skill_level}`}>
            <EquipmentSlotIcon iconUrl={skill.skill_icon} label={skill.skill_name} />
          </EquipmentSlotButton>
        </SkillTooltip>
      ))}
    </EquipmentSlotGrid>
  )
}

function groupByType<T>(items: T[], getType: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const type = getType(item)
    const group = groups.get(type)
    if (group) group.push(item)
    else groups.set(type, [item])
  }
  return groups
}

function VMatrixSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterVmatrix(ocid)

  if (query.isLoading) return <Skeleton className="h-32 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">V매트릭스 정보를 불러오지 못했습니다.</p>
  }

  const cores = query.data.character_v_core_equipment ?? []
  if (cores.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 V매트릭스 코어가 없습니다.</p>
  }

  const groups = groupByType(cores, (core: VCoreEquipment) => core.v_core_type)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">V매트릭스 (5차 코어)</p>
      {Array.from(groups.entries()).map(([type, typeCores]) => (
        <div key={type} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{type}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {typeCores.map((core, index) => (
              <div key={`${core.v_core_name}-${index}`} className="rounded-md border p-2 text-center">
                <p className="line-clamp-1 text-xs font-medium">{core.v_core_name}</p>
                <p className="text-xs text-muted-foreground">Lv.{core.v_core_level}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function HexaMatrixSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterHexamatrix(ocid)

  if (query.isLoading) return <Skeleton className="h-32 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">HEXA매트릭스 정보를 불러오지 못했습니다.</p>
  }

  const cores = query.data.character_hexa_core_equipment ?? []
  if (cores.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 HEXA매트릭스 코어가 없습니다.</p>
  }

  const groups = groupByType(cores, (core: HexaCoreEquipment) => core.hexa_core_type)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">HEXA매트릭스 (6차 코어)</p>
      {Array.from(groups.entries()).map(([type, typeCores]) => (
        <div key={type} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{type}</p>
          <div className="flex flex-col gap-1.5">
            {typeCores.map((core, index) => (
              <div
                key={`${core.hexa_core_name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{core.hexa_core_name}</p>
                  {(core.linked_skill ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(core.linked_skill ?? []).map((skill) => skill.hexa_skill_id).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Lv.{core.hexa_core_level}
                  {(core.hexa_core_event_level ?? 0) > 0 && ` (+${core.hexa_core_event_level})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function HexaStatSlot({ label, cores }: { label: string; cores: HexaStatCore[] }) {
  if (cores.length === 0 || cores.every((core) => core.main_stat_name == null)) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2.5 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {cores.map((core, index) => (
        <div key={index} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {core.main_stat_name && (
            <span className="font-medium">
              {core.main_stat_name} Lv.{core.main_stat_level}
            </span>
          )}
          {core.sub_stat_name_1 && (
            <span className="text-muted-foreground">
              {core.sub_stat_name_1} Lv.{core.sub_stat_level_1}
            </span>
          )}
          {core.sub_stat_name_2 && (
            <span className="text-muted-foreground">
              {core.sub_stat_name_2} Lv.{core.sub_stat_level_2}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function HexaStatSection({ ocid }: { ocid: string | undefined }) {
  const query = useCharacterHexamatrixStat(ocid)

  if (query.isLoading) return <Skeleton className="h-32 w-full" />
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">HEXA스탯 정보를 불러오지 못했습니다.</p>
  }

  const data = query.data
  const slots = [
    { label: '슬롯 1', cores: data.character_hexa_stat_core ?? [] },
    { label: '슬롯 2', cores: data.character_hexa_stat_core_2 ?? [] },
    { label: '슬롯 3', cores: data.character_hexa_stat_core_3 ?? [] },
  ]
  const hasAny = slots.some((slot) => slot.cores.some((core) => core.main_stat_name != null))

  if (!hasAny) {
    return <p className="text-sm text-muted-foreground">표시할 HEXA스탯이 없습니다.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">HEXA스탯</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {slots.map((slot) => (
          <HexaStatSlot key={slot.label} label={slot.label} cores={slot.cores} />
        ))}
      </div>
    </div>
  )
}

/** V매트릭스(5차 코어)/HEXA매트릭스(6차 코어)/HEXA스탯을 묶은 서브탭 —
 * docs/planning/features/character.md의 "Not yet built"에서 스킬 탭의
 * 마지막 서브탭 자리에 붙이기로 계획한 항목. 프리셋 변형
 * (character_v_core_equipment_preset_N, preset_hexa_stat_core_N)은 유니온
 * 탭과 동일한 이유로 제외하고 현재 장착 값만 보여준다. */
function CoreMatrixTab({ ocid }: { ocid: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <VMatrixSection ocid={ocid} />
      <HexaMatrixSection ocid={ocid} />
      <HexaStatSection ocid={ocid} />
    </div>
  )
}

interface SkillTabProps {
  ocid: string | undefined
}

/** 11 grade sub-tabs (whichever have skills — Nexon returns an empty
 * character_skill[] for grades this character has none in, so those are
 * filtered out by useCharacterSkillsByGrade) plus 링크 스킬 and, always
 * last, 코어 강화 (V매트릭스/HEXA매트릭스/HEXA스탯 — see CoreMatrixTab). */
export function SkillTab({ ocid }: SkillTabProps) {
  const { isLoading, groups } = useCharacterSkillsByGrade(ocid)
  const linkSkillQuery = useCharacterLinkSkill(ocid)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (groups.length === 0) {
    return <p className="pt-4 text-sm text-muted-foreground">스킬 정보를 불러오지 못했습니다.</p>
  }

  const linkSkill = linkSkillQuery.data
  const ownedLinkSkill = linkSkill?.character_owned_link_skill
  const equippedLinkSkills = linkSkill?.character_link_skill ?? []
  const hasLinkSkill = Boolean(ownedLinkSkill) || equippedLinkSkills.length > 0

  return (
    <div className="pt-4">
      <Tabs defaultValue={groups[0].grade}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            {groups.map((group) => (
              <TabsTrigger key={group.grade} value={group.grade}>
                {group.label}
              </TabsTrigger>
            ))}
            {hasLinkSkill && <TabsTrigger value="link-skill">링크 스킬</TabsTrigger>}
            <TabsTrigger value="core-matrix">코어 강화</TabsTrigger>
          </TabsList>
        </div>

        {groups.map((group) => (
          <TabsContent key={group.grade} value={group.grade} className="pt-4">
            <SkillGrid skills={group.skills} />
          </TabsContent>
        ))}

        {hasLinkSkill && (
          <TabsContent value="link-skill" className="flex flex-col gap-4 pt-4">
            {ownedLinkSkill && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">보유 링크 스킬</p>
                <SkillGrid skills={[ownedLinkSkill]} />
              </div>
            )}
            {equippedLinkSkills.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  적용 중인 링크 스킬 ({equippedLinkSkills.length})
                </p>
                <SkillGrid skills={equippedLinkSkills} />
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="core-matrix" className="pt-4">
          <CoreMatrixTab ocid={ocid} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
