import { useParams } from 'react-router'

import { CashTab } from '@/components/character/cash-tab'
import { CharacterInfoCard } from '@/components/character/character-info-card'
import { EquipmentTab } from '@/components/character/equipment-tab'
import { MiscTab } from '@/components/character/misc-tab'
import { SkillTab } from '@/components/character/skill-tab'
import { StatPanel } from '@/components/character/stat-panel'
import { UnionTab } from '@/components/character/union-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useCharacterBasic,
  useCharacterOcid,
  useCharacterPopularity,
  useCharacterStat,
} from '@/hooks/use-character'
import { useUnionChampion, useUnionInfo } from '@/hooks/use-union'

export function CharacterDetailPage() {
  const { characterName = '' } = useParams<{ characterName: string }>()

  const ocidQuery = useCharacterOcid(characterName)
  const basicQuery = useCharacterBasic(ocidQuery.data)
  const statQuery = useCharacterStat(ocidQuery.data)
  const popularityQuery = useCharacterPopularity(ocidQuery.data)
  const unionQuery = useUnionInfo(ocidQuery.data)
  const championQuery = useUnionChampion(ocidQuery.data)

  const isLoading = ocidQuery.isLoading || (ocidQuery.isSuccess && basicQuery.isLoading)
  const isNotFound = ocidQuery.isError || basicQuery.isError

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (isNotFound || !basicQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <p className="font-medium">캐릭터를 찾을 수 없습니다.</p>
        <p className="text-sm text-muted-foreground">이름을 다시 확인해주세요.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <CharacterInfoCard
        basic={basicQuery.data}
        unionLevel={unionQuery.data?.union_level}
        popularity={popularityQuery.data?.popularity}
        champions={championQuery.data}
      />

      <Tabs defaultValue="equipment">
        <TabsList>
          <TabsTrigger value="equipment">장비</TabsTrigger>
          <TabsTrigger value="cash">캐시</TabsTrigger>
          <TabsTrigger value="stat">스탯</TabsTrigger>
          <TabsTrigger value="skill">스킬</TabsTrigger>
          <TabsTrigger value="union">유니온</TabsTrigger>
          <TabsTrigger value="misc">기타</TabsTrigger>
        </TabsList>
        <TabsContent value="equipment">
          <EquipmentTab ocid={ocidQuery.data} />
        </TabsContent>
        <TabsContent value="cash">
          <CashTab ocid={ocidQuery.data} />
        </TabsContent>
        <TabsContent value="stat">
          <StatPanel query={statQuery} />
        </TabsContent>
        <TabsContent value="skill">
          <SkillTab ocid={ocidQuery.data} />
        </TabsContent>
        <TabsContent value="union">
          <UnionTab ocid={ocidQuery.data} />
        </TabsContent>
        <TabsContent value="misc">
          <MiscTab ocid={ocidQuery.data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
