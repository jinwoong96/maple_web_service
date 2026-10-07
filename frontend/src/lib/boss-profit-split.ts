/** 보스 보상 분배금 계산.
 *
 * 경매장을 거쳐 분배하면 수수료를 **두 번** 낸다. 정산자가 전리품을 팔 때
 * 한 번, 파티원이 자기 몫을 받으려고 경매장에 물건을 올리고 정산자가 그걸
 * 사줄 때 또 한 번이다. 그래서 "판매 금액 ÷ 인원"으로 나누면 파티원만
 * 손해를 본다.
 *
 * 여기서는 **수수료를 뗀 실수령액**이 정해진 비율이 되도록 역산한다.
 *
 * - 정산자 실수령 = 판매 실수령액 − Σ(파티원 등록 금액)
 * - 파티원 i 실수령 = 등록 금액ᵢ × (1 − 수수료율)
 *
 * 둘이 비율 `r`을 이루게 풀면 분배 대상 총액 `T`는
 *
 * ```
 * T = 실수령액 / (r_정산자 + (1 − r_정산자) / (1 − 수수료율))
 * ```
 *
 * 계산식은 `chuchu.gg/simulators/boss-profit`의 결과와 원 단위까지 맞는 것을
 * 확인했다 (100억·3%·2인 → 등록 4,923,857,868 / 수령 4,776,142,132).
 *
 * "정산자"는 이 페이지를 쓰는 사람, 곧 전리품을 팔고 분배하는 한 사람이다.
 * 파티가 여러 개여도 정산자는 하나라서 파티 밖에 둔다.
 */

export const AUCTION_FEE_RATES = [0, 0.03, 0.05] as const
export type AuctionFeeRate = (typeof AUCTION_FEE_RATES)[number]

/** 정산자를 포함한 인원. */
export const MIN_PARTY_SIZE = 2
export const MAX_PARTY_SIZE = 6

export type SplitMode = 'equal' | 'custom'

export interface SplitMember {
  /** 파티 내 고정 식별자 — 0번째 원소가 정산자. */
  id: number
  name: string
  /** 실수령액 기준 분배 비율(%). 합이 100이어야 한다. */
  ratio: number
}

export interface MemberSettlement {
  id: number
  name: string
  ratio: number
  isSettler: boolean
  /** 파티원이 경매장에 올려야 할 금액. 정산자는 올릴 필요가 없어 `null`. */
  listingPrice: number | null
  /** 수수료를 뗀 뒤 실제로 손에 남는 금액. */
  netAmount: number
}

export interface SplitResult {
  /** 수수료를 떼기 전 판매 금액. */
  grossAmount: number
  /** 판매 수수료를 뗀 뒤 정산자가 실제로 받은 금액. */
  netAmount: number
  members: MemberSettlement[]
  /** 파티원 등록 금액의 합 — 정산자가 실제로 지출하는 금액. */
  totalListingPrice: number
}

/** 수수료를 뗀 금액. 반올림이다 — 내림으로 하면 참고 사이트 결과보다 1메소
 * 적게 나오는 조합이 있었다(100억·3%·2인). */
export function applyFee(amount: number, feeRate: number): number {
  return Math.round(amount * (1 - feeRate))
}

/** 균등 분배용 비율. 3명·6명처럼 100이 안 나눠떨어지는 인원이 있어서
 * 정수로 반올림하면 1%p 차이가 억 단위 편차로 벌어진다 — 실수 그대로 둬야
 * 실수령액이 진짜 같아진다. 이 값은 화면에 쓰지 않고 계산에만 쓴다. */
export function createEqualRatios(partySize: number): number[] {
  return Array.from({ length: partySize }, () => 100 / partySize)
}

/** 자율 분배에서 "비율 균등하게"를 눌렀을 때 입력칸에 채울 값.
 * 사람이 보고 고칠 값이라 소수점 한 자리로 자르고, 100에서 모자란 만큼은
 * 정산자 몫(0번째)에 붙여 합계를 정확히 100으로 맞춘다. */
