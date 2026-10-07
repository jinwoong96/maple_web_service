import { type FormEvent, useMemo, useState } from 'react'
import { Eye, EyeOff, Star, Users, X } from 'lucide-react'

import { GroupTab } from '@/components/guild-admin/group-tab'
import { GrowthTab } from '@/components/guild-admin/growth-tab'
import { RosterDiffTab } from '@/components/guild-admin/roster-diff-tab'
import { ScoreInputTab } from '@/components/guild-admin/score-input-tab'
import { WeekRecordsTab } from '@/components/guild-admin/week-records-tab'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiKeyRemember } from '@/components/api-key-remember'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGuildAdminApiKey } from '@/hooks/use-guild-admin-api-key'
import { useGuildFavorites, type GuildFavorite } from '@/hooks/use-guild-favorites'
import type { GuildIdentity } from '@/hooks/use-guild-groups'
import type { ScoreRecord } from '@/lib/score-records'
import { useGuildBasic, useOguildId } from '@/hooks/use-guild'

interface ApiKeyCardProps {
  apiKey: string
  onSubmit: (value: string) => void
  onClear: () => void
  remembered: boolean
  onRemember: () => void
  onForget: () => void
}

/** 확률 정보 탭과 같은 형태의 키 입력 카드지만 **저장 키가 다르다**
 * (`guild-admin-nexon-api-key`). 두 탭을 동시에 쓰라고 만든 기능이 아니라서
 * 따로 넣게 했다 — 대신 운영진 키와 개인 조회 키를 분리할 수 있다. */
function ApiKeyCard({
  apiKey,
  onSubmit,
  onClear,
  remembered,
  onRemember,
  onForget,
}: ApiKeyCardProps) {
  const [draft, setDraft] = useState(apiKey)
  const [visible, setVisible] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(draft.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-medium">내 Nexon API 키</p>
      <p className="text-xs text-muted-foreground">
        길드원 수백 명분을 조회하기 때문에 본인 키가 필요합니다. 입력한 키는 이 브라우저에서 넥슨
        API로 직접 전송될 뿐, 이 사이트 서버로는 전송되지 않습니다.{' '}
        {remembered
          ? '이 컴퓨터에 저장해 두었습니다 — 아래에서 언제든 지울 수 있습니다.'
          : '기본적으로 탭을 닫으면 자동으로 삭제됩니다.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nexon Open API 키를 입력하세요"
          className="max-w-sm"
          autoComplete="off"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => setVisible((value) => !value)}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button type="submit" disabled={draft.trim().length === 0}>
          적용
        </Button>
        {apiKey && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft('')
              onClear()
            }}
          >
            지우기
          </Button>
        )}
      </div>
      <ApiKeyRemember
        apiKey={apiKey}
        remembered={remembered}
        onRemember={onRemember}
        onForget={onForget}
      />
    </form>
  )
}

