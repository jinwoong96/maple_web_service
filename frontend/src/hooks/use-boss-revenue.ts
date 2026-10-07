import { useCallback, useEffect, useState } from 'react'

import {
  BOSSES,
  type BossDefinition,
  type BossDifficulty,
  type BossDifficultyEntry,
  getBossPrice,
  getMaxParty,
  getRevenuePerPerson,
  WEEKLY_BOSS_LIMIT,
  WEEKLY_BOSSES,
} from '@/lib/boss-revenue-reference'

export interface BossSelection {
  bossId: string
  difficulty: BossDifficulty
  partySize: number
}

export interface PlannerCharacter {
  /** 닉네임과 별개인 로컬 식별자 — 같은 닉네임을 두 번 넣는 걸 막지 않는다. */
  id: string
  name: string
  level: number | null
  image: string | null
  selections: BossSelection[]
}

interface PersistedState {
  characters: PlannerCharacter[]
  activeCharacterId: string | null
  /** 보스 목록에서 보이는 주간 보스 구간의 양 끝. 캐릭터별이 아니라 **공통**
   * 설정이라 어떤 캐릭터를 골라도 같은 구간이 보인다. `null`이면 그쪽 끝은
   * 안 자른 것. 인덱스가 아니라 보스 id로 저장해서, 나중에 보스 목록이
   * 바뀌어도 엉뚱한 곳이 잘리지 않는다(없는 id는 무시). */
  visibleFromBossId: string | null
  visibleToBossId: string | null
}

const EMPTY_STATE: PersistedState = {
  characters: [],
  activeCharacterId: null,
  visibleFromBossId: null,
  visibleToBossId: null,
}

const STORAGE_KEY = 'maple-log:boss-revenue:v1'

/** 서버에 올릴 이유가 없는 개인 계획 데이터라 브라우저에만 저장한다.
 * 사생활 보호 모드 등에서 throw할 수 있어 읽기/쓰기 모두 감싼다. */
function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (!Array.isArray(parsed.characters)) return EMPTY_STATE
    return {
      characters: parsed.characters,
      activeCharacterId: parsed.activeCharacterId ?? null,
      visibleFromBossId: parsed.visibleFromBossId ?? null,
      visibleToBossId: parsed.visibleToBossId ?? null,
    }
  } catch {
    return EMPTY_STATE
  }
}

function saveState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 저장 실패는 조용히 무시 — 계산 자체는 메모리 상태로 계속 동작한다.
  }
}

/** 복사해둔 보스 설정. 캐릭터 id가 아니라 복사 시점의 선택을 그대로 들고
 * 있어서, 복사한 뒤 원본을 바꾸거나 지워도 붙여넣는 값은 그대로다.
 * 새로고침하면 사라지는 일시적 상태라 localStorage에는 저장하지 않는다. */
export interface SelectionClipboard {
  sourceId: string
  sourceName: string
  selections: BossSelection[]
}

export interface CharacterSummary {
  weeklyRevenue: number
  monthlyRevenue: number
  weeklyCount: number
  monthlyCount: number
}

export function findBoss(bossId: string): BossDefinition | undefined {
  return BOSSES.find((boss) => boss.id === bossId)
}

export function findDifficulty(
  boss: BossDefinition,
  difficulty: BossDifficulty,
): BossDifficultyEntry | undefined {
  return boss.difficulties.find((entry) => entry.difficulty === difficulty)
}

const DAYS_PER_YEAR = 365
const MONTHS_PER_YEAR = 12
/** 1년을 7로 나눈 주 수 — 4주를 한 달로 보는 것보다 길다(약 52.14주). */
const WEEKS_PER_YEAR = DAYS_PER_YEAR / 7

/** "한 달 = 4주"로 본 수익. 주간 보스를 4번 돌고 월간 보스를 한 번 잡는 값. */
export function getFourWeekRevenue(summary: CharacterSummary): number {
  return Math.floor(summary.weeklyRevenue * 4 + summary.monthlyRevenue)
}

/** 1년 치를 12로 나눈 한 달 평균. 1년은 365일 ÷ 7 = 약 52.14주라서 4주로
 * 계산할 때보다 주간 수익이 조금 더 많이 반영된다. */
