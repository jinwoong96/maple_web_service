/** 랭킹 `class` 파라미터가 받는 값.
 *
 * 값 모양은 `대분류-소분류`다. `전사-히어로`처럼. 대분류 전체를 보려면
 * 소분류 자리에 `전체 전직`을 넣는다. 하이픈이 없는 값(`전사`, `히어로`)은
 * 400이다.
 *
 * **틀린 값을 넣으면 넥슨이 조용히 무시한다** — 이게 이 파일이 손으로 적은
 * 표가 아니라 실측으로 확정한 표인 이유다(2026-09-27, `date=2026-09-26`).
 *
 * - 모르는 대분류(`노바-전체 전직`, `외계인-전체 전직`)는 **필터 없는 랭킹을
 *   그대로 돌려준다.** 오류가 없으니 화면은 "노바 랭킹"이라고 믿는다.
 * - 모르는 소분류(`전사-없는직업`)는 **대분류 전체로 떨어진다.**
 *
 * 그래서 아래 표는 "200이 왔다"로 만들지 않았다. 각 값마다 돌아온 줄의
 * `class_name`/`sub_class_name`이 한 가지로 모이는지를 보고, 모이는 것만
 * 남겼다. 그 결과 `노바`·`아니마`·`레프`·`데몬`·`하야토`·`칸`은 대분류가
 * 아니고(무시됐다), `도적-듀얼블레이드`도 아니다(`듀얼블레이더`가 맞다).
 *
 * 같은 날 종합 랭킹 20쪽·무릉도장 두 구간·유니온·시드·도전과제를 훑어
 * 나온 `class_name` 전체가 이 표에 있음을 확인했다. 새 직업이 나오면
 * 여기에 더해야 하고, **더하기 전에 실제로 걸러지는지 확인해야 한다.**
 *
 * 아이콘 색을 고르는 `maple-jobs.ts`의 계열 구분과는 다른 표다. 저쪽은
 * 우리가 5계열로 나눈 것이고, 이쪽은 넥슨의 대분류다 — 넥슨은 카이저·아델
 * 같은 직업을 각각 대분류로 둔다.
 */

/** 대분류 전체를 뜻하는 소분류. */
const ALL_JOBS = '전체 전직'

/** 소분류가 여럿인 대분류. */
const MULTI_JOB_CATEGORIES: readonly { category: string; jobs: readonly string[] }[] = [
  { category: '전사', jobs: ['히어로', '팔라딘', '다크나이트'] },
  { category: '마법사', jobs: ['아크메이지(불,독)', '아크메이지(썬,콜)', '비숍'] },
  { category: '궁수', jobs: ['보우마스터', '신궁', '패스파인더'] },
  { category: '도적', jobs: ['나이트로드', '섀도어', '듀얼블레이더'] },
  { category: '해적', jobs: ['바이퍼', '캡틴', '캐논마스터', '캐논슈터'] },
  {
    category: '기사단',
    jobs: ['소울마스터', '플레임위자드', '윈드브레이커', '나이트워커', '스트라이커', '미하일'],
  },
  {
    category: '레지스탕스',
    jobs: ['배틀메이지', '와일드헌터', '메카닉', '데몬슬레이어', '데몬어벤져', '제논', '블래스터'],
  },
]

/** 소분류가 하나뿐인 대분류.
 *
 * `label`을 따로 두는 이유는 넥슨의 대분류 이름이 사람들이 부르는 이름과
 * 다른 자리가 있기 때문이다 — `초월자`는 제로, `프렌즈 월드`는 키네시스다.
 * 고를 때는 아는 이름이 보여야 한다. */
const SINGLE_JOB_CATEGORIES: readonly { category: string; label?: string }[] = [
  { category: '초월자', label: '제로' },
  { category: '프렌즈 월드', label: '키네시스' },
  { category: '아란' },
  { category: '에반' },
  { category: '메르세데스' },
  { category: '팬텀' },
  { category: '은월' },
  { category: '루미너스' },
  { category: '카이저' },
  { category: '카인' },
  { category: '카데나' },
  { category: '칼리' },
  { category: '아델' },
  { category: '일리움' },
  { category: '아크' },
  { category: '라라' },
  { category: '호영' },
  { category: '렌' },
  { category: '레테' },
  { category: '엔젤릭버스터' },
]

export interface RankingClassOption {
  /** `class` 파라미터에 그대로 넣는 값. */
  value: string
  label: string
}

export interface RankingClassGroup {
  label: string
  options: readonly RankingClassOption[]
}

/** `<optgroup>`에 그대로 얹을 모양. */
export const RANKING_CLASS_GROUPS: readonly RankingClassGroup[] = [
  ...MULTI_JOB_CATEGORIES.map(({ category, jobs }) => ({
    label: category,
    options: [
      { value: `${category}-${ALL_JOBS}`, label: `${category} 전체` },
      ...jobs.map((job) => ({ value: `${category}-${job}`, label: job })),
    ],
  })),
  {
    label: '그 외',
    options: [
      ...SINGLE_JOB_CATEGORIES.map(({ category, label }) => ({
        value: `${category}-${ALL_JOBS}`,
        label: label ?? category,
      })),
      { value: `초보자-${ALL_JOBS}`, label: '초보자' },
    ],
  },
]
