import { useState } from 'react'

import { BossTable } from '@/components/boss-revenue/boss-table'
import { CharacterPanel } from '@/components/boss-revenue/character-panel'
import { StatsTable } from '@/components/boss-revenue/stats-table'
import {
  type CharacterSummary,
  type SelectionClipboard,
  summarizeCharacter,
  useBossRevenue,
} from '@/hooks/use-boss-revenue'
import { getTodayKstDateString } from '@/lib/kst-date'

export function BossRevenuePage() {
  const {
    characters,
    activeCharacterId,
    addCharacter,
    applySelections,
    removeCharacter,
    selectCharacter,
    moveCharacter,
    toggleBossDifficulty,
    setPartySize,
    clearSelections,
    visibleFromBossId,
    visibleToBossId,
    hideAbove,
    hideBelow,
    showAllBosses,
  } = useBossRevenue()
  const [searchTerm, setSearchTerm] = useState('')
  const [clipboard, setClipboard] = useState<SelectionClipboard | null>(null)

  // 검은 마법사처럼 적용일이 걸린 가격을 오늘 기준으로 고르기 위해 필요하다
  // (2026-10-01 전까지는 기존 가격).
  const todayKst = getTodayKstDateString()

  const summaries = new Map<string, CharacterSummary>(
    characters.map((character) => [character.id, summarizeCharacter(character, todayKst)]),
  )
  const activeCharacter = characters.find((character) => character.id === activeCharacterId)
  const activeWeeklyCount = activeCharacter ? (summaries.get(activeCharacter.id)?.weeklyCount ?? 0) : 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">결정석 계산기</h1>
        <p className="text-sm text-muted-foreground">
          캐릭터별로 이번 주에 잡을 보스를 골라두면 결정석 판매 수익을 합산해 보여줍니다. 선택은 이
          브라우저에만 저장됩니다.
        </p>
      </div>

      <StatsTable characters={characters} summaries={summaries} />

      <CharacterPanel
        characters={characters}
        activeCharacterId={activeCharacterId}
        summaries={summaries}
        searchTerm={searchTerm}
        clipboard={clipboard}
        onSearch={setSearchTerm}
        onAdd={(name, level, image) => addCharacter(name, level, image, clipboard?.selections ?? [])}
        onSelect={selectCharacter}
        onMove={moveCharacter}
        onRemove={(characterId) => {
          removeCharacter(characterId)
          if (clipboard?.sourceId === characterId) setClipboard(null)
        }}
        onCopy={(characterId) => {
          const source = characters.find((character) => character.id === characterId)
          if (!source) return
          setClipboard({
            sourceId: source.id,
            sourceName: source.name,
            selections: source.selections.map((selection) => ({ ...selection })),
          })
        }}
        onPaste={(characterId) => {
          if (clipboard) applySelections(characterId, clipboard.selections)
        }}
        onClearClipboard={() => setClipboard(null)}
      />

      <BossTable
        character={activeCharacter}
        weeklyCount={activeWeeklyCount}
        todayKst={todayKst}
        sectionNumber="03"
        visibleFromBossId={visibleFromBossId}
        visibleToBossId={visibleToBossId}
        onHideAbove={hideAbove}
        onHideBelow={hideBelow}
        onShowAll={showAllBosses}
        onToggle={(bossId, difficulty) => {
          if (activeCharacter) toggleBossDifficulty(activeCharacter.id, bossId, difficulty)
        }}
        onPartySizeChange={(bossId, partySize) => {
          if (activeCharacter) setPartySize(activeCharacter.id, bossId, partySize)
        }}
        onClear={() => {
          if (activeCharacter) clearSelections(activeCharacter.id)
        }}
      />
    </div>
  )
}
