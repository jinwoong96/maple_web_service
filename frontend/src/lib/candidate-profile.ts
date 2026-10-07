/** 후보가 여럿일 때 **직업과 레벨로** 한 명을 고른다.
 *
 * 점수판 스크린샷에는 닉네임만 있는 게 아니라 직업과 레벨도 같이 찍힌다.
 * 닉네임이 뭉개져 후보가 둘 이상 남았을 때, 그 두 줄기 정보를 넥슨에서
 * 받아와 견주면 대개 하나로 좁혀진다 — 실측에서 `배부른아기`와
 * `배부른참새`가 그랬다.
 *
 * **레벨은 한 시점이 아니라 범위로 본다.** 스크린샷은 그 주차에 찍힌 것이고
 * 조회는 지금 하는 것이라, 그 사이에 레벨이 올랐을 수 있다. 레벨은 내려가지
 * 않으므로 `주차 시작 전일 ≤ 찍힐 때 ≤ 지금`이 성립한다. 그 두 값을 받아
 * 구간으로 쓴다.
 *
 * **조회는 후보가 여럿인 줄에만 한다.** 명단 전체(1,024명)의 직업·레벨을
 * 받아오면 확실하지만 그만큼 호출이 든다. 애매한 줄은 한 장에 몇 개뿐이라
 * 그때그때 받는 편이 싸다.
 *
 * 키는 브라우저에서 넥슨으로 바로 간다(`nexon-direct-client.ts`) — 우리
 * 서버를 거치지 않는다.
 */

import { isKnownJob, snapToJob } from '@/lib/maple-jobs'
import { nexonDirectGet, NexonDirectApiError } from '@/lib/nexon-direct-client'

export interface CharacterProfile {
  /** 넥슨이 주는 직업 이름. `character_class`. */
  job: string
  /** 주차 시작 전일의 레벨. 못 받으면 `null`(아래쪽 한계 없음). */
  levelBefore: number | null
  /** 가장 최근 레벨. */
  levelNow: number
}

interface BasicResponse {
  character_class: string
  character_level: number
}

/** 스크린샷에서 읽어낸, 그 줄의 직업과 레벨. 못 읽었으면 빈 값이다. */
export interface ReadProfile {
  job: string
  level: number | null
}

/** 구간 바깥으로 이만큼은 봐준다.
 *
 * 구간 자체가 레벨이 오른 몫을 이미 품고 있으니 원래는 0이어도 된다. 다만
 * 레벨 칸을 잘못 읽으면(세 자리는 다시 읽지 않는다) **맞는 후보를 되레
 * 걷어내게** 되므로, 한 칸만 여유를 둔다. */
const LEVEL_SLACK = 1

/** 넥슨이 "아직 그날 자료가 준비 안 됐다"고 할 때의 코드. */
const DATA_NOT_READY = 'OPENAPI00009'

function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

async function fetchBasic(
  ocid: string,
  apiKey: string,
  date?: string,
): Promise<BasicResponse | null> {
  try {
    // **날짜를 안 넣으면 가장 최근 것이 온다.** 오늘 날짜를 넣으면 되레
    // "자료 미준비"로 걸린다.
    return await nexonDirectGet<BasicResponse>(
      '/maplestory/v1/character/basic',
      apiKey,
      date ? { ocid, date } : { ocid },
    )
  } catch (error) {
    if (error instanceof NexonDirectApiError && error.code === DATA_NOT_READY && date) {
      // 그날 자료가 아직 없으면 하루씩 당겨 본다. 시간대 때문에 어제 것도
      // 아직 안 올라와 있을 때가 있다(`use-growth-tracking.ts`와 같은 처리).
      return fetchBasic(ocid, apiKey, shiftDays(date, -1))
    }
    return null
  }
}

/** 후보 한 명의 직업과 레벨 구간. 못 받아오면 `null`.
 *
 * `resolve`는 이름 → ocid 변환이다. 캐시를 공유하려고 밖에서 받는다 —
 * 여기서 따로 캐시를 두면 그룹화·명단 변동이 쌓아둔 것과 어긋난다.
 *
 * `weekStart`는 점수 주차의 첫날(목요일)이다. 그 **전날**을 아래쪽 한계로
 * 쓴다. */
export async function fetchProfile(
  name: string,
  apiKey: string,
  resolve: (name: string) => Promise<string>,
  weekStart: string,
): Promise<CharacterProfile | null> {
  try {
    const ocid = await resolve(name)
    const now = await fetchBasic(ocid, apiKey)
    if (!now) return null
    const before = await fetchBasic(ocid, apiKey, shiftDays(weekStart, -1))
    return {
      job: now.character_class,
      levelBefore: before?.character_level ?? null,
      levelNow: now.character_level,
    }
  } catch {
    // 못 받아오면 그냥 못 가리는 것으로 둔다. 여기서 실패해도 사람이 직접
    // 짝지으면 되고, 한 명 때문에 나머지 줄까지 멈출 이유가 없다.
    return null
  }
}

/** 이 후보가 그 줄과 맞는가. 볼 수 있는 것만 본다. */
function fits(read: ReadProfile, profile: CharacterProfile): boolean {
  if (read.level !== null) {
    const low = (profile.levelBefore ?? 0) - LEVEL_SLACK
    const high = profile.levelNow + LEVEL_SLACK
    if (read.level < low || read.level > high) return false
  }
  // 읽은 직업을 명단의 이름으로 되돌린 뒤 견준다. 되돌릴 수 없거나 상대
  // 직업이 명단에 없으면 직업으로는 판단하지 않는다.
  const snapped = snapToJob(read.job)
  if (snapped && isKnownJob(profile.job) && snapped !== profile.job) return false
  return true
}

/** 후보를 하나로 좁힌다. 못 좁히면 `null`.
 *
 * **딱 하나만 남을 때만** 고른다. 둘이 같은 직업에 같은 레벨이면 여기서는
 * 가릴 수 없고, 그건 사람이 그림을 보고 고를 일이다. */
export function narrowByProfile(
  read: ReadProfile,
  candidates: readonly { name: string; profile: CharacterProfile | null }[],
): string | null {
  if (!read.job && read.level === null) return null
  const fitting = candidates.filter(
    (candidate) => candidate.profile !== null && fits(read, candidate.profile),
  )
  return fitting.length === 1 ? fitting[0].name : null
}

/** 후보 버튼 옆에 붙일 한 줄. 자동으로 못 골랐어도 사람이 보고 고르게 한다. */
export function describeProfile(profile: CharacterProfile | null): string {
  if (!profile) return '조회 실패'
  const level =
    profile.levelBefore !== null && profile.levelBefore !== profile.levelNow
      ? `${profile.levelBefore}~${profile.levelNow}`
      : String(profile.levelNow)
  return `${profile.job} ${level}`
}

/** 한 줄에서 직업으로 보이는 토큰을 찾는다.
 *
 * 열 번호로 집지 않는 이유는 닉네임 열이 빠지면 열이 통째로 밀리기 때문이다.
 * 직업 이름은 명단과 대보면 알 수 있으니 위치를 믿지 않아도 된다. */
export function findJobToken(tokens: readonly string[]): string {
  // 직업은 레벨(첫 숫자)보다 앞이다. 뒤의 직위(`부마스터`)가 직업(`보우마스터`)과 닮아서 거기까지만 본다.
  const firstNumber = tokens.findIndex((token) => /^\d[\d,]*$/.test(token))
  const head = firstNumber >= 0 ? tokens.slice(0, firstNumber) : tokens
  return head.find((token) => snapToJob(token) !== null) ?? ''
}