export function createEvenRatioInputs(partySize: number): number[] {
  const base = Math.floor((100 / partySize) * 10) / 10
  const ratios = Array.from({ length: partySize }, () => base)
  ratios[0] = Math.round((ratios[0] + (100 - base * partySize)) * 10) / 10
  return ratios
}

export function calculateSplit(
  grossAmount: number,
  feeRate: number,
  members: SplitMember[],
): SplitResult {
  const netAmount = applyFee(grossAmount, feeRate)
  const [settler, ...rest] = members
  const settlerRatio = (settler?.ratio ?? 0) / 100

  // 정산자 몫은 수수료를 한 번만(판매할 때만) 거치고, 파티원 몫은 경매장을
  // 한 번 더 타서 (1 − 수수료율)로 한 번 더 깎인다. 그 차이를 반영해 분배
  // 대상 총액을 역산한다.
  const divisor = settlerRatio + (1 - settlerRatio) / (1 - feeRate)
  const distributable = divisor > 0 ? netAmount / divisor : 0

  const memberSettlements: MemberSettlement[] = rest.map((member) => {
    const listingPrice = Math.floor((distributable * (member.ratio / 100)) / (1 - feeRate))
    return {
      id: member.id,
      name: member.name,
      ratio: member.ratio,
      isSettler: false,
      listingPrice,
      netAmount: applyFee(listingPrice, feeRate),
    }
  })

  const totalListingPrice = memberSettlements.reduce((sum, m) => sum + (m.listingPrice ?? 0), 0)

  // 정산자는 남는 금액을 그대로 가져간다 — 1메소 단위로 버려진 잔액도 여기
  // 포함돼서, 전체 합이 항상 실수령액과 정확히 맞는다.
  const settlerSettlement: MemberSettlement = {
    id: settler?.id ?? 0,
    name: settler?.name ?? '',
    ratio: settler?.ratio ?? 0,
    isSettler: true,
    listingPrice: null,
    netAmount: netAmount - totalListingPrice,
  }

  return {
    grossAmount,
    netAmount,
    members: [settlerSettlement, ...memberSettlements],
    totalListingPrice,
  }
}

// ---------------------------------------------------------------------------
// 여러 파티 · 여러 아이템

/** 정산자를 뺀 파티원. */
export interface PartyMember {
  id: number
  name: string
  /** 자율 분배일 때의 비율 입력값(%). */
  ratio: number
}

export interface PartyConfig {
  id: string
  name: string
  splitMode: SplitMode
  /** 자율 분배일 때 정산자 몫(%). */
  settlerRatio: number
  /** 1~5명. 정산자를 더해 2~6명이다. */
  members: PartyMember[]
}

export interface SaleItem {
  id: number
  name: string
  amount: number
  partyId: string | null
}

export interface PartyRatios {
  /** 실제로 계산에 쓰는 비율(%) — 0번째가 정산자, 합이 100. */
  ratios: number[]
  /** 입력 비율 합계(%). 균등 분배면 100. */
  inputTotal: number
  /** 합계가 100이 아니라 100 기준으로 맞췄는지. */
  normalized: boolean
  /** 합계가 0 이하라 맞출 수도 없는지. */
  invalid: boolean
}

/** 파티가 실제로 쓰는 비율.
 *
 * 균등 분배는 정확히 `100/n`이다. 자율 분배에서 합계가 100이 아니면 결과를
 * 막는 대신 `rᵢ × 100 / 합계`로 **맞춰서** 계산한다 — 30/30/30처럼 대충
 * 넣어도 의도대로 나뉜다. 오타가 조용히 묻히지 않도록 화면에서는 맞춘 비율을
 * 경고로 보여준다. */
