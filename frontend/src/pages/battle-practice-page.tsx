import { useState } from 'react'

import { ReplayCharacterInfo } from '@/components/battle-practice/replay-character-info'
import { SkillTimeline } from '@/components/battle-practice/skill-timeline'
import { CharacterSearchForm } from '@/components/character/character-search-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCharacterOcid } from '@/hooks/use-character'
import { useBattlePracticeReplayIds, useBattlePracticeResult } from '@/hooks/use-battle-practice'

function formatPlayTime(totalMilliseconds: number): string {
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}분 ${seconds}초`
}

export function BattlePracticePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReplayId, setSelectedReplayId] = useState<string>()

  const ocidQuery = useCharacterOcid(searchTerm)
  const replayListQuery = useBattlePracticeReplayIds(ocidQuery.data)
  const resultQuery = useBattlePracticeResult(selectedReplayId)

  const isSearching = ocidQuery.isLoading || (ocidQuery.isSuccess && replayListQuery.isLoading)
  const characterNotFound = ocidQuery.isError
  const noReplayHistory = ocidQuery.isSuccess && replayListQuery.isError
  const replayList = replayListQuery.data ?? []

  function handleSearch(name: string) {
    setSelectedReplayId(undefined)
    setSearchTerm(name)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pt-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">연무장 조회</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터 이름을 입력하면 연무장 플레이 기록을 확인할 수 있어요.
        </p>

        <CharacterSearchForm onSubmit={handleSearch} />

        {isSearching && <Skeleton className="h-24 w-full" />}

        {characterNotFound && (
          <Alert variant="destructive" className="text-left">
            <AlertDescription>캐릭터를 찾을 수 없습니다. 이름을 다시 확인해주세요.</AlertDescription>
          </Alert>
        )}

        {noReplayHistory && (
          <Alert className="text-left">
            <AlertDescription>연무장 플레이 기록이 없습니다.</AlertDescription>
          </Alert>
        )}
      </div>

      {replayList.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">플레이 기록</h2>
          <div className="flex flex-col gap-1.5">
            {replayList.map((replay) => (
              <button
                key={replay.replay_id}
                type="button"
                onClick={() => setSelectedReplayId(replay.replay_id)}
                className={`flex items-center justify-between rounded-md border px-4 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  selectedReplayId === replay.replay_id ? 'border-primary bg-accent' : ''
                }`}
              >
                <span>{replay.period_no}기</span>
                <span className="text-muted-foreground">
                  {replay.register_date?.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {resultQuery.isLoading && <Skeleton className="h-40 w-full" />}

      {resultQuery.data && selectedReplayId && (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
          <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">종료 유형</p>
              <p className="font-semibold">{resultQuery.data.end_type ?? '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">플레이 시간</p>
              <p className="font-semibold">
                {resultQuery.data.total_play_time != null
                  ? formatPlayTime(resultQuery.data.total_play_time)
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">총 데미지</p>
              <p className="font-semibold">
                {resultQuery.data.total_damage?.toLocaleString('ko-KR') ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">평균 DPS</p>
              <p className="font-semibold">
                {resultQuery.data.total_dps?.toLocaleString('ko-KR') ?? '-'}
              </p>
            </div>
          </div>

          {/* 요약 아래는 **눌러야 불러온다.** 타임라인은 수천 줄이고 캐릭터
              정보는 장비까지 통째로 오는 큰 응답이라, 기록을 고르기만 한
              사람에게까지 받아올 이유가 없다. */}
          <Tabs defaultValue="summary" className="gap-3 border-t pt-4">
            <TabsList>
              <TabsTrigger value="summary">스킬별 비중</TabsTrigger>
              <TabsTrigger value="timeline">스킬 타임라인</TabsTrigger>
              <TabsTrigger value="character">그때의 캐릭터</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              {resultQuery.data.skill_statistic && resultQuery.data.skill_statistic.length > 0 ? (
                <ul className="flex flex-col gap-1 pt-4 text-sm">
                  {resultQuery.data.skill_statistic.slice(0, 8).map((skill) => (
                    <li key={skill.skill_name} className="flex items-center justify-between">
                      <span>{skill.skill_name}</span>
                      <span className="font-medium">{skill.damage_percent ?? '-'}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pt-4 text-sm text-muted-foreground">스킬 기록이 없습니다.</p>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              <SkillTimeline replayId={selectedReplayId} />
            </TabsContent>

            <TabsContent value="character">
              <ReplayCharacterInfo replayId={selectedReplayId} />
            </TabsContent>
          </Tabs>
        </div>
      )}

    </div>
  )
}
