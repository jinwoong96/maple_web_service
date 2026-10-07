import { useState } from 'react'
import { Link } from 'react-router'

import { CharacterSearchForm } from '@/components/character/character-search-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacterBasic, useCharacterOcid } from '@/hooks/use-character'
import {
  useCashshopNotices,
  useEventNotices,
  useGeneralNotices,
  useUpdateNotices,
} from '@/hooks/use-notices'
import { NoticeSection } from '@/pages/notice-section'

export function HomePage() {
  const [searchTerm, setSearchTerm] = useState('')

  const ocidQuery = useCharacterOcid(searchTerm)
  const basicQuery = useCharacterBasic(ocidQuery.data)
  const generalNotices = useGeneralNotices()
  const eventNotices = useEventNotices()
  const updateNotices = useUpdateNotices()
  const cashshopNotices = useCashshopNotices()

  const isSearching = ocidQuery.isLoading || (ocidQuery.isSuccess && basicQuery.isLoading)
  const isNotFound = ocidQuery.isError || basicQuery.isError

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 pt-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">캐릭터 검색</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터 이름을 입력하면 스탯, 장비, 유니온 정보를 확인할 수 있어요.
        </p>

        <CharacterSearchForm onSubmit={setSearchTerm} />

        {isSearching && (
          <div className="flex w-full items-center gap-3 rounded-lg border p-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        )}

        {isNotFound && (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>캐릭터를 찾을 수 없습니다. 이름을 다시 확인해주세요.</AlertDescription>
          </Alert>
        )}

        {basicQuery.data && (
          <Link
            to={`/characters/${encodeURIComponent(basicQuery.data.character_name)}`}
            className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
          >
            <Avatar className="size-12">
              <AvatarImage
                src={basicQuery.data.character_image}
                alt={basicQuery.data.character_name}
              />
              <AvatarFallback>{basicQuery.data.character_name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{basicQuery.data.character_name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {basicQuery.data.world_name} · {basicQuery.data.character_class} Lv.
                {basicQuery.data.character_level}
              </p>
            </div>
          </Link>
        )}
      </div>

      <Separator />

      <div className="grid gap-8 sm:grid-cols-2">
        <NoticeSection title="공지사항" query={generalNotices} />
        <NoticeSection title="이벤트" query={eventNotices} />
        <NoticeSection title="업데이트" query={updateNotices} />
        <NoticeSection title="캐시샵" query={cashshopNotices} />
      </div>
    </div>
  )
}