export function getMonthlyAverageRevenue(summary: CharacterSummary): number {
  const yearly = summary.weeklyRevenue * WEEKS_PER_YEAR + summary.monthlyRevenue * MONTHS_PER_YEAR
  return Math.floor(yearly / MONTHS_PER_YEAR)
}

export function summarizeCharacter(character: PlannerCharacter, todayKst: string): CharacterSummary {
  let weeklyRevenue = 0
  let monthlyRevenue = 0
  let weeklyCount = 0
  let monthlyCount = 0

  for (const selection of character.selections) {
    const boss = findBoss(selection.bossId)
    if (!boss) continue
    const entry = findDifficulty(boss, selection.difficulty)
    if (!entry) continue

    const revenue = getRevenuePerPerson(getBossPrice(entry, todayKst), selection.partySize)
    if (boss.category === 'monthly') {
      monthlyRevenue += revenue
      monthlyCount += 1
    } else {
      weeklyRevenue += revenue
      weeklyCount += 1
    }
  }

  return { weeklyRevenue, monthlyRevenue, weeklyCount, monthlyCount }
}

/** 저장된 보스 id를 주간 보스 목록의 인덱스로. 없는 id(목록이 바뀐 경우)나
 * `null`이면 `fallback`. */
export function weeklyIndexOf(bossId: string | null, fallback: number): number {
  if (!bossId) return fallback
  const index = WEEKLY_BOSSES.findIndex((boss) => boss.id === bossId)
  return index === -1 ? fallback : index
}

function countWeeklySelections(character: PlannerCharacter): number {
  return character.selections.filter((selection) => findBoss(selection.bossId)?.category === 'weekly').length
}

/** 캐릭터별 주간 보스 선택을 들고 있는 계산기 상태. TanStack Query가 아닌
 * 평범한 `useState` — 서버에서 가져오는 데이터가 아니라 전적으로 로컬
 * 선택이고, `localStorage`에만 영속화한다. */
