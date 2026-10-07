/** 보스 결정석(강렬한 힘의 결정) 판매 가격과 파티 인원 상한.
 *
 * **가격 출처**: 넥슨 공식 패치노트 `maplestory.nexon.com/news/update/813`
 * (클라이언트 1.2.419, 2026-09-17)의 "보스 리워드 개편 → 강렬한 힘의 결정
 * 판매 가격이 조정됩니다" 표의 **변경 가격** 열. 46개 조합.
 *
 * 그 표에 없는 8개 난이도(칼로스/대적자/카링 익스트림, 흉성·벨로나·림보·
 * 발드릭스·유피테르 하드)는 이번 패치에서 가격이 바뀌지 않아 "변경 내역"에
 * 실리지 않은 것으로 보인다. 이 8개만 `maple.ygh.kr/boss-revenue`에서 역산해
 * 채웠고(2026-09-22 조회), 공식 출처가 아니라는 뜻에서 `unofficialPrice: true`로
 * 표시해 둔다 — 겹치는 12개 이상의 조합에서 그 사이트 값이 위 패치노트
 * 변경가와 정확히 일치하는 것은 확인했다.
 *
 * **파티 인원 상한 출처**: 나무위키 "메이플스토리/보스 몬스터/보스 컨텐츠".
 * 보스별 표가 아니라 규칙 문장으로 서술돼 있다 — 스우는 **익스트림만** 2인,
 * 최초의 대적자와 입장 레벨이 높은 후반 보스(찬란한 흉성/벨로나/림보/
 * 발드릭스/유피테르)는 3인, 나머지는 전부 6인.
 *
 * 정적 스냅샷이라 넥슨이 다시 조정하면 조용히 낡는다 — 자동으로 알아낼
 * 방법이 없으니 `probability-cost-reference.ts`의 가격표와 같은 규칙으로
 * 수동 갱신 대상이다. 입장 가능 레벨은 신뢰할 출처를 찾지 못해 모델링하지
 * 않는다 (`docs/planning/features/boss-revenue.md` 참고). */

export type BossDifficulty = '이지' | '노멀' | '하드' | '카오스' | '익스트림'

export interface BossDifficultyEntry {
  difficulty: BossDifficulty
  /** 결정석 1개 판매가 (메소). `priceEffectiveFrom`이 있으면 그 날짜부터의 가격. */
  price: number
  /** 이 날짜(KST, YYYY-MM-DD) 전까지는 `previousPrice`가 적용된다. */
  priceEffectiveFrom?: string
  previousPrice?: number
  /** 이 난이도만 보스 기본값과 다른 파티 인원 상한 (익스트림 스우). */
  maxParty?: number
  /** 공식 패치노트가 아니라 참고 사이트에서 가져온 값. */
  unofficialPrice?: boolean
}

export interface BossDefinition {
  id: string
  name: string
  /** 주간/월간 — 월간(검은 마법사)은 주간 12개 제한에 포함되지 않는다. */
  category: 'weekly' | 'monthly'
  /** 기본 파티 인원 상한. 난이도별로 다르면 해당 난이도에서 덮어쓴다. */
  maxParty: number
  difficulties: BossDifficultyEntry[]
}

/** 검은 마법사 결정 가격 적용일 — 패치노트 원문: "검은 마법사의 결정 판매
 * 가격은 2026년 10월 1일(목)부터 적용됩니다." */
const BLACK_MAGE_PRICE_EFFECTIVE_FROM = '2026-10-01'

/** 한 캐릭터가 한 주에 결정을 얻을 수 있는 주간 보스 수. 패치노트가 없앤 건
 * "주간 결정 **판매** 12개 제한"이고 **입장 횟수** 12회 제한은 그대로라,
 * 고를 수 있는 주간 보스는 여전히 최대 12개다 (사용자 확인 2026-09-22). */
export const WEEKLY_BOSS_LIMIT = 12

/** 참고 사이트와 같은 순서 — 대략 결정석 가격 오름차순이라 후반 보스일수록
 * 아래로 간다. */
