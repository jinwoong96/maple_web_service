/** 메이플스토리 직업 이름 목록.
 *
 * 넥슨 API는 캐릭터마다 `character_class`로 직업 **이름**만 주고, "직업 전체
 * 목록"을 주는 엔드포인트는 없다. 그래서 손으로 유지한다. 한곳에만 둬서
 * 직업 아이콘(`job-category.ts`)과 OCR 열 판별이 같은 명단을 본다.
 *
 * 새 직업이 나오면 여기에만 더하면 된다. 빠진 이름은 아이콘이 기본값으로
 * 떨어지고 OCR 열 판별이 한 표를 잃을 뿐, 어디서도 터지지 않는다.
 *
 * **서버 DB에 두었다가 되돌렸다.** "배포 없이 행만 넣으면 된다"가 이유였는데,
 * 새 직업이 나오면 어차피 그에 맞춰 서비스를 손봐야 한다 — 배포를 아끼지
 * 못하면서 표·마이그레이션·엔드포인트·대안 목록만 늘었다. 이런 성격의 값이
 * 또 생기면 같은 이유로 여기 같은 자리에 둔다.
 */

import { truncatedAwareSimilarity } from '@/lib/hangul-similarity'

export type JobCategory = 'warrior' | 'magician' | 'bowman' | 'thief' | 'pirate' | 'other'

/** 계열별 직업 이름. 계열은 아이콘 색을 고르는 데만 쓴다 — 넥슨이 계열
 * 필드를 주지 않아서 우리가 나눈 것이고, 제논처럼 걸친 직업은 한쪽에 둔다. */
export const JOBS_BY_CATEGORY: Record<Exclude<JobCategory, 'other'>, readonly string[]> = {
  warrior: [
    '히어로',
    '팔라딘',
    '다크나이트',
    '소울마스터',
    '미하일',
    '블래스터',
    '데몬슬레이어',
    '데몬어벤져',
    '아란',
    '카이저',
    '아델',
    '제로',
  ],
  magician: [
    '아크메이지(불,독)',
    '아크메이지(썬,콜)',
    '비숍',
    '플레임위자드',
    '배틀메이지',
    '에반',
    '루미너스',
    '일리움',
    '라라',
    '키네시스',
  ],
  bowman: ['보우마스터', '신궁', '패스파인더', '윈드브레이커', '와일드헌터', '메르세데스', '카인'],
  thief: [
    '나이트로드',
    '섀도어',
    '듀얼블레이드',
    // 예전에 쓰던 표기. 넥슨 응답은 `듀얼블레이드`지만 둘 다 받아 둔다.
    '듀얼블레이더',
    '나이트워커',
    '팬텀',
    '카데나',
    '칼리',
    '호영',
    '제논',
  ],
  pirate: [
    '바이퍼',
    '캡틴',
    '캐논슈터',
    '스트라이커',
    '메카닉',
    '엔젤릭버스터',
    '은월',
    '아크',
    '렌',
  ],
}

/** 전직 전 캐릭터. 길드에 저렙 부캐를 넣어두는 사람이 있다. */
const BEGINNER_CLASSES = ['초보자', '노블레스', '시티즌', '레지스탕스'] as const

export const MAPLE_JOBS: readonly string[] = [
  ...Object.values(JOBS_BY_CATEGORY).flat(),
  ...BEGINNER_CLASSES,
]

/** 직업 이름으로 볼 만큼 닮았다고 할 문턱.
 *
 * OCR이 직업 이름도 틀리게 읽는다(실측 `윈드브레이커`→`윈드브래미커`,
 * `히어로`→`히머로`). 그래서 글자가 똑같은지가 아니라 **닮았는지**로 본다.
 * 자모 하나둘 어긋난 정도는 통과하고, 다른 이름은 걸러지는 자리다. */
const JOB_SIMILARITY = 0.7

/** 이 값이 직업 이름으로 보이는가. */
export function looksLikeJob(value: string): boolean {
  const cleaned = value.trim()
  if (!cleaned) return false
  return MAPLE_JOBS.some((job) => truncatedAwareSimilarity(cleaned, job) >= JOB_SIMILARITY)
}

/** OCR이 읽은 값을 **명단의 직업 이름으로 되돌린다.** 닮은 게 없으면 `null`.
 *
 * 흐릿한 문자열 둘을 문턱값으로 견주는 것보다, 먼저 제 이름으로 되돌린 뒤
 * 똑같은지 보는 편이 깔끔하다 — `윈드브레미커`를 `윈드브레이커`로 되돌리면
 * 그다음은 견줄 것도 없이 같거나 다르다. */
export function snapToJob(value: string): string | null {
  const cleaned = value.trim()
  if (!cleaned) return null
  let best: { job: string; score: number } | null = null
  for (const job of MAPLE_JOBS) {
    const score = truncatedAwareSimilarity(cleaned, job)
    if (score >= JOB_SIMILARITY && (best === null || score > best.score)) best = { job, score }
  }
  return best?.job ?? null
}

/** 점수판 직업 칸 값 — 읽은 후보들 중 **처음으로 직업 이름에 닮은 것**을 명단의 이름으로 되돌린다.
 *
 * 직업은 언제나 한글이다. 그래서 OCR은 **한글 전용 패스에서 읽은 값을 먼저** 넘기고(영문 섞인 패스는
 * `히어로`를 `5|0J로`처럼 읽기도 한다), 그다음 본 패스 값을 넘긴다. 어느 것도 닮지 않았으면 `null` —
 * 부르는 쪽이 읽은 값을 그대로 둔다(사람이 그림을 보고 고친다). */
export function readJob(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const snapped = snapToJob(candidate)
    if (snapped) return snapped
  }
  return null
}

/** 넥슨이 준 직업 이름이 우리 명단에 있는가.
 *
 * 없으면(새 직업이 나왔는데 명단을 아직 안 고쳤다면) 직업으로는 판단하지
 * 않는다. 모르는 이름을 "다르다"로 세면 엉뚱한 후보가 뽑힌다. */
export function isKnownJob(value: string): boolean {
  return MAPLE_JOBS.includes(value.trim())
}

/** 이 열이 직업 열인가.
 *
 * 절반 넘게 직업 이름이면 직업 열로 본다. 전부를 요구하지 않는 이유는 OCR이
 * 몇 칸은 알아볼 수 없게 뭉개기 때문이고, 절반을 요구하는 이유는 닉네임 중에
 * 직업 이름을 쓰는 사람이 더러 있기 때문이다(한둘로는 열이 넘어가지 않는다). */
export function looksLikeJobColumn(values: readonly string[]): boolean {
  if (values.length === 0) return false
  const hits = values.filter(looksLikeJob).length
  return hits / values.length > 0.5
}
