/** 분배금 계산기가 브라우저에 남기는 값.
 *
 * 금액과 아이템은 정산할 때마다 달라져서 남기지 않는다. 그 계정에서 거의 안
 * 바뀌는 설정(수수료율, 정산자 이름, 파티 영역 접힘)과, 매주 다시 입력하기
 * 번거로운 **고정팟**만 남긴다. 사생활 보호 모드 등에서 저장소가 throw할 수 있어
 * 전부 감싼다 — 저장에 실패해도 계산은 메모리 상태로 그대로 동작한다.
 */

import {
  AUCTION_FEE_RATES,
  type AuctionFeeRate,
  MAX_PARTY_SIZE,
  MIN_PARTY_SIZE,
  type PartyConfig,
} from '@/lib/boss-profit-split'

const FEE_STORAGE_KEY = 'maple-log:boss-profit:fee-rate'
const SETTLER_STORAGE_KEY = 'maple-log:boss-profit:settler-name'
const PARTIES_STORAGE_KEY = 'maple-log:boss-profit:fixed-parties'
const PARTY_SECTION_COLLAPSED_KEY = 'maple-log:boss-profit:party-section-collapsed'
const DEFAULT_FEE_RATE: AuctionFeeRate = 0.05

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 저장 실패는 조용히 무시한다.
  }
}

/** 저장된 값이 0/3/5% 중 하나가 아니면 기본값(5%)으로 되돌린다. */
export function loadFeeRate(): AuctionFeeRate {
  const raw = read(FEE_STORAGE_KEY)
  if (raw === null) return DEFAULT_FEE_RATE
  const parsed = Number(raw)
  return AUCTION_FEE_RATES.find((rate) => rate === parsed) ?? DEFAULT_FEE_RATE
}

export function saveFeeRate(feeRate: AuctionFeeRate): void {
  write(FEE_STORAGE_KEY, String(feeRate))
}

export function loadSettlerName(): string {
  return read(SETTLER_STORAGE_KEY) ?? ''
}

export function saveSettlerName(name: string): void {
  write(SETTLER_STORAGE_KEY, name)
}

/** 파티 영역을 접어 뒀는지. 기본은 펼침이다. */
export function loadPartySectionCollapsed(): boolean {
  return read(PARTY_SECTION_COLLAPSED_KEY) === 'true'
}

export function savePartySectionCollapsed(collapsed: boolean): void {
  write(PARTY_SECTION_COLLAPSED_KEY, String(collapsed))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 저장본 한 건을 읽는다. 모양이 깨진 항목은 `null`로 버린다. */
function parseParty(value: unknown): PartyConfig | null {
  if (typeof value !== 'object' || value === null) return null
  const party = value as Record<string, unknown>
  if (typeof party.id !== 'string' || typeof party.name !== 'string') return null
  if (party.splitMode !== 'equal' && party.splitMode !== 'custom') return null
  if (!isFiniteNumber(party.settlerRatio)) return null
  if (!Array.isArray(party.members)) return null
  const size = party.members.length + 1
  if (size < MIN_PARTY_SIZE || size > MAX_PARTY_SIZE) return null

  const members = []
  for (const [index, raw] of party.members.entries()) {
    if (typeof raw !== 'object' || raw === null) return null
    const member = raw as Record<string, unknown>
    if (typeof member.name !== 'string' || !isFiniteNumber(member.ratio)) return null
    members.push({ id: index, name: member.name, ratio: member.ratio })
  }

  return {
    id: party.id,
    name: party.name,
    splitMode: party.splitMode,
    settlerRatio: party.settlerRatio,
    members,
  }
}

export function loadFixedParties(): PartyConfig[] {
  const raw = read(PARTIES_STORAGE_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseParty).filter((party): party is PartyConfig => party !== null)
  } catch {
    return []
  }
}

export function saveFixedParties(parties: PartyConfig[]): void {
  write(
    PARTIES_STORAGE_KEY,
    JSON.stringify(
      parties.map((party) => ({
        id: party.id,
        name: party.name,
        splitMode: party.splitMode,
        settlerRatio: party.settlerRatio,
        members: party.members.map((member) => ({ name: member.name, ratio: member.ratio })),
      })),
    ),
  )
}