export const BOSSES: BossDefinition[] = [
  {
    id: 'zakum',
    name: '자쿰',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 4_040_000 }],
  },
  {
    id: 'magnus',
    name: '매그너스',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '하드', price: 4_280_000 }],
  },
  {
    id: 'papulatus',
    name: '파풀라투스',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 6_550_000 }],
  },
  {
    id: 'pierre',
    name: '피에르',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 4_080_000 }],
  },
  {
    id: 'banban',
    name: '반반',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 4_070_000 }],
  },
  {
    id: 'bloody-queen',
    name: '블러디퀸',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 4_070_000 }],
  },
  {
    id: 'vellum',
    name: '벨룸',
    category: 'weekly',
    maxParty: 6,
    difficulties: [{ difficulty: '카오스', price: 4_640_000 }],
  },
  {
    id: 'lotus',
    name: '스우',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 8_350_000 },
      { difficulty: '하드', price: 48_900_000 },
      { difficulty: '익스트림', price: 545_000_000, maxParty: 2 },
    ],
  },
  {
    id: 'damien',
    name: '데미안',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 8_750_000 },
      { difficulty: '하드', price: 46_400_000 },
    ],
  },
  {
    id: 'guardian-angel-slime',
    name: '가디언 엔젤 슬라임',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 12_700_000 },
      { difficulty: '카오스', price: 71_300_000 },
    ],
  },
  {
    id: 'lucid',
    name: '루시드',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '이지', price: 14_900_000 },
      { difficulty: '노멀', price: 17_800_000 },
      { difficulty: '하드', price: 59_700_000 },
    ],
  },
  {
    id: 'will',
    name: '윌',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '이지', price: 16_100_000 },
      { difficulty: '노멀', price: 20_500_000 },
      { difficulty: '하드', price: 73_200_000 },
    ],
  },
  {
    id: 'dusk',
    name: '더스크',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 22_000_000 },
      { difficulty: '카오스', price: 66_300_000 },
    ],
  },
  {
    id: 'jin-hilla',
    name: '진 힐라',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 67_600_000 },
      { difficulty: '하드', price: 100_000_000 },
    ],
  },
  {
    id: 'dunkel',
    name: '듄켈',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 23_700_000 },
      { difficulty: '하드', price: 89_600_000 },
    ],
  },
  {
    id: 'seren',
    name: '선택받은 세렌',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '노멀', price: 167_000_000 },
      { difficulty: '하드', price: 302_000_000 },
      { difficulty: '익스트림', price: 1_840_000_000 },
    ],
  },
  {
    id: 'kalos',
    name: '감시자 칼로스',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '이지', price: 238_000_000 },
      { difficulty: '노멀', price: 479_000_000 },
      { difficulty: '카오스', price: 1_230_000_000 },
      { difficulty: '익스트림', price: 4_104_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'first-adversary',
    name: '최초의 대적자',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '이지', price: 261_000_000 },
      { difficulty: '노멀', price: 532_000_000 },
      { difficulty: '하드', price: 1_390_000_000 },
      { difficulty: '익스트림', price: 4_712_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'kaling',
    name: '카링',
    category: 'weekly',
    maxParty: 6,
    difficulties: [
      { difficulty: '이지', price: 320_000_000 },
      { difficulty: '노멀', price: 593_000_000 },
      { difficulty: '하드', price: 1_560_000_000 },
      { difficulty: '익스트림', price: 5_387_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'brilliant-star',
    name: '찬란한 흉성',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '노멀', price: 576_000_000 },
      { difficulty: '하드', price: 2_678_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'bellona',
    name: '벨로나',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '이지', price: 396_000_000 },
      { difficulty: '노멀', price: 824_000_000 },
      { difficulty: '하드', price: 2_950_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'limbo',
    name: '림보',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '노멀', price: 995_000_000 },
      { difficulty: '하드', price: 2_385_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'baldrix',
    name: '발드릭스',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '노멀', price: 1_320_000_000 },
      { difficulty: '하드', price: 3_078_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'jupiter',
    name: '유피테르',
    category: 'weekly',
    maxParty: 3,
    difficulties: [
      { difficulty: '노멀', price: 1_560_000_000 },
      { difficulty: '하드', price: 4_845_000_000, unofficialPrice: true },
    ],
  },
  {
    id: 'black-mage',
    name: '검은 마법사',
    category: 'monthly',
    maxParty: 6,
    difficulties: [
      {
        difficulty: '하드',
        price: 465_000_000,
        previousPrice: 665_000_000,
        priceEffectiveFrom: BLACK_MAGE_PRICE_EFFECTIVE_FROM,
      },
      {
        difficulty: '익스트림',
        price: 5_680_000_000,
        previousPrice: 8_740_000_000,
        priceEffectiveFrom: BLACK_MAGE_PRICE_EFFECTIVE_FROM,
      },
    ],
  },
]

/** 표시 순서를 그대로 유지한 주간 보스 목록 — "이 위로/아래로 숨기기"가
 * 이 순서를 기준으로 구간을 자른다. 월간 보스는 숨기기 대상이 아니다. */
export const WEEKLY_BOSSES = BOSSES.filter((boss) => boss.category === 'weekly')

/** `todayKst`("YYYY-MM-DD") 기준으로 실제 적용되는 가격. 검은 마법사처럼
 * 적용일이 미래인 가격은 그 전날까지 기존 가격을 쓴다. 날짜 문자열은 전부
 * "YYYY-MM-DD" 고정 폭이라 사전순 비교가 곧 날짜순 비교다. */
export function getBossPrice(entry: BossDifficultyEntry, todayKst: string): number {
  if (entry.priceEffectiveFrom != null && entry.previousPrice != null && todayKst < entry.priceEffectiveFrom) {
    return entry.previousPrice
  }
  return entry.price
}

/** 이 (보스, 난이도)에 허용되는 파티 인원 상한. */
export function getMaxParty(boss: BossDefinition, entry: BossDifficultyEntry): number {
  return entry.maxParty ?? boss.maxParty
}

/** 1인당 수익 = 결정석 가격 ÷ 파티원 수. 참고 사이트와 동일한 계산식이고,
 * 실제 표시값으로 교차검증했다 (예: 익스트림 스우 2인 → 2억 7250만). */
export function getRevenuePerPerson(price: number, partySize: number): number {
  return Math.floor(price / partySize)
}
