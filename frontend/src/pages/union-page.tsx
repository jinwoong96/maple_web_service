import { useState } from 'react'

import { CharacterSearchForm } from '@/components/character/character-search-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacterOcid } from '@/hooks/use-character'
import { useUnionArtifact, useUnionInfo } from '@/hooks/use-union'

export function UnionPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const ocidQuery = useCharacterOcid(searchTerm)
  const unionQuery = useUnionInfo(ocidQuery.data)
  const artifactQuery = useUnionArtifact(ocidQuery.data)

  const isSearching = ocidQuery.isLoading || (ocidQuery.isSuccess && unionQuery.isLoading)
  const isNotFound = ocidQuery.isError || unionQuery.isError

  const artifactEffects = artifactQuery.data?.union_artifact_effect ?? []

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">유니온 조회</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터 이름을 입력하면 유니온 등급과 아티팩트 정보를 확인할 수 있어요.
        </p>

        <CharacterSearchForm onSubmit={setSearchTerm} />

        {isSearching && (
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {isNotFound && (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>캐릭터를 찾을 수 없습니다. 이름을 다시 확인해주세요.</AlertDescription>
          </Alert>
        )}
      </div>

      {unionQuery.data && (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">유니온 등급</p>
              <p className="text-lg font-semibold">{unionQuery.data.union_grade}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">유니온 레벨</p>
              <p className="text-lg font-semibold">
                {unionQuery.data.union_level.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground">아티팩트 레벨</p>
              <p className="font-semibold">{unionQuery.data.union_artifact_level}</p>
            </div>
            <div>
              <p className="text-muted-foreground">아티팩트 경험치</p>
              <p className="font-semibold">
                {unionQuery.data.union_artifact_exp.toLocaleString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">아티팩트 포인트</p>
              <p className="font-semibold">
                {unionQuery.data.union_artifact_point.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {artifactEffects.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">아티팩트 효과</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {artifactEffects.map((effect) => (
              <li key={effect.name} className="flex items-center justify-between">
                <span>{effect.name}</span>
                <span className="font-medium">Lv.{effect.level}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