export function useBossRevenue() {
  const [state, setState] = useState<PersistedState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  /** `selections`를 주면 그 설정을 그대로 가진 캐릭터로 만든다 — 다른
   * 캐릭터의 설정을 복사해둔 채로 새 캐릭터를 추가하는 경우. */
  const addCharacter = useCallback(
    (name: string, level: number | null, image: string | null, selections: BossSelection[] = []) => {
      setState((prev) => {
        const id = `${name}-${Date.now()}`
        const character: PlannerCharacter = {
          id,
          name,
          level,
          image,
          selections: selections.map((selection) => ({ ...selection })),
        }
        return { ...prev, characters: [...prev.characters, character], activeCharacterId: id }
      })
    },
    [],
  )

  /** 다른 캐릭터에서 복사한 설정을 기존 캐릭터에 덮어쓴다. 복사한 쪽과
   * 보스·난이도가 같으니 파티 인원 상한도 같아서 따로 깎을 필요가 없다. */
  const applySelections = useCallback((characterId: string, selections: BossSelection[]) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((character) =>
        character.id === characterId
          ? { ...character, selections: selections.map((selection) => ({ ...selection })) }
          : character,
      ),
    }))
  }, [])

  const removeCharacter = useCallback((characterId: string) => {
    setState((prev) => {
      const characters = prev.characters.filter((character) => character.id !== characterId)
      const activeCharacterId =
        prev.activeCharacterId === characterId ? (characters[0]?.id ?? null) : prev.activeCharacterId
      return { ...prev, characters, activeCharacterId }
    })
  }, [])

  const selectCharacter = useCallback((characterId: string) => {
    setState((prev) => ({ ...prev, activeCharacterId: characterId }))
  }, [])

  /** 카드 순서를 한 칸 앞/뒤로. 순서는 `characters` 배열 자체라서 별도
   * 저장 없이 기존 localStorage 항목에 같이 담긴다. */
  const moveCharacter = useCallback((characterId: string, offset: -1 | 1) => {
    setState((prev) => {
      const index = prev.characters.findIndex((character) => character.id === characterId)
      const target = index + offset
      if (index === -1 || target < 0 || target >= prev.characters.length) return prev
      const characters = [...prev.characters]
      ;[characters[index], characters[target]] = [characters[target], characters[index]]
      return { ...prev, characters }
    })
  }, [])

  /** 같은 난이도를 다시 누르면 해제, 다른 난이도를 누르면 교체한다 — 한
   * 보스에서 두 난이도를 동시에 고를 수는 없다. 주간 보스가 이미
   * `WEEKLY_BOSS_LIMIT`개면 새 보스 추가만 막고, 이미 고른 보스의 난이도
   * 변경/해제는 계속 허용한다. */
  const toggleBossDifficulty = useCallback(
    (characterId: string, bossId: string, difficulty: BossDifficulty) => {
      setState((prev) => ({
        ...prev,
        characters: prev.characters.map((character) => {
          if (character.id !== characterId) return character

          const existing = character.selections.find((selection) => selection.bossId === bossId)
          if (existing?.difficulty === difficulty) {
            return {
              ...character,
              selections: character.selections.filter((selection) => selection.bossId !== bossId),
            }
          }

          const boss = findBoss(bossId)
          const entry = boss ? findDifficulty(boss, difficulty) : undefined
          if (!boss || !entry) return character

          if (
            !existing &&
            boss.category === 'weekly' &&
            countWeeklySelections(character) >= WEEKLY_BOSS_LIMIT
          ) {
            return character
          }

          const partySize = Math.min(existing?.partySize ?? 1, getMaxParty(boss, entry))
          const next: BossSelection = { bossId, difficulty, partySize }
          return {
            ...character,
            selections: existing
              ? character.selections.map((selection) => (selection.bossId === bossId ? next : selection))
              : [...character.selections, next],
          }
        }),
      }))
    },
    [],
  )

  const setPartySize = useCallback((characterId: string, bossId: string, partySize: number) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((character) =>
        character.id === characterId
          ? {
              ...character,
              selections: character.selections.map((selection) =>
                selection.bossId === bossId ? { ...selection, partySize } : selection,
              ),
            }
          : character,
      ),
    }))
  }, [])

  /** "이 위로 숨기기" — 이 보스보다 위에 있는 주간 보스를 전부 가린다.
   * 경계가 이미 이 보스면 다시 누른 것으로 보고 해제한다(토글). 반대쪽
   * 경계보다 아래를 가리키게 되면 그쪽 경계를 풀어서, 보이는 구간이
   * 비어버리는 상태를 만들지 않는다. */
  const hideAbove = useCallback((bossId: string) => {
    setState((prev) => {
      if (prev.visibleFromBossId === bossId) return { ...prev, visibleFromBossId: null }
      const from = WEEKLY_BOSSES.findIndex((boss) => boss.id === bossId)
      if (from === -1) return prev
      const to = weeklyIndexOf(prev.visibleToBossId, WEEKLY_BOSSES.length - 1)
      return { ...prev, visibleFromBossId: bossId, visibleToBossId: from > to ? null : prev.visibleToBossId }
    })
  }, [])

  /** "이 아래로 숨기기" — 이 보스보다 아래에 있는 주간 보스를 전부 가린다.
   * 위와 같이 다시 누르면 해제된다. */
  const hideBelow = useCallback((bossId: string) => {
    setState((prev) => {
      if (prev.visibleToBossId === bossId) return { ...prev, visibleToBossId: null }
      const to = WEEKLY_BOSSES.findIndex((boss) => boss.id === bossId)
      if (to === -1) return prev
      const from = weeklyIndexOf(prev.visibleFromBossId, 0)
      return { ...prev, visibleToBossId: bossId, visibleFromBossId: to < from ? null : prev.visibleFromBossId }
    })
  }, [])

  const showAllBosses = useCallback(() => {
    setState((prev) => ({ ...prev, visibleFromBossId: null, visibleToBossId: null }))
  }, [])

  const clearSelections = useCallback((characterId: string) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((character) =>
        character.id === characterId ? { ...character, selections: [] } : character,
      ),
    }))
  }, [])

  return {
    characters: state.characters,
    activeCharacterId: state.activeCharacterId,
    addCharacter,
    applySelections,
    removeCharacter,
    selectCharacter,
    moveCharacter,
    toggleBossDifficulty,
    setPartySize,
    clearSelections,
    visibleFromBossId: state.visibleFromBossId,
    visibleToBossId: state.visibleToBossId,
    hideAbove,
    hideBelow,
    showAllBosses,
  }
}