export function resolvePartyRatios(party: PartyConfig): PartyRatios {
  if (party.splitMode === 'equal') {
    return {
      ratios: createEqualRatios(party.members.length + 1),
      inputTotal: 100,
      normalized: false,
      invalid: false,
    }
  }

  const inputs = [party.settlerRatio, ...party.members.map((member) => member.ratio)]
  const inputTotal = inputs.reduce((sum, ratio) => sum + ratio, 0)
  if (inputTotal <= 0) {
    return { ratios: inputs, inputTotal, normalized: false, invalid: true }
  }
  // 소수점 입력까지 허용하려고 오차를 둔다.
  if (Math.abs(inputTotal - 100) < 0.001) {
    return { ratios: inputs, inputTotal, normalized: false, invalid: false }
  }
  return {
    ratios: inputs.map((ratio) => (ratio * 100) / inputTotal),
    inputTotal,
    normalized: true,
    invalid: false,
  }
}

/** 비율 표시용. 소수점 한 자리. */
export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 10) / 10}%`
}

export function memberLabel(index: number): string {
  return `파티원 ${index + 1}`
}

export function itemLabel(item: SaleItem, index: number): string {
  return item.name.trim() || `아이템 ${index + 1}`
}

/** 사람 한 명이 아이템 하나에서 받는 몫. */
export interface ItemShare {
  itemId: number
  itemLabel: string
  partyName: string
  /** 실제로 계산에 쓴 비율(%). */
  ratio: number
  /** 파티원은 경매장 등록 금액, 정산자는 정산 후 보유액. */
  amount: number
  /** 이 파티의 비율을 100 기준으로 맞췄는지. */
  normalized: boolean
}

export interface PersonSettlement {
  key: string
  name: string
  isSettler: boolean
  /** 파티원은 총 등록 금액, 정산자는 총 보유액. */
  total: number
  shares: ItemShare[]
}

export interface MultiSettlement {
  grossAmount: number
  netAmount: number
  /** 파티원 등록 금액의 합 — 정산자가 지출하는 금액. */
  totalListingPrice: number
  /** 정산에 들어간 아이템 수(금액이 있고 파티를 고른 것). */
  itemCount: number
  /** 정산에 들어간 아이템이 쓰는 파티 수. */
  partyCount: number
  /** 파티원(처음 등장한 순서) → 정산자 맨 끝. */
  people: PersonSettlement[]
  /** 비율을 맞춰 계산한 파티 이름. */
  normalizedParties: string[]
  /** 비율 합계가 0이라 계산할 수 없는 파티 이름. 하나라도 있으면 결과를 막는다. */
  blockedParties: string[]
}

/** 아이템마다 `calculateSplit`을 따로 부르고, 사람별로 합친다.
 *
 * - 파티원은 이름(앞뒤 공백 무시)이 같으면 파티가 달라도 한 사람이다. 이름이
 *   빈 파티원은 `A팟 파티원 1`처럼 파티별로 따로 둔다.
 * - 정산자는 항상 한 줄이다. 파티원 이름이 정산자 이름과 같아도 합치지 않는다.
 * - 총 등록 금액은 아이템별 등록 금액(1메소 내림)의 합이다. 파티원은
 *   정산자와의 1쌍마다 총액으로 한 번만 경매장에 올린다. 내림 잔액은 정산자
 *   보유액에 들어가 전체 합이 실수령액 합계와 맞는다.
 */
export function settleItems(
  items: SaleItem[],
  parties: PartyConfig[],
  feeRate: number,
  settlerName: string,
): MultiSettlement {
  const partyById = new Map(parties.map((party) => [party.id, party]))
  const ratiosById = new Map(parties.map((party) => [party.id, resolvePartyRatios(party)]))

  const counted = items
    .map((item, index) => ({ item, index, party: item.partyId ? partyById.get(item.partyId) : undefined }))
    .filter(
      (entry): entry is { item: SaleItem; index: number; party: PartyConfig } =>
        entry.item.amount > 0 && entry.party !== undefined,
    )

  const usedPartyIds = [...new Set(counted.map((entry) => entry.party.id))]
  const usedParties = usedPartyIds.map((id) => partyById.get(id)!)
  const normalizedParties = usedParties.filter((p) => ratiosById.get(p.id)!.normalized).map((p) => p.name)
  const blockedParties = usedParties.filter((p) => ratiosById.get(p.id)!.invalid).map((p) => p.name)

  const people = new Map<string, PersonSettlement>()
  const settler: PersonSettlement = {
    key: 'settler',
    name: settlerName.trim(),
    isSettler: true,
    total: 0,
    shares: [],
  }
  let grossAmount = 0
  let netAmount = 0
  let totalListingPrice = 0

  if (blockedParties.length === 0) {
    for (const { item, index, party } of counted) {
      const { ratios, normalized } = ratiosById.get(party.id)!
      const split = calculateSplit(item.amount, feeRate, [
        { id: -1, name: settlerName, ratio: ratios[0] },
        ...party.members.map((member, memberIndex) => ({ ...member, ratio: ratios[memberIndex + 1] })),
      ])
      grossAmount += split.grossAmount
      netAmount += split.netAmount
      totalListingPrice += split.totalListingPrice

      const shareBase = { itemId: item.id, itemLabel: itemLabel(item, index), partyName: party.name, normalized }

      split.members.forEach((member, memberIndex) => {
        if (member.isSettler) {
          settler.total += member.netAmount
          settler.shares.push({ ...shareBase, ratio: member.ratio, amount: member.netAmount })
          return
        }
        const trimmed = member.name.trim()
        const key = trimmed ? `name:${trimmed}` : `party:${party.id}:${member.id}`
        const name = trimmed || `${party.name} ${memberLabel(memberIndex - 1)}`
        const person = people.get(key) ?? { key, name, isSettler: false, total: 0, shares: [] }
        const listingPrice = member.listingPrice ?? 0
        person.total += listingPrice
        person.shares.push({ ...shareBase, ratio: member.ratio, amount: listingPrice })
        people.set(key, person)
      })
    }
  }

  return {
    grossAmount,
    netAmount,
    totalListingPrice,
    itemCount: counted.length,
    partyCount: usedPartyIds.length,
    people: settler.shares.length > 0 ? [...people.values(), settler] : [],
    normalizedParties,
    blockedParties,
  }
}

/** 정산 결과를 **붙여넣을 수 있는 글**로 만든다.
 *
 * 참고 사이트는 링크로 공유하는데, 그러려면 상태를 URL에 실어야 하고 받은
 * 쪽은 링크를 열어야 한다. 정작 필요한 건 파티 채팅이나 디스코드에 던질 몇
 * 줄이라 **글로 복사**하는 편이 짧다.
 *
 * 금액은 쉼표 넣은 정확한 수로 쓴다. 파티원이 경매장에 **그대로 쳐 넣을**
 * 값이라 `19억` 같은 줄임말로는 쓸 수가 없다. 파티원 줄에 실수령액은 붙이지
 * 않는다 — 파티원에게 필요한 건 등록할 금액뿐이다.
 */
export function buildSettlementText(settlement: MultiSettlement, feeRate: number): string {
  const meso = (value: number) => value.toLocaleString('ko-KR')
  const head =
    `보스 분배금 정산 (아이템 ${settlement.itemCount}개 · ` +
    `파티 ${settlement.partyCount}개 · 수수료 ${Math.round(feeRate * 100)}%)`
  const amounts = `판매 ${meso(settlement.grossAmount)} / 실수령 ${meso(settlement.netAmount)}`

  const blocks = settlement.people.map((person) => {
    const title = person.isSettler
      ? `${person.name ? `${person.name}(정산자)` : '정산자'} 총 보유 ${meso(person.total)}`
      : `${person.name} 총 등록 ${meso(person.total)}`
    const details = person.shares.map(
      (share) => ` - ${share.itemLabel} (${share.partyName} ${formatRatio(share.ratio)}) ${meso(share.amount)}`,
    )
    return [title, ...details].join('\n')
  })

  return [head, amounts, '', blocks.join('\n\n')].join('\n')
}
