import { type FormEvent, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useGuildBasic, useOguildId } from '@/hooks/use-guild'

const MEMBER_DISPLAY_LIMIT = 60

export function GuildPage() {
  const [guildNameInput, setGuildNameInput] = useState('')
  const [worldNameInput, setWorldNameInput] = useState('')
  const [guildName, setGuildName] = useState('')
  const [worldName, setWorldName] = useState('')

  const oguildIdQuery = useOguildId(guildName, worldName)
  const guildQuery = useGuildBasic(oguildIdQuery.data)

  const isSearching = oguildIdQuery.isLoading || (oguildIdQuery.isSuccess && guildQuery.isLoading)
  const isNotFound = oguildIdQuery.isError || guildQuery.isError
  const guildMembers = guildQuery.data?.guild_member ?? []

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGuildName(guildNameInput.trim())
    setWorldName(worldNameInput.trim())
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">길드 조회</h1>
        <p className="text-sm text-muted-foreground">
          길드 이름과 월드를 입력하면 길드 정보를 확인할 수 있어요.
        </p>

        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={guildNameInput}
            onChange={(event) => setGuildNameInput(event.target.value)}
            placeholder="길드 이름"
          />
          <Input
            value={worldNameInput}
            onChange={(event) => setWorldNameInput(event.target.value)}
            placeholder="월드 이름 (예: 스카니아)"
          />
          <Button type="submit">검색</Button>
        </form>

        {isSearching && <Skeleton className="h-40 w-full" />}

        {isNotFound && (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>
              길드를 찾을 수 없습니다. 이름과 월드를 다시 확인해주세요.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {guildQuery.data && (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">길드</p>
              <p className="text-lg font-semibold">{guildQuery.data.guild_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">레벨</p>
              <p className="text-lg font-semibold">{guildQuery.data.guild_level}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t pt-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground">명성치</p>
              <p className="font-semibold">{guildQuery.data.guild_fame.toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">포인트</p>
              <p className="font-semibold">
                {guildQuery.data.guild_point.toLocaleString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">인원</p>
              <p className="font-semibold">{guildQuery.data.guild_member_count}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-xs text-muted-foreground">길드마스터</p>
            <p className="text-sm font-medium">{guildQuery.data.guild_master_name}</p>
          </div>

          {guildMembers.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-xs text-muted-foreground">길드원 ({guildMembers.length}명)</p>
              <div className="flex flex-wrap gap-1.5">
                {guildMembers.slice(0, MEMBER_DISPLAY_LIMIT).map((member) => (
                  <span
                    key={member}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {member}
                  </span>
                ))}
                {guildMembers.length > MEMBER_DISPLAY_LIMIT && (
                  <span className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                    +{guildMembers.length - MEMBER_DISPLAY_LIMIT}명 더
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
