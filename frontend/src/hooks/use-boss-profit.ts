import { useEffect, useMemo, useState } from 'react'

import {
  type AuctionFeeRate,
  createEvenRatioInputs,
  MAX_PARTY_SIZE,
  MIN_PARTY_SIZE,
  type PartyConfig,
  type SaleItem,
  settleItems,
  type SplitMode,
} from '@/lib/boss-profit-split'
import {
  loadFeeRate,
  loadFixedParties,
  loadSettlerName,
  saveFeeRate,
  saveFixedParties,
  saveSettlerName,
} from '@/lib/boss-profit-storage'

/** 화면에 떠 있는 파티. 고정팟이면 `saved`이고, 고친 내용은 "저장"을 누르기
 * 전까지 이번 계산에만 적용된다 — 땜빵 멤버로 잠깐 바꿨다가 저장본이
 * 망가지는 일을 막는다. */
export interface PartyDraft extends PartyConfig {
  saved: boolean
}

/** 정산자 비율 칸을 가리키는 멤버 id. */
export const SETTLER_MEMBER_ID = -1

function createPartyId(): string {
  // crypto.randomUUID는 보안 컨텍스트(https/localhost)에서만 있어서 쓰지 않는다.
  return `party-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPartyName(parties: PartyConfig[]): string {
  const names = new Set(parties.map((party) => party.name.trim()))
  let index = 1
  while (names.has(`파티 ${index}`)) index += 1
  return `파티 ${index}`
}

/** 인원(정산자 포함)에 맞춰 파티원 칸과 비율을 다시 만든다. 이름은 남긴다 —
 * 비율은 합이 100이 아닌 채로 남지 않도록 균등하게 되돌린다. */
function resizeParty(party: PartyConfig, size: number): PartyConfig {
  const [settlerRatio, ...memberRatios] = createEvenRatioInputs(size)
  return {
    ...party,
    settlerRatio,
    members: memberRatios.map((ratio, index) => ({
      id: index,
      name: party.members[index]?.name ?? '',
      ratio,
    })),
  }
}

function createTempParty(parties: PartyConfig[]): PartyDraft {
  return {
    ...resizeParty(
      { id: createPartyId(), name: nextPartyName(parties), splitMode: 'equal', settlerRatio: 0, members: [] },
      MIN_PARTY_SIZE,
    ),
    saved: false,
  }
}

function toConfig(party: PartyConfig): PartyConfig {
  return {
    id: party.id,
    name: party.name,
    splitMode: party.splitMode,
    settlerRatio: party.settlerRatio,
    members: party.members.map((member) => ({ id: member.id, name: member.name, ratio: member.ratio })),
  }
}

function isSameParty(a: PartyConfig, b: PartyConfig): boolean {
  return JSON.stringify(toConfig(a)) === JSON.stringify(toConfig(b))
}

/** 이름만 쓰고 금액을 안 넣은 줄도 "정산할 아이템"으로 본다 — 사람이 뭔가
 * 입력한 줄이다. 아무것도 없는 빈 줄은 파티 삭제를 막지 않는다. */
function isPendingItem(item: SaleItem): boolean {
  return item.amount > 0 || item.name.trim() !== ''
}

function createItem(id: number, partyId: string | null): SaleItem {
  return { id, name: '', amount: 0, partyId }
}

export function useBossProfit() {
  const [fixedParties, setFixedParties] = useState<PartyConfig[]>(loadFixedParties)
  const [parties, setParties] = useState<PartyDraft[]>(() =>
    fixedParties.length > 0
      ? fixedParties.map((party) => ({ ...party, saved: true }))
      : [createTempParty([])],
  )
  const [items, setItems] = useState<SaleItem[]>(() => [createItem(0, parties[0]?.id ?? null)])
  const [feeRate, setFeeRate] = useState<AuctionFeeRate>(loadFeeRate)
  const [settlerName, setSettlerName] = useState(loadSettlerName)

  useEffect(() => {
    saveFeeRate(feeRate)
  }, [feeRate])

  useEffect(() => {
    saveSettlerName(settlerName)
  }, [settlerName])

  // --- 파티 ---------------------------------------------------------------

  function updateParty(id: string, update: (party: PartyDraft) => PartyDraft) {
    setParties((prev) => prev.map((party) => (party.id === id ? update(party) : party)))
  }

  function addTempParty() {
    const party = createTempParty(parties)
    setParties((prev) => [...prev, party])
    // 파티가 하나도 없을 때 만든 아이템 줄은 새 파티를 쓴다.
    setItems((prev) => prev.map((item) => (item.partyId === null ? { ...item, partyId: party.id } : item)))
  }

  function setPartyName(id: string, name: string) {
    updateParty(id, (party) => ({ ...party, name }))
  }

  function setPartySplitMode(id: string, splitMode: SplitMode) {
    updateParty(id, (party) => ({ ...party, splitMode }))
  }

  function setPartySize(id: string, size: number) {
    const clamped = Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, size))
    updateParty(id, (party) => ({ ...party, ...resizeParty(party, clamped) }))
  }

  function setMemberName(partyId: string, memberId: number, name: string) {
    updateParty(partyId, (party) => ({
      ...party,
      members: party.members.map((member) => (member.id === memberId ? { ...member, name } : member)),
    }))
  }

  function setMemberRatio(partyId: string, memberId: number, ratio: number) {
    updateParty(partyId, (party) =>
      memberId === SETTLER_MEMBER_ID
        ? { ...party, settlerRatio: ratio }
        : {
            ...party,
            members: party.members.map((member) => (member.id === memberId ? { ...member, ratio } : member)),
          },
    )
  }

  function evenOutRatios(partyId: string) {
    updateParty(partyId, (party) => {
      const [settlerRatio, ...memberRatios] = createEvenRatioInputs(party.members.length + 1)
      return {
        ...party,
        settlerRatio,
        members: party.members.map((member, index) => ({ ...member, ratio: memberRatios[index] })),
      }
    })
  }

  /** 이름이 비었거나 다른 파티와 겹치면 오류 문구. 아이템의 파티 드롭다운에서
   * 구분할 수 없기 때문이다. */
  function partyNameError(id: string): string | null {
    const party = parties.find((p) => p.id === id)
    if (!party) return null
    const name = party.name.trim()
    if (!name) return '파티 이름을 입력하세요.'
    if (parties.some((p) => p.id !== id && p.name.trim() === name)) return '같은 이름의 파티가 있습니다.'
    return null
  }

  function isPartyDirty(id: string): boolean {
    const party = parties.find((p) => p.id === id)
    const saved = fixedParties.find((p) => p.id === id)
    return Boolean(party?.saved && saved && !isSameParty(party, saved))
  }

  function isPartyInUse(id: string): boolean {
    return items.some((item) => item.partyId === id && isPendingItem(item))
  }

  /** 고정팟이면 저장본을 덮어쓰고, 임시 파티면 새 고정팟으로 등록한다. */
  function saveParty(id: string) {
    const party = parties.find((p) => p.id === id)
    if (!party || partyNameError(id)) return
    const config = toConfig({ ...party, name: party.name.trim() })
    const next = fixedParties.some((p) => p.id === id)
      ? fixedParties.map((p) => (p.id === id ? config : p))
      : [...fixedParties, config]
    saveFixedParties(next)
    setFixedParties(next)
    updateParty(id, () => ({ ...config, saved: true }))
  }

  /** 임시 파티는 화면에서, 고정팟은 저장본에서도 지운다. 이 파티에 아직
   * 정산할 아이템이 있으면 지우지 않는다. */
  function deleteParty(id: string) {
    if (isPartyInUse(id)) return
    const remaining = parties.filter((party) => party.id !== id)
    setParties(remaining)
    if (fixedParties.some((party) => party.id === id)) {
      const next = fixedParties.filter((party) => party.id !== id)
      saveFixedParties(next)
      setFixedParties(next)
    }
    const fallback = remaining[0]?.id ?? null
    setItems((prev) => prev.map((item) => (item.partyId === id ? { ...item, partyId: fallback } : item)))
  }

  // --- 아이템 -------------------------------------------------------------

  function addItem() {
    setItems((prev) => {
      const last = prev.at(-1)
      // 새 줄의 파티는 바로 윗줄을 따른다.
      return [...prev, createItem((last?.id ?? -1) + 1, last?.partyId ?? parties[0]?.id ?? null)]
    })
  }

  function updateItem(id: number, patch: Partial<Omit<SaleItem, 'id'>>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeItem(id: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)))
  }

  function resetItems() {
    setItems([createItem(0, parties[0]?.id ?? null)])
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0)

  const settlement = useMemo(
    () => settleItems(items, parties, feeRate, settlerName),
    [items, parties, feeRate, settlerName],
  )

  return {
    settlerName,
    setSettlerName,
    parties,
    addTempParty,
    setPartyName,
    setPartySplitMode,
    setPartySize,
    setMemberName,
    setMemberRatio,
    evenOutRatios,
    partyNameError,
    isPartyDirty,
    isPartyInUse,
    saveParty,
    deleteParty,
    items,
    itemsTotal,
    addItem,
    updateItem,
    removeItem,
    resetItems,
    feeRate,
    setFeeRate,
    settlement,
  }
}

export type BossProfit = ReturnType<typeof useBossProfit>