export function GuildAdminPage() {
  const { apiKey, setApiKey, clearApiKey, remembered, remember, forget } = useGuildAdminApiKey()
  const [guildInput, setGuildInput] = useState({ guildName: '', worldName: '' })
  const [submitted, setSubmitted] = useState({ guildName: '', worldName: '' })

  const oguildIdQuery = useOguildId(submitted.guildName, submitted.worldName)
  const guildQuery = useGuildBasic(oguildIdQuery.data)

  const guild: GuildIdentity | null = useMemo(() => {
    if (!oguildIdQuery.data || !guildQuery.data) return null
    return {
      oguildId: oguildIdQuery.data,
      guildName: guildQuery.data.guild_name,
      worldName: guildQuery.data.world_name,
      memberCount: guildQuery.data.guild_member_count,
      userCount: guildQuery.data.guild_user_count ?? null,
      members: guildQuery.data.guild_member ?? [],
    }
  }, [oguildIdQuery.data, guildQuery.data])

  const [tab, setTab] = useState('groups')
  /** 주차 기록에서 "점수 입력에서 열기"를 누른 기록. 누를 때마다 `nonce`가 바뀐다. */
  const [openRequest, setOpenRequest] = useState<{ record: ScoreRecord; nonce: number } | null>(null)

  function handleGuildSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted({ guildName: guildInput.guildName.trim(), worldName: guildInput.worldName.trim() })
  }

  const favorites = useGuildFavorites()
  /** 즐겨찾기를 누르면 입력칸을 채우고 바로 불러온다. */
  function openFavorite(favorite: GuildFavorite) {
    setGuildInput(favorite)
    setSubmitted(favorite)
  }
  /** 지금 불러온 길드. 즐겨찾기 버튼은 불러온 길드에만 붙는다(오타 난 이름이 들어가지 않게). */
  const loaded: GuildFavorite | null = guild ? { guildName: guild.guildName, worldName: guild.worldName } : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="size-6" />
          길드 관리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          길드 운영을 돕는 도구입니다. 넥슨 키로 길드를 불러오면 바로 쓸 수 있고, 기록은 이 브라우저에만 저장됩니다.
        </p>
      </div>

      <ApiKeyCard
        apiKey={apiKey}
        onSubmit={setApiKey}
        onClear={clearApiKey}
        remembered={remembered}
        onRemember={remember}
        onForget={forget}
      />

      <form onSubmit={handleGuildSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">길드명</label>
          <Input
            value={guildInput.guildName}
            onChange={(event) => setGuildInput((prev) => ({ ...prev, guildName: event.target.value }))}
            placeholder="길드명"
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">월드명</label>
          <Input
            value={guildInput.worldName}
            onChange={(event) => setGuildInput((prev) => ({ ...prev, worldName: event.target.value }))}
            placeholder="예: 스카니아"
            className="w-36"
          />
        </div>
        <Button type="submit" disabled={!guildInput.guildName.trim() || !guildInput.worldName.trim()}>
          길드 불러오기
        </Button>
        {loaded && (
          <Button
            type="button"
            variant="outline"
            onClick={() => favorites.toggle(loaded)}
            aria-pressed={favorites.isFavorite(loaded)}
            title={favorites.isFavorite(loaded) ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
          >
            <Star
              className={`size-4 ${favorites.isFavorite(loaded) ? 'fill-amber-400 text-amber-500' : ''}`}
            />
            {loaded.guildName} 즐겨찾기
          </Button>
        )}
        {favorites.favorites.length > 0 && (
          <div className="flex basis-full flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">즐겨찾기</span>
            {favorites.favorites.map((favorite) => (
              <span
                key={`${favorite.worldName}|${favorite.guildName}`}
                className="flex items-center rounded-full border text-sm"
              >
                <button
                  type="button"
                  onClick={() => openFavorite(favorite)}
                  className="rounded-l-full py-0.5 pr-1 pl-3 hover:bg-muted"
                >
                  {favorite.guildName}
                  <span className="ml-1 text-xs text-muted-foreground">{favorite.worldName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => favorites.remove(favorite)}
                  aria-label={`${favorite.guildName} 즐겨찾기에서 빼기`}
                  className="rounded-r-full py-0.5 pr-2 pl-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </form>

      {oguildIdQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>길드를 찾지 못했습니다. 길드명과 월드명을 확인해주세요.</AlertDescription>
        </Alert>
      )}

      {(oguildIdQuery.isLoading || guildQuery.isLoading) && submitted.guildName && (
        <Skeleton className="h-24 w-full" />
      )}

      {guild && (
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="groups">그룹</TabsTrigger>
            <TabsTrigger value="roster">명단 변동</TabsTrigger>
            <TabsTrigger value="growth">성장 추적</TabsTrigger>
            <TabsTrigger value="scores">점수 입력</TabsTrigger>
            <TabsTrigger value="records">주차 기록</TabsTrigger>
          </TabsList>
          <TabsContent value="groups">
            <GroupTab guild={guild} apiKey={apiKey} />
          </TabsContent>
          <TabsContent value="roster">
            <RosterDiffTab guild={guild} apiKey={apiKey} />
          </TabsContent>
          <TabsContent value="growth">
            <GrowthTab guild={guild} apiKey={apiKey} />
          </TabsContent>
          {/* **탭을 옮겨도 입력 중인 줄이 남아야 한다.** 스크린샷을 읽고 고치다가
              주차 기록을 보러 갔다 오면 다 사라지면 곤란하다. 그래서 늘 붙여 두고 숨긴다. */}
          <TabsContent value="scores" forceMount className="data-[state=inactive]:hidden">
            <ScoreInputTab key={guild.oguildId} guild={guild} apiKey={apiKey} openRequest={openRequest} />
          </TabsContent>
          <TabsContent value="records">
            <WeekRecordsTab
              guild={guild}
              onOpen={(record) => {
                setOpenRequest({ record, nonce: Date.now() })
                setTab('scores')
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
